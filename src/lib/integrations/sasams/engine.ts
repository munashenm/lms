import { DuplicateAction, ImportIssueSeverity, ImportJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { detectImporter } from "./detect";
import { applyMapping, autoMapHeaders, guessEntityFromFilename, guessEntityFromSheet } from "./mapping";
import type { FieldMapping } from "./mapping";
import { classifyRecordStatus, findDuplicateSourceRecords, validateMappedRecord } from "./validation";
import { matchExistingEducator, matchExistingLearner, shouldSkipStagingRecord } from "./duplicates";
import { looksExecutable, readEncryptedImport, safeFilename, storeEncryptedImport, validateUpload } from "./security";
import { SASAMS_SOURCE, type ImportEntityType, type ParsedSource } from "./types";
import { asInputJson } from "@/lib/json";
import { generateStudentNumber } from "@/lib/students";
import { licenseWriteGuard } from "@/lib/licensing/enforce";
import { NATIVE_DATABASE_ADAPTER_ID, NATIVE_DATABASE_PLACEHOLDER_MESSAGE } from "./native-database";

const FILE_TTL_HOURS = Number(process.env.IMPORT_FILE_TTL_HOURS ?? "24");

export async function createImportJob(opts: {
  schoolId: string;
  userId: string;
  filename: string;
  mimeType: string | null;
  bytes: Buffer;
  ipAddress?: string;
}) {
  const name = safeFilename(opts.filename);
  const uploadError = validateUpload(name, opts.mimeType, opts.bytes.length);
  if (uploadError) throw Object.assign(new Error(uploadError), { status: 400 });
  if (looksExecutable(opts.bytes)) {
    throw Object.assign(new Error("Executable files cannot be imported."), { status: 400 });
  }

  const detected = detectImporter(name, opts.mimeType, opts.bytes);
  if (detected.importer?.id === NATIVE_DATABASE_ADAPTER_ID) {
    throw Object.assign(new Error(NATIVE_DATABASE_PLACEHOLDER_MESSAGE), { status: 422 });
  }
  const job = await prisma.importJob.create({
    data: {
      schoolId: opts.schoolId,
      providerCode: "sa-sams",
      adapterId: detected.importer?.id ?? "unsupported",
      filename: name,
      mimeType: opts.mimeType,
      fileSize: opts.bytes.length,
      status: ImportJobStatus.UPLOADED,
      createdById: opts.userId,
      expiresAt: new Date(Date.now() + FILE_TTL_HOURS * 60 * 60 * 1000),
      errorMessage: detected.importer ? null : detected.reason,
    },
  });

  const storageKey = await storeEncryptedImport(opts.schoolId, job.id, opts.bytes);
  await prisma.importJob.update({
    where: { id: job.id },
    data: { encryptedStorageKey: storageKey },
  });

  await logAudit({
    schoolId: opts.schoolId,
    userId: opts.userId,
    action: "SASAMS_FILE_UPLOADED",
    entity: "ImportJob",
    entityId: job.id,
    metadata: { adapter: job.adapterId, size: opts.bytes.length, filename: name },
    ipAddress: opts.ipAddress,
  });

  if (!detected.importer) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: ImportJobStatus.FAILED },
    });
  }

  return { job, detected };
}

export async function analyseImportJob(jobId: string, schoolId: string) {
  const job = await prisma.importJob.findFirst({ where: { id: jobId, schoolId } });
  if (!job?.encryptedStorageKey) throw new Error("Import job not found");
  const bytes = await readEncryptedImport(job.encryptedStorageKey);
  const detected = detectImporter(job.filename, job.mimeType, bytes);
  if (!detected.importer) throw new Error(detected.reason ?? "Unsupported format");

  await prisma.importJob.update({ where: { id: jobId }, data: { status: ImportJobStatus.ANALYSING } });
  const parsed = await detected.importer.parse(bytes, job.filename);
  await persistStaging(jobId, parsed, job.filename);

  const counts = await summariseStaging(jobId);
  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: ImportJobStatus.ANALYSED,
      analysedAt: new Date(),
      adapterId: detected.importer.id,
      summary: { ...counts, format: parsed.format, unrecognised: parsed.unrecognised },
    },
  });
  await logAudit({
    schoolId,
    action: "SASAMS_ANALYSED",
    entity: "ImportJob",
    entityId: jobId,
    metadata: { sheets: parsed.sheets.length, format: parsed.format },
  });
  return { parsed: { format: parsed.format, sheets: parsed.sheets.map((s) => ({ name: s.name, headers: s.headers, rows: s.rows.length })), unrecognised: parsed.unrecognised }, counts };
}

