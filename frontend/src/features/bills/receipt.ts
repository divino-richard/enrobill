import { formatPeso } from "@/lib/money";
import { semesterLabel } from "@/features/terms/types";
import { paymentMethodLabel, type Bill } from "./types";

// Who the receipt is billed to. The admin pages can read this off the bill's
// embedded student; the student portal passes the signed-in user's details.
export interface ReceiptParty {
  name: string;
  studentNumber?: string | null;
  program?: string | null;
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

function termLine(bill: Bill): string {
  const parts = [
    bill.schoolYear ? `SY ${bill.schoolYear}` : null,
    bill.semester ? semesterLabel(bill.semester) : null,
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

// Build the self-contained, print-optimized HTML document for a bill receipt.
// Only verified payments are itemized — pending/rejected ones don't count as
// money received.
export function buildBillReceiptHtml(bill: Bill, party: ReceiptParty): string {
  const issuedAt = new Date();
  const receiptNo = `REC-${String(bill.id).padStart(6, "0")}`;
  const verifiedPayments = (bill.payments ?? []).filter(
    (payment) => payment.status === "verified",
  );
  const totalReceived = verifiedPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );

  const partyRows = [
    `<div class="party-name">${escapeHtml(party.name)}</div>`,
    party.studentNumber
      ? `<div class="muted">${escapeHtml(party.studentNumber)}</div>`
      : "",
    party.program ? `<div class="muted">${escapeHtml(party.program)}</div>` : "",
  ].join("");

  const itemRows = bill.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td class="amount">${formatPeso(item.amount)}</td>
        </tr>`,
    )
    .join("");

  const paymentRows = verifiedPayments.length
    ? verifiedPayments
        .map(
          (payment) => `
        <tr>
          <td>${escapeHtml(payment.paidAt ?? "—")}</td>
          <td>${escapeHtml(paymentMethodLabel(payment.method))}</td>
          <td>${escapeHtml(payment.reference ?? "—")}</td>
          <td class="amount">${formatPeso(payment.amount)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted center">No verified payments recorded.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(receiptNo)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #18181b;
    margin: 0;
    padding: 32px;
    font-size: 13px;
    line-height: 1.45;
  }
  .sheet { max-width: 760px; margin: 0 auto; }
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
  .doc-meta { color: #71717a; font-size: 12px; text-align: right; margin-top: 4px; }
  .cols { display: flex; justify-content: space-between; gap: 24px; margin-top: 24px; }
  .col-label { color: #71717a; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .party-name { font-weight: 600; font-size: 14px; }
  .muted { color: #71717a; }
  .right { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-top: 28px; }
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
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #71717a;
    border-bottom: 1px solid #e4e4e7;
    padding: 6px 8px;
  }
  td { padding: 7px 8px; border-bottom: 1px solid #f4f4f5; }
  th.amount, td.amount { text-align: right; white-space: nowrap; }
  td.center { text-align: center; }
  .totals { margin-top: 20px; margin-left: auto; width: 280px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand {
    border-top: 2px solid #18181b;
    margin-top: 6px;
    padding-top: 8px;
    font-size: 15px;
    font-weight: 700;
  }
  .discount { color: #047857; }
  .foot { margin-top: 40px; border-top: 1px solid #e4e4e7; padding-top: 12px; color: #a1a1aa; font-size: 11px; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
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
        <div class="doc-title">PAYMENT RECEIPT</div>
        <div class="doc-meta">
          ${escapeHtml(receiptNo)}<br />
          Issued ${escapeHtml(formatIssuedAt(issuedAt))}
        </div>
      </div>
    </div>

    <div class="cols">
      <div>
        <div class="col-label">Billed to</div>
        ${partyRows}
      </div>
      <div class="right">
        <div class="col-label">Term</div>
        <div>${escapeHtml(termLine(bill))}</div>
        <div class="muted">Bill #${escapeHtml(String(bill.id))}</div>
      </div>
    </div>

    <table>
      <caption>Fee breakdown</caption>
      <thead>
        <tr><th>Description</th><th class="amount">Amount</th></tr>
      </thead>
      <tbody>
        ${itemRows || `<tr><td colspan="2" class="muted center">No fee items.</td></tr>`}
      </tbody>
    </table>

    <table>
      <caption>Payments received</caption>
      <thead>
        <tr>
          <th>Date</th><th>Method</th><th>Reference</th><th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
      </tbody>
    </table>

    <div class="totals">
      <div class="row"><span class="muted">Gross total</span><span>${formatPeso(bill.total)}</span></div>
      ${
        bill.discountTotal > 0
          ? `<div class="row discount"><span>Discounts</span><span>− ${formatPeso(bill.discountTotal)}</span></div>`
          : ""
      }
      <div class="row"><span class="muted">Net total</span><span>${formatPeso(bill.netTotal)}</span></div>
      <div class="row"><span class="muted">Total paid</span><span>${formatPeso(totalReceived)}</span></div>
      <div class="row grand"><span>Balance</span><span>${formatPeso(bill.balance)}</span></div>
    </div>

    <div class="foot">
      This is a system-generated receipt and does not require a signature.
      Generated on ${escapeHtml(formatIssuedAt(issuedAt))}.
    </div>
  </div>
</body>
</html>`;
}

// Render the receipt in a hidden iframe and open the browser's print dialog,
// from which the user can print or "Save as PDF". Using an iframe (rather than
// window.open) avoids popup blockers and a visible blank window.
export function printBillReceipt(bill: Bill, party: ReceiptParty): void {
  const html = buildBillReceiptHtml(bill, party);
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
    // Leave the frame long enough for the print dialog to read it, then remove.
    window.setTimeout(() => frame.remove(), 60_000);
  };
  window.document.body.appendChild(frame);
}
