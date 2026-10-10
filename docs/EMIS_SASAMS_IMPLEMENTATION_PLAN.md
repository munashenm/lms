# EMIS completeness and SA-SAMS export — implementation plan

This plan covers the next compliance work only. It does not change payroll, invoices, document holds, or the scheduler. It does not invent SA-SAMS Access table or column names. SchoolHub stays the operational record. Department filing stays in SA-SAMS, Valistractor, LURITS, and CEMIS.

## What already exists

Keep these. Do not build a second compliance centre or a second import pipeline.

| Piece | Where it lives | What it does today |
|---|---|---|
| Learner and educator field checks | `src/lib/compliance/emis-fields.ts` | Active learners: gender, population group, date of birth, SA ID or passport, and grade are errors. Home language, citizenship, and a missing LURITS number are warnings. Active educators: missing SA ID is an error; missing LURITS is a warning. |
| Readiness summary | `summariseCompliance` | Counts errors and warnings. `readyForExport` is true only when there are no errors. |
| Tabular SA-SAMS package | `src/lib/compliance/sasams-export.ts` | JSON plus CSV for learners, educators, and guardians. Column names are SchoolHub names, not an official SA-SAMS schema. |
| Export API | `POST /api/compliance/export` | `SASAMS_PACKAGE`, `CEMIS_MARKS`, `LURITS_PROMOTION`. Errors block the export unless the caller passes `allowWithErrors`. Permission `sasams.execute`. |
| Compliance Centre | `/admin/compliance` | Runs the checks and the three exports. Academic year and term selectors are not on the page. Export history is API-only. |
| SA-SAMS import | `/admin/integrations/sa-sams` | CSV, TSV, JSON, and Excel staging, mapping, preview, execute, and rollback. Permissions `sasams.view`, `sasams.import`, `sasams.map`, `sasams.execute`, `sasams.rollback`. |
| Native database adapter | `src/lib/integrations/sasams/native-database.ts` | Placeholder. `.mdb`, `.accdb`, and `.bak` are detected and refused. No table names are assumed. |
| Stored identifiers | `Student.luritsNumber`, `Teacher.luritsNumber`, `Student.homeLanguage`, `Student.populationGroup` | Already on the records. Existing rows stay null until staff or an import fills them. |
| CEMIS | `School.cemisEnabled` default false | Opt-in school setting. The marks export is an MVP CSV, not a validated Western Cape file. |

## Gaps this plan closes

1. Completeness is a list of messages. Staff cannot jump from a row to the learner or educator record, and the page does not show which academic year the export will use.
2. A school can export with `allowWithErrors`. That override is not recorded as a deliberate decision on the export job.
3. The SA-SAMS file uses SchoolHub column names. Districts still remap it by hand. An official layout can be added only after an authorised sample arrives.
4. LURITS numbers are not unique per school, so two learners can receive the same number from a feedback import.
5. CEMIS is offered to every school. It should stay behind `cemisEnabled`.
6. Export and LURITS import history are not shown in the Compliance Centre.

## Work, in order

### 1. Completeness the school can act on

- Keep `checkLearnerEmis` and `checkEducatorEmis`. Do not add new mandatory fields until a published EMIS or LURITS field list is attached to the change.
- On `/admin/compliance`, group issues by learner and educator. Each row links to the existing student or staff edit page. Do not add a new editor.
- Show the current academic year and, for CEMIS and promotion exports, a year and term selector that the API already accepts.
- Leave inactive learners and educators out of the checks, as the functions already do.
- Sensitive identity values stay behind the existing `students.emis_sensitive` permission. The completeness list can name the missing field and the admission or employee number without printing the SA ID.

### 2. Export safeguards

- Default export remains blocked while `summariseCompliance` reports errors.
- `allowWithErrors` stays an explicit staff action for `sasams.execute`. Store on the export job: who allowed it, when, and the error count at that moment.
- Scope every query to the session school. A super admin with no school selected keeps the current “select a school” response.
- Do not change existing learner, educator, or guardian rows while building the file. Export is read-only.
- Guardians included in the package stay limited to the learners in that school’s export.

### 3. SA-SAMS tabular export

- Keep `buildSasamsExportPackage` and `packageToCsvBundle` as the internal package.
- Add a short manifest note that the columns are SchoolHub names and must be mapped before a district upload.
- Show the last exports on the Compliance Centre from the existing export-job list. Include kind, format, time, actor, and whether errors were overridden.
- Do not generate `.mdb` or `.accdb`. `nativeDatabaseImporter` stays a placeholder until an authorised, anonymised sample is in the repository. The sample, not a guessed schema, defines `parse()`.

### 4. LURITS feedback, after the export safeguards

- Before writing a LURITS number, reject the row when another learner or educator in the same school already has that number.
- Record unmatched feedback rows on the job instead of only a count.
- Show import jobs on the Compliance Centre next to the export list.
- Do not add a LURITS approval workflow in this pass.

### 5. CEMIS stays opt-in

- Hide the CEMIS marks action unless `school.cemisEnabled` is true.
- The API returns a clear message when CEMIS is off, including for a direct POST.
- Do not turn the flag on for existing schools. The column default remains false.

## Out of scope

- Official SA-SAMS Access schema, Valistractor packing, IQMS, and NSC packs.
- Filing or submitting anything to a department.
- Changing fee holds, invoice letterhead, payroll, or scheduled jobs.
- A second scheduler, a second import wizard, or a new permission set. Reuse `sasams.*`.

## Acceptance checks

- A learner missing gender, population group, date of birth, identity, or grade appears as an error and blocks `SASAMS_PACKAGE` until the field is saved or a permitted user exports with `allowWithErrors`.
- A learner missing only home language, citizenship, or LURITS can be exported. Those stay warnings.
- An export with the override stores the actor and the error count. A normal export does not.
- Two schools never see each other’s learners in the package or the issue list.
- CEMIS export is unavailable while `cemisEnabled` is false, and existing schools stay opted out.
- A native database upload still returns the placeholder message and writes no learner rows.
- Existing compliance tests in `tests/compliance-waves.test.ts` stay green, with new cases for the override record, the duplicate LURITS rejection, and the CEMIS flag.