async function persistStaging(jobId: string, parsed: ParsedSource, filename: string) {
  await prisma.importStagingRecord.deleteMany({ where: { jobId } });
  const rows = [];
  for (const sheet of parsed.sheets) {
    const hint = guessEntityFromFilename(sheet.name) ?? guessEntityFromFilename(filename) ?? guessEntityFromSheet(sheet.headers);
    const mappings = autoMapHeaders(sheet.headers, hint === "unknown" ? undefined : hint);
    for (let i = 0; i < sheet.rows.length; i++) {
      const raw = sheet.rows[i];
      const mapped = applyMapping(raw, mappings);
      rows.push({
        jobId,
        entityType: hint,
        sourceRecordId: raw.studentNumber || raw.AdmissionNumber || raw.id || String(i + 1),
        sourceRow: i + 2,
        rawData: raw,
        mappedData: mapped,
        validationStatus: "PENDING",
      });
    }
  }
  if (rows.length) await prisma.importStagingRecord.createMany({ data: rows });
}

async function summariseStaging(jobId: string) {
  const records = await prisma.importStagingRecord.findMany({ where: { jobId } });
  const count = (type: string) => records.filter((r) => r.entityType === type).length;
  return {
    school: count("school"),
    learners: count("learner"),
    guardians: count("guardian"),
    educators: count("educator"),
    classes: count("class"),
    subjects: count("subject"),
    assessments: count("assessment"),
    attendance: count("attendance"),
    other: records.filter((r) => !["school", "learner", "guardian", "educator", "class", "subject", "assessment", "attendance"].includes(r.entityType)).length,
    unrecognised: count("unknown"),
    total: records.length,
  };
}

export async function validateImportJob(jobId: string, schoolId: string) {
  const records = await prisma.importStagingRecord.findMany({ where: { jobId, job: { schoolId } } });
  await prisma.importError.deleteMany({ where: { jobId } });
  const learnerRows = records
    .filter((r) => r.entityType === "learner")
    .map((r, index) => ({
      index,
      id: r.id,
      mapped: (r.mappedData ?? {}) as Record<string, string>,
    }));
  const dupes = findDuplicateSourceRecords(learnerRows.map((r, i) => ({ index: i, mapped: r.mapped })));

  for (const record of records) {
    const mapped = (record.mappedData ?? {}) as Record<string, string>;
    const issues = validateMappedRecord(record.entityType as ImportEntityType, mapped);
    const learnerIndex = learnerRows.findIndex((l) => l.id === record.id);
    if (learnerIndex >= 0 && dupes.get(learnerIndex)) {
      issues.push({
        severity: "ERROR",
        code: "DUPLICATE_IN_SOURCE",
        message: "Duplicate learner in the source file",
      });
    }
    const status = classifyRecordStatus(issues);
    await prisma.importStagingRecord.update({
      where: { id: record.id },
      data: { validationStatus: status, issues },
    });
    if (issues.length) {
      await prisma.importError.createMany({
        data: issues.map((issue) => ({
          jobId,
          stagingRecordId: record.id,
          severity: issue.severity as ImportIssueSeverity,
          code: issue.code,
          message: issue.message,
          field: issue.field,
        })),
      });
    }
  }

  await prisma.importJob.update({ where: { id: jobId }, data: { status: ImportJobStatus.VALIDATED } });
  return summariseIssues(jobId);
}

export async function saveMappings(jobId: string, schoolId: string, mappings: FieldMapping[], name?: string) {
  const job = await prisma.importJob.findFirst({ where: { id: jobId, schoolId } });
  if (!job) throw new Error("Import job not found");
  const mapping = await prisma.importFieldMapping.create({
    data: {
      schoolId,
      providerCode: "sa-sams",
      adapterVersion: job.adapterId,
      name: name || `${job.adapterId} mapping`,
      mappings: asInputJson(mappings),
      isDefault: false,
    },
  });
  const records = await prisma.importStagingRecord.findMany({ where: { jobId } });
  for (const record of records) {
    const mapped = applyMapping(record.rawData as Record<string, string>, mappings);
    await prisma.importStagingRecord.update({
      where: { id: record.id },
      data: { mappedData: mapped, entityType: mappings[0]?.entityType ?? record.entityType },
    });
  }
  await prisma.importJob.update({
    where: { id: jobId },
    data: { mappingId: mapping.id, status: ImportJobStatus.MAPPED },
  });
  return mapping;
}

