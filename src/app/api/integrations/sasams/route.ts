import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { requestMeta } from "@/lib/request-meta";
import {
  analyseImportJob,
  applyDuplicateActions,
  createImportJob,
  detectDuplicates,
  executeImport,
  previewImport,
  rollbackImport,
  saveMappings,
  validateImportJob,
} from "@/lib/integrations/sasams/engine";
import { autoMapHeaders, guessEntityFromSheet } from "@/lib/integrations/sasams/mapping";
import { UnsupportedOfficialApiProvider } from "@/lib/integrations/sasams/provider";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "sasams.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await resolveLicenseSchoolId(session!, request.nextUrl.searchParams.get("schoolId"));
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const jobs = await prisma.importJob.findMany({
    where: { schoolId, providerCode: "sa-sams" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      batches: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { stagingRecords: true, errors: true } },
    },
  });
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const schoolId = await resolveLicenseSchoolId(
    session!,
    request.nextUrl.searchParams.get("schoolId")
  );
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    if (!requirePermission(session, "sasams.import")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "File is required" }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const created = await createImportJob({
        schoolId,
        userId: session!.userId,
        filename: file.name,
        mimeType: file.type || null,
        bytes,
        ...requestMeta(request),
      });
      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      const status = (error as { status?: number }).status ?? 400;
      return NextResponse.json({ message: error instanceof Error ? error.message : "Upload failed" }, { status });
    }
  }

  const body = (await request.json()) as {
    action?: string;
    jobId?: string;
    mappings?: Parameters<typeof saveMappings>[2];
    mappingName?: string;
    actions?: { id: string; action: string }[];
  };

  if (!body.jobId) return NextResponse.json({ message: "jobId required" }, { status: 400 });

  const job = await prisma.importJob.findFirst({ where: { id: body.jobId, schoolId } });
  if (!job) return NextResponse.json({ message: "Not found" }, { status: 404 });

  try {
    if (body.action === "analyse") {
      if (!requirePermission(session, "sasams.import")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      return NextResponse.json(await analyseImportJob(body.jobId, schoolId));
    }
    if (body.action === "validate") {
      if (!requirePermission(session, "sasams.import")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      return NextResponse.json(await validateImportJob(body.jobId, schoolId));
    }
    if (body.action === "map") {
      if (!requirePermission(session, "sasams.map")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      const headers = await inferHeaders(body.jobId);
      const mappings = body.mappings ?? autoMapHeaders(headers, guessEntityFromSheet(headers));
      return NextResponse.json(await saveMappings(body.jobId, schoolId, mappings, body.mappingName));
    }
    if (body.action === "duplicates") {
      if (!requirePermission(session, "sasams.import")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      return NextResponse.json(await detectDuplicates(body.jobId, schoolId));
    }
    if (body.action === "duplicate-actions") {
      if (!requirePermission(session, "sasams.import")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      return NextResponse.json(await applyDuplicateActions(body.jobId, schoolId, body.actions ?? []));
    }
    if (body.action === "preview") {
      if (!requirePermission(session, "sasams.view")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      return NextResponse.json(await previewImport(body.jobId, schoolId));
    }
    if (body.action === "execute") {
      if (!requirePermission(session, "sasams.execute")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      return NextResponse.json(await executeImport(body.jobId, schoolId, session!.userId));
    }
    if (body.action === "rollback") {
      if (!requirePermission(session, "sasams.rollback")) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      await rollbackImport(body.jobId, schoolId, session!.userId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "test-api") {
      const provider = new UnsupportedOfficialApiProvider();
      return NextResponse.json(await provider.testConnection());
    }
    return NextResponse.json({ message: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Import action failed" }, { status: 400 });
  }
}

async function inferHeaders(jobId: string): Promise<string[]> {
  const record = await prisma.importStagingRecord.findFirst({ where: { jobId } });
  if (!record) return [];
  return Object.keys((record.rawData as Record<string, string>) ?? {});
}
