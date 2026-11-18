import { labelFor, YEAR_LEVEL_OPTIONS } from "@/features/applications/types";
import { REVIEW_STATUS_META, semesterLabel, type ReviewStatus, type Semester } from "@/features/student-documents/types";
import { printBrand } from "@/lib/print-brand";
import type { TeacherGradeSection } from "./types";

export type GradeReportStatus = ReviewStatus | "missing";

export const GRADE_REPORT_STATUS_META: Record<GradeReportStatus, { label: string; className: string }> = {
  ...REVIEW_STATUS_META,
  missing: {
    label: "Not uploaded",
    className: "border-border bg-muted text-muted-foreground",
  },
};

interface GradeReportRecord {
  studentId: number;
  studentName: string;
  studentNumber: string;
  sectionId: number;
  sectionName: string;
  program: string;
  yearLevel: string;
  semester: Semester;
  status: GradeReportStatus;
  uploadedAt: string | null;
  reviewNote: string | null;
}

function summarize(students: number, records: GradeReportRecord[]) {
  const counts = { accepted: 0, pending: 0, returned: 0, missing: 0 };
  for (const record of records) counts[record.status]++;

  const expected = records.length;
  return {
    students,
    expected,
    ...counts,
    completion: expected ? Math.round((counts.accepted / expected) * 100) : 0,
  };
}

export function buildTeacherReport(sections: TeacherGradeSection[], semesters: Semester[]) {
  const records: GradeReportRecord[] = [];
  const sectionSummaries = sections.map(({ id, name, program, yearLevel, students }) => {
    const sectionRecords = students.flatMap((student) =>
      semesters.map((semester): GradeReportRecord => {
        const document = student.documents.find((item) => item.type === "grades" && item.semester === semester);
        return {
          studentId: student.id,
          studentName: student.name,
          studentNumber: student.studentNumber,
          sectionId: id,
          sectionName: name,
          program,
          yearLevel,
          semester,
          status: document?.reviewStatus ?? "missing",
          uploadedAt: document?.uploadedAt ?? null,
          reviewNote: document?.reviewNote ?? null,
        };
      }),
    );

    for (const record of sectionRecords) records.push(record);
    return { id, name, program, yearLevel, ...summarize(students.length, sectionRecords) };
  });

  return {
    summary: summarize(sectionSummaries.reduce((total, section) => total + section.students, 0), records),
    sections: sectionSummaries,
    records,
  };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const printDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" });

function uploadedDate(value: string | null) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? "—" : escapeHtml(printDate.format(time));
}

export function printTeacherReport(
  report: ReturnType<typeof buildTeacherReport>,
  context: { schoolYear: string; filters: string[] },
  programLabel: (code: string) => string,
): void {
  const { summary, sections, records } = report;
  const tiles = [
    ["Students", summary.students], ["Expected slips", summary.expected],
    ["Accepted", summary.accepted], ["Submitted", summary.pending],
    ["Returned", summary.returned], ["Not uploaded", summary.missing],
    ["Grade completion", `${summary.completion}%`],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  const sectionRows = sections.map((section) => `<tr>
    <th scope="row">${escapeHtml(section.name)}<small>${escapeHtml(programLabel(section.program))} · ${escapeHtml(labelFor(YEAR_LEVEL_OPTIONS, section.yearLevel))}</small></th>
    <td>${section.students}</td><td>${section.expected}</td><td>${section.accepted}</td>
    <td>${section.pending}</td><td>${section.returned}</td><td>${section.missing}</td><td>${section.completion}%</td>
  </tr>`).join("");
  const recordRows = records.map((record) => `<tr>
    <th scope="row">${escapeHtml(record.studentName)}<small>${escapeHtml(record.studentNumber)}</small></th>
    <td>${escapeHtml(record.sectionName)}<small>${escapeHtml(programLabel(record.program))} · ${escapeHtml(labelFor(YEAR_LEVEL_OPTIONS, record.yearLevel))}</small></td><td>${escapeHtml(semesterLabel(record.semester))}</td>
    <td>${GRADE_REPORT_STATUS_META[record.status].label}</td><td>${uploadedDate(record.uploadedAt)}</td>
    <td class="note">${record.reviewNote ? escapeHtml(record.reviewNote) : "—"}</td>
  </tr>`).join("");
  const schoolYear = escapeHtml(context.schoolYear);
  const issuedAt = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

  const frame = window.document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.title = "Grade slip report print preview";
  frame.srcdoc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Grade Slip Report · ${schoolYear}</title>
<style>
  @page { margin: 14mm; }
  body { margin: 0; color: #18181b; font: 11px/1.4 system-ui, sans-serif; }
  header { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #18181b; }
  h1 { margin: 0 0 4px; font-size: 16px; }
  .brand { font-size: 16px; font-weight: 800; letter-spacing: 0.04em; }
  .brand-sub { color: #52525b; font-size: 9px; }
  .context { text-align: right; }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0; break-inside: avoid; }
  .tiles div { padding: 6px 8px; border: 1px solid #e4e4e7; border-radius: 5px; }
  .tiles strong { display: block; font-size: 14px; }
  table { width: 100%; margin-bottom: 16px; border-collapse: collapse; }
  caption { padding-bottom: 5px; text-align: left; font-size: 12px; font-weight: 700; break-after: avoid; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { padding: 5px; border-bottom: 1px solid #e4e4e7; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  small { display: block; color: #52525b; font-weight: 400; }
  .note { white-space: pre-wrap; }
</style>
</head>
<body>
  <header>
    ${printBrand}
    <div class="context">
      <h1>Grade Slip Report</h1>
      <div>${schoolYear}</div>
      <div>${context.filters.map(escapeHtml).join(" · ")}</div>
      <div>Generated ${escapeHtml(issuedAt)}</div>
    </div>
  </header>
  <div class="tiles">${tiles}</div>
  <table>
    <caption>Section summary</caption>
    <thead><tr><th>Section</th><th>Students</th><th>Expected</th><th>Accepted</th><th>Submitted</th><th>Returned</th><th>Not uploaded</th><th>Completion</th></tr></thead>
    <tbody>${sectionRows || '<tr><td colspan="8">No matching sections.</td></tr>'}</tbody>
  </table>
  <table>
    <caption>Grade slip records</caption>
    <thead><tr><th>Student</th><th>Section</th><th>Semester</th><th>Status</th><th>Uploaded</th><th>Review note</th></tr></thead>
    <tbody>${recordRows || '<tr><td colspan="6">No grade slip records to display.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  window.document.body.appendChild(frame);
}
