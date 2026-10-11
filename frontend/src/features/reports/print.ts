import { COLLECTION_LABELS } from '@/features/bills/collection';
import {
  BILL_STATUS_META,
  PAYMENT_STATUS_META,
  paymentMethodLabel,
} from "@/features/bills/types";
import { discountValueLabel } from "@/features/discounts/types";
import { ENROLLMENT_STATUS_META } from "@/features/enrollments/types";
import { formatPeso } from "@/lib/money";
import type { ReportDataset } from "./types";

// Context the caller already has (selected term + period label) — kept
// separate from ReportDataset since neither lives on the API response.
export interface ReportPrintContext {
  schoolYear: string;
  periodLabel: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatIssuedAt(date: Date): string {
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

// Build the self-contained, print-optimized HTML document for a report
// snapshot. `programLabel` resolves a program code (e.g. "stem") to its
// catalog name — resolved by the caller since this module has no React hooks.
export function buildReportHtml(
  dataset: ReportDataset,
  context: ReportPrintContext,
  programLabel: (code: string) => string,
): string {
  const issuedAt = new Date();
  const summary = dataset.summary;

  const summaryTiles = [
    ["Total billed", formatPeso(summary.totalBilled)],
    ["Collected", formatPeso(summary.totalCollected)],
    ["Outstanding", formatPeso(summary.totalOutstanding)],
    ["Collection rate", `${summary.collectionRate}%`],
    ["Pending payments", String(summary.pendingPayments)],
    ["Bills generated", String(summary.billsGenerated)],
    ["Active students", String(summary.activeStudents)],
    ["Voucher credits", formatPeso(summary.voucherCredits)],
    ["Tuition incentive credits", formatPeso(summary.incentiveCredits ?? 0)],
  ]
    .map(
      ([label, value]) => `
        <div class="tile">
          <div class="tile-label">${escapeHtml(label)}</div>
          <div class="tile-value">${escapeHtml(value)}</div>
        </div>`,
    )
    .join("");

  const billStatusRows = dataset.billStatuses
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(BILL_STATUS_META[item.status].label)}</td>
          <td>${item.count}</td>
          <td class="amount">${formatPeso(item.total)}</td>
          <td class="muted">${escapeHtml(item.note)}</td>
        </tr>`,
    )
    .join("");

  const paymentMethodRows = dataset.paymentMethods
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(paymentMethodLabel(item.method))}</td>
          <td>${item.transactions}</td>
          <td class="amount">${formatPeso(item.verifiedAmount)}</td>
          <td>${item.pendingCount}</td>
        </tr>`,
    )
    .join("");