export async function detectDuplicates(jobId: string, schoolId: string) {
  const [records, learners, educators] = await Promise.all([
    prisma.importStagingRecord.findMany({ where: { jobId, job: { schoolId } } }),
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, studentNumber: true, saIdNumber: true, dateOfBirth: true },
    }),
    prisma.teacher.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true, saIdNumber: true },
    }),
  ]);

  for (const record of records) {
    const mapped = (record.mappedData ?? {}) as Record<string, string>;
    if (record.entityType === "learner") {
      const match = matchExistingLearner(mapped, learners);
      await prisma.importStagingRecord.update({
        where: { id: record.id },
        data: {
          duplicateOfId: match.existingId,
          duplicateAction: match.suggested as DuplicateAction,
          issues: [...(((record.issues as unknown[]) ?? []) as object[]), ...match.issues],
        },
      });
    } else if (record.entityType === "educator") {
      const match = matchExistingEducator(mapped, educators);
      await prisma.importStagingRecord.update({
        where: { id: record.id },
        data: {
          duplicateOfId: match.existingId,
          duplicateAction: match.suggested as DuplicateAction,
          issues: [...(((record.issues as unknown[]) ?? []) as object[]), ...match.issues],
        },
      });
    }
  }
  await prisma.importJob.update({ where: { id: jobId }, data: { status: ImportJobStatus.DETECTING_DUPLICATES } });
  const preview = await previewImport(jobId, schoolId);
  const staging = await prisma.importStagingRecord.findMany({
    where: { jobId, job: { schoolId } },
    orderBy: { sourceRow: "asc" },
    take: 500,
  });
  return {
    ...preview,
    records: staging.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      sourceRow: r.sourceRow,
      duplicateAction: r.duplicateAction,
      duplicateOfId: r.duplicateOfId,
      validationStatus: r.validationStatus,
      mappedData: r.mappedData,
    })),
  };
}

export async function previewImport(jobId: string, schoolId: string) {
  const records = await prisma.importStagingRecord.findMany({ where: { jobId, job: { schoolId } } });
  const errors = await prisma.importError.count({ where: { jobId, severity: "ERROR" } });
  const warnings = await prisma.importError.count({ where: { jobId, severity: "WARNING" } });
  const count = (type: string, action?: DuplicateAction) =>
    records.filter((r) => r.entityType === type && (!action || r.duplicateAction === action)).length;
  const summary = {
    learnersToCreate: count("learner", DuplicateAction.CREATE_NEW),
    learnersToUpdate: count("learner", DuplicateAction.UPDATE_EXISTING),
    learnersSkipped: count("learner", DuplicateAction.SKIP),
    parentsToCreate: count("guardian", DuplicateAction.CREATE_NEW),
    educatorsToCreate: count("educator", DuplicateAction.CREATE_NEW),
    classesToCreate: count("class"),
    subjectsToCreate: count("subject"),
    attendanceRecords: count("attendance"),
    assessmentRecords: count("assessment"),
    warnings,
    errors,
  };
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: ImportJobStatus.PREVIEW, summary: { ...(((await prisma.importJob.findUnique({ where: { id: jobId } }))?.summary as object) ?? {}), preview: summary } },
  });
  return summary;
}

const DUPLICATE_ACTIONS = new Set<string>(["SKIP", "UPDATE_EXISTING", "CREATE_NEW", "REVIEW_MANUALLY"]);

export async function applyDuplicateActions(
  jobId: string,
  schoolId: string,
  actions: { id: string; action: string }[]
) {
  const records = await prisma.importStagingRecord.findMany({
    where: { jobId, job: { schoolId } },
    select: { id: true },
  });
  const allowedIds = new Set(records.map((r) => r.id));
  for (const item of actions) {
    if (!allowedIds.has(item.id) || !DUPLICATE_ACTIONS.has(item.action)) continue;
    await prisma.importStagingRecord.update({
      where: { id: item.id },
      data: { duplicateAction: item.action as DuplicateAction },
    });
  }
  return previewImport(jobId, schoolId);
}