  const topBalanceRows = dataset.topBalances.length
    ? dataset.topBalances
        .map(
          (row) => `
        <tr>
          <td>${escapeHtml(row.studentName)}<br /><span class="muted">${escapeHtml(row.studentNumber)}</span></td>
          <td>${escapeHtml(programLabel(row.program))}<br /><span class="muted">${escapeHtml(row.yearLevel)}</span></td>
          <td>${escapeHtml(BILL_STATUS_META[row.status].label)}</td>
          <td>${row.paymentStatus ? escapeHtml(PAYMENT_STATUS_META[row.paymentStatus].label) : "—"}</td>
          <td class="amount">${formatPeso(row.netTotal)}</td>
          <td class="amount">${formatPeso(row.amountPaid)}</td>
          <td class="amount">${formatPeso(row.balance)}</td>
          <td class="amount">${formatPeso(row.amountDue)}${row.collectionState && row.collectionState !== "standard" ? `<br><small>${COLLECTION_LABELS[row.collectionState]}</small>` : ""}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="8" class="muted center">No open balances.</td></tr>`;

  const enrollmentStatusRows = dataset.enrollmentStatuses.length
    ? dataset.enrollmentStatuses
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(ENROLLMENT_STATUS_META[item.status].label)}</td>
          <td>${item.count}</td>
          <td class="muted">${escapeHtml(item.note)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted center">No enrollments recorded.</td></tr>`;

  const programMixRows = dataset.programMix.length
    ? dataset.programMix
        .map(
          (row) => `
        <tr>
          <td>${escapeHtml(programLabel(row.program))}</td>
          <td>${escapeHtml(row.yearLevel)}</td>
          <td>${row.students}</td>
          <td>${row.billed}</td>
          <td>${row.noDownpayment}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="muted center">No enrollments recorded.</td></tr>`;

  const enrollmentActivityRows = dataset.enrollmentActivity.length
    ? dataset.enrollmentActivity
        .map(
          (row) => `
        <tr>
          <td>${escapeHtml(row.studentName)}<br /><span class="muted">${escapeHtml(row.studentNumber)}</span></td>
          <td>${escapeHtml(programLabel(row.program))}<br /><span class="muted">${escapeHtml(row.yearLevel)}</span></td>
          <td>${escapeHtml(ENROLLMENT_STATUS_META[row.status].label)}</td>
          <td>${row.hasBill ? "Bill generated" : "No bill yet"}</td>
          <td>${row.noDownpayment ? "Allowed" : "Standard"}</td>
          <td>${formatShortDate(row.enrolledAt)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" class="muted center">No enrollment activity in this window.</td></tr>`;

  const voucherRows = dataset.vouchers.length
    ? dataset.vouchers
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(item.discount.name)}<br /><span class="muted">${escapeHtml(discountValueLabel(item.discount))}</span></td>
          <td>${item.recipients}</td>
          <td class="amount">${formatPeso(item.amountApplied)}</td>
          <td>${item.utilizationRate}%</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted center">No vouchers in the catalog.</td></tr>`;

  const creditActivityRows = dataset.creditActivity.length
    ? dataset.creditActivity
        .map(
          (row) => `
        <tr>
          <td>${escapeHtml(row.studentName)}<br /><span class="muted">${escapeHtml(row.studentNumber)}</span></td>
          <td>${escapeHtml(row.creditName ?? row.voucherName)}${row.reasons?.length ? `<br /><span class="muted">${escapeHtml(row.reasons.join(" + "))}</span>` : ""}</td>
          <td>${escapeHtml(BILL_STATUS_META[row.billStatus].label)}</td>
          <td class="amount">${formatPeso(row.amountApplied)}</td>
          <td>${formatShortDate(row.postedAt)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="muted center">No credit activity in this window.</td></tr>`;

  const channelRows = dataset.channelAudits.length
    ? dataset.channelAudits
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.isActive ? "Active" : "Inactive"}</td>
          <td>${item.hasQr ? "QR ready" : "No QR"}</td>
          <td>${item.pendingProofs}</td>
          <td class="amount">${formatPeso(item.verifiedAmount)}</td>
          <td>${formatShortDate(item.lastReviewed)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" class="muted center">No payment methods configured.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Report ${escapeHtml(context.schoolYear)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #18181b;
    margin: 0;
    padding: 32px;
    font-size: 12px;
    line-height: 1.45;
  }
  .sheet { max-width: 900px; margin: 0 auto; }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #18181b;
    padding-bottom: 16px;
  }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: 0.04em; }
  .brand-sub { color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  .doc-title { font-size: 16px; font-weight: 700; text-align: right; }
  .doc-meta { color: #71717a; font-size: 11px; text-align: right; margin-top: 4px; }
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 24px;
  }
  .tile { border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px 12px; }
  .tile-label { color: #71717a; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; }
  .tile-value { font-size: 15px; font-weight: 700; margin-top: 3px; }
  section { margin-top: 28px; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; }
  caption {
    caption-side: top;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #71717a;
    padding-bottom: 6px;
  }
  th {
    text-align: left;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #71717a;
    border-bottom: 1px solid #e4e4e7;
    padding: 6px 8px;
    white-space: nowrap;
  }
  td { padding: 7px 8px; border-bottom: 1px solid #f4f4f5; vertical-align: top; }
  th.amount, td.amount { text-align: right; white-space: nowrap; }
  td.center { text-align: center; }
  .muted { color: #71717a; }
  .foot { margin-top: 40px; border-top: 1px solid #e4e4e7; padding-top: 12px; color: #a1a1aa; font-size: 10.5px; }
  @media print {
    body { padding: 0; }
    @page { margin: 14mm; }
    section { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div>
        <div class="brand">ENROBILL</div>
        <div class="brand-sub">Enrollment &amp; Tuition Management</div>
      </div>
      <div>
        <div class="doc-title">FINANCE &amp; ENROLLMENT REPORT</div>
        <div class="doc-meta">
          ${escapeHtml(context.schoolYear)} · ${escapeHtml(context.periodLabel)}<br />
          Generated ${escapeHtml(formatIssuedAt(issuedAt))}
        </div>
      </div>
    </div>

    <div class="tiles">${summaryTiles}</div>

    <section>
      <table>
        <caption>Bills by status</caption>
        <thead><tr><th>Status</th><th>Accounts</th><th class="amount">Total</th><th>Note</th></tr></thead>
        <tbody>${billStatusRows}</tbody>
      </table>
    </section>

    <section>
      <table>
        <caption>Verified payments by method</caption>
        <thead><tr><th>Method</th><th>Transactions</th><th class="amount">Verified amount</th><th>Pending</th></tr></thead>
        <tbody>${paymentMethodRows}</tbody>
      </table>
    </section>

    <section>
      <table>
        <caption>Largest open balances</caption>
        <thead>
          <tr>
            <th>Student</th><th>Program</th><th>Status</th><th>Payment</th>
            <th class="amount">Net total</th><th class="amount">Paid</th>
            <th class="amount">Balance</th><th class="amount">Due now</th>
          </tr>
        </thead>
        <tbody>${topBalanceRows}</tbody>
      </table>
    </section>

    <section>
      <table>
        <caption>Enrollment status snapshot</caption>
        <thead><tr><th>Status</th><th>Students</th><th>Note</th></tr></thead>
        <tbody>${enrollmentStatusRows}</tbody>
      </table>
    </section>

    <section>
      <table>
        <caption>Program mix</caption>
        <thead><tr><th>Program</th><th>Year level</th><th>Students</th><th>Billed</th><th>No-DP</th></tr></thead>
        <tbody>${programMixRows}</tbody>
      </table>
    </section>

    <section>
      <table>
        <caption>Recent enrollment activity</caption>
        <thead><tr><th>Student</th><th>Program</th><th>Status</th><th>Billing</th><th>No downpayment</th><th>Enrolled at</th></tr></thead>
        <tbody>${enrollmentActivityRows}</tbody>
      </table>
    </section>

    <section>
      <table>
        <caption>Voucher utilization</caption>
        <thead><tr><th>Voucher</th><th>Recipients</th><th class="amount">Amount applied</th><th>Utilization</th></tr></thead>
        <tbody>${voucherRows}</tbody>
      </table>
    </section>

    <section>
      <table>
        <caption>Recent credit activity</caption>
        <thead><tr><th>Student</th><th>Credit</th><th>Status</th><th class="amount">Amount applied</th><th>Posted</th></tr></thead>
        <tbody>${creditActivityRows}</tbody>
      </table>
    </section>

    <section>
      <table>
        <caption>Payment channel audit</caption>
        <thead><tr><th>Channel</th><th>Status</th><th>QR</th><th>Pending</th><th class="amount">Verified amount</th><th>Last reviewed</th></tr></thead>
        <tbody>${channelRows}</tbody>
      </table>
    </section>

    <div class="foot">
      This is a system-generated report snapshot and does not require a signature.
      Generated on ${escapeHtml(formatIssuedAt(issuedAt))}.
    </div>
  </div>
</body>
</html>`;
}

// Render the report in a hidden iframe and open the browser's print dialog,
// from which the user can print or "Save as PDF" — same approach as
// printBillReceipt in features/bills/receipt.ts.
export function printReport(
  dataset: ReportDataset,
  context: ReportPrintContext,
  programLabel: (code: string) => string,
): void {
  const html = buildReportHtml(dataset, context, programLabel);
  const frame = window.document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  window.document.body.appendChild(frame);
}