export async function executeImport(jobId: string, schoolId: string, userId: string) {
  const job = await prisma.importJob.findFirst({ where: { id: jobId, schoolId } });
  if (!job) throw new Error("Import job not found");
  await logAudit({
    schoolId,
    userId,
    action: "SASAMS_IMPORT_STARTED",
    entity: "ImportJob",
    entityId: jobId,
  });
  await prisma.importJob.update({ where: { id: jobId }, data: { status: ImportJobStatus.IMPORTING } });
  const batch = await prisma.importBatch.create({
    data: { jobId, schoolId, status: ImportJobStatus.IMPORTING },
  });

  const records = await prisma.importStagingRecord.findMany({ where: { jobId } });
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    for (const record of records) {
      if (shouldSkipStagingRecord(record)) {
        skipped += 1;
        continue;
      }
      const mapped = (record.mappedData ?? {}) as Record<string, string>;
      try {
        if (record.entityType === "learner") {
          const result = await importLearner(schoolId, mapped, record, batch.id, userId);
          if (result === "created") created += 1;
          else updated += 1;
        } else if (record.entityType === "educator") {
          await importEducator(schoolId, mapped, record, batch.id, userId);
          created += 1;
        } else if (record.entityType === "grade") {
          await prisma.grade.upsert({
            where: { schoolId_name: { schoolId, name: mapped.name || mapped.grade || "Unknown" } },
            update: {},
            create: { schoolId, name: mapped.name || mapped.grade || "Unknown" },
          });
          created += 1;
        } else if (record.entityType === "class") {
          await prisma.class.create({
            data: { schoolId, name: mapped.name || mapped.class || "Class" },
          }).catch(() => null);
          created += 1;
        } else if (record.entityType === "subject") {
          const code = mapped.code || (mapped.name || "SUB").slice(0, 8).toUpperCase();
          await prisma.subject.upsert({
            where: { schoolId_code: { schoolId, code } },
            update: { name: mapped.name || code },
            create: { schoolId, code, name: mapped.name || code },
          });
          created += 1;
        } else if (record.entityType === "guardian") {
          await prisma.guardian.create({
            data: {
              schoolId,
              firstName: mapped.firstName || "Unknown",
              lastName: mapped.lastName || "Guardian",
              email: mapped.email || null,
              phone: mapped.phone || null,
            },
          });
          created += 1;
        } else {
          skipped += 1;
        }
      } catch {
        errors += 1;
      }
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: ImportJobStatus.COMPLETED,
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        errorCount: errors,
        completedAt: new Date(),
      },
    });
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: ImportJobStatus.COMPLETED, importedAt: new Date() },
    });
    await logAudit({
      schoolId,
      userId,
      action: "SASAMS_IMPORT_COMPLETED",
      entity: "ImportJob",
      entityId: jobId,
      metadata: { created, updated, skipped, errors, batchId: batch.id },
    });
    return { created, updated, skipped, errors, batchId: batch.id };
  } catch (error) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: ImportJobStatus.FAILED, errorMessage: error instanceof Error ? error.message : "Import failed" },
    });
    await logAudit({
      schoolId,
      userId,
      action: "SASAMS_IMPORT_FAILED",
      entity: "ImportJob",
      entityId: jobId,
    });
    throw error;
  }
}

async function importLearner(
  schoolId: string,
  mapped: Record<string, string>,
  record: { id: string; duplicateOfId: string | null; duplicateAction: DuplicateAction; sourceRecordId: string | null },
  batchId: string,
  userId: string
) {
  if (record.duplicateAction === DuplicateAction.UPDATE_EXISTING && record.duplicateOfId) {
    await prisma.student.update({
      where: { id: record.duplicateOfId },
      data: {
        firstName: mapped.firstName || undefined,
        lastName: mapped.lastName || undefined,
        saIdNumber: mapped.saIdNumber || undefined,
      },
    });
    await prisma.importStagingRecord.update({
      where: { id: record.id },
      data: { importedEntityId: record.duplicateOfId },
    });
    await prisma.externalRecordMapping.upsert({
      where: {
        schoolId_sourceSystem_entityType_sourceRecordId: {
          schoolId,
          sourceSystem: SASAMS_SOURCE,
          entityType: "learner",
          sourceRecordId: record.sourceRecordId || record.id,
        },
      },
      update: { localEntityId: record.duplicateOfId, importBatchId: batchId },
      create: {
        schoolId,
        sourceSystem: SASAMS_SOURCE,
        sourceRecordId: record.sourceRecordId || record.id,
        entityType: "learner",
        localEntityId: record.duplicateOfId,
        importBatchId: batchId,
        importedById: userId,
      },
    });
    return "updated" as const;
  }

  const guard = await licenseWriteGuard({ schoolId, action: "create_learner" });
  if (!guard.ok) throw new Error(String(guard.body.message));

  const studentNumber = mapped.studentNumber?.trim() || (await generateStudentNumber(schoolId));
  const student = await prisma.student.create({
    data: {
      schoolId,
      firstName: mapped.firstName || "Unknown",
      lastName: mapped.lastName || "Learner",
      studentNumber,
      saIdNumber: mapped.saIdNumber || null,
      email: mapped.email || null,
      phone: mapped.phone || null,
      dateOfBirth: mapped.dateOfBirth ? new Date(mapped.dateOfBirth) : null,
      status: "ACTIVE",
    },
  });
  await prisma.importStagingRecord.update({
    where: { id: record.id },
    data: { importedEntityId: student.id },
  });
  await prisma.externalRecordMapping.create({
    data: {
      schoolId,
      sourceSystem: SASAMS_SOURCE,
      sourceRecordId: record.sourceRecordId || record.id,
      entityType: "learner",
      localEntityId: student.id,
      importBatchId: batchId,
      importedById: userId,
    },
  });
  return "created" as const;
}

async function importEducator(
  schoolId: string,
  mapped: Record<string, string>,
  record: { id: string; sourceRecordId: string | null },
  batchId: string,
  userId: string
) {
  const guard = await licenseWriteGuard({ schoolId, action: "create_educator" });
  if (!guard.ok) throw new Error(String(guard.body.message));
  const employeeNumber = mapped.employeeNumber?.trim() || `EDU${Date.now().toString().slice(-6)}`;
  const teacher = await prisma.teacher.create({
    data: {
      schoolId,
      firstName: mapped.firstName || "Unknown",
      lastName: mapped.lastName || "Educator",
      employeeNumber,
      saIdNumber: mapped.saIdNumber || null,
      email: mapped.email || null,
      phone: mapped.phone || null,
      department: mapped.department || null,
    },
  });
  await prisma.externalRecordMapping.create({
    data: {
      schoolId,
      sourceSystem: SASAMS_SOURCE,
      sourceRecordId: record.sourceRecordId || record.id,
      entityType: "educator",
      localEntityId: teacher.id,
      importBatchId: batchId,
      importedById: userId,
    },
  });
  await prisma.importStagingRecord.update({
    where: { id: record.id },
    data: { importedEntityId: teacher.id },
  });
}

async function summariseIssues(jobId: string) {
  const [errors, warnings, info] = await Promise.all([
    prisma.importError.count({ where: { jobId, severity: "ERROR" } }),
    prisma.importError.count({ where: { jobId, severity: "WARNING" } }),
    prisma.importError.count({ where: { jobId, severity: "INFORMATION" } }),
  ]);
  return { errors, warnings, info };
}

export async function rollbackImport(jobId: string, schoolId: string, userId: string) {
  const batch = await prisma.importBatch.findFirst({
    where: { jobId, schoolId },
    orderBy: { createdAt: "desc" },
    include: { mappings: true },
  });
  if (!batch) throw new Error("No completed import batch to roll back");

  for (const mapping of batch.mappings) {
    if (mapping.entityType === "learner") {
      const linked = await prisma.externalRecordMapping.count({
        where: { localEntityId: mapping.localEntityId, id: { not: mapping.id } },
      });
      if (linked === 0) {
        await prisma.student.deleteMany({
          where: { id: mapping.localEntityId, schoolId, createdAt: { gte: batch.startedAt } },
        });
      }
    }
    if (mapping.entityType === "educator") {
      await prisma.teacher.deleteMany({
        where: { id: mapping.localEntityId, schoolId, createdAt: { gte: batch.startedAt } },
      });
    }
    if (mapping.entityType === "guardian") {
      await prisma.guardian.deleteMany({
        where: { id: mapping.localEntityId, schoolId, createdAt: { gte: batch.startedAt } },
      });
    }
    await prisma.externalRecordMapping.delete({ where: { id: mapping.id } });
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: ImportJobStatus.ROLLED_BACK, completedAt: new Date() },
  });
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: ImportJobStatus.ROLLED_BACK, rolledBackAt: new Date() },
  });
  await logAudit({
    schoolId,
    userId,
    action: "SASAMS_IMPORT_ROLLED_BACK",
    entity: "ImportJob",
    entityId: jobId,
    metadata: { batchId: batch.id },
  });
}
