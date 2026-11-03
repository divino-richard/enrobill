import { printBrand } from '@/lib/print-brand';
import { formatPeso } from "@/lib/money";
import { paymentMethodLabel, type Bill } from "./types";
import { approvedChargeLines, droppingAssessmentContext } from './dropping-statement';
import { isDroppingBill } from './collection';
import { appliedCreditLines } from './credits';

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
  return bill.schoolYear ? `SY ${bill.schoolYear}` : "—";
}

type BillDocumentKind = 'receipt' | 'statement';

export function billDocumentKind(bill: Bill): BillDocumentKind | null {
  if (bill.amountPaid > 0) return 'receipt';
  return bill.amountPaid === 0 && bill.balance === 0 ? 'statement' : null;
}

export function buildBillReceiptHtml(bill: Bill, party: ReceiptParty): string {
  return buildBillDocumentHtml(bill, party, 'receipt');
}

export function buildBillDocumentHtml(bill: Bill, party: ReceiptParty, kind: BillDocumentKind): string {
  const isStatement = kind === 'statement';
  const title = isStatement ? 'Statement of account' : 'Payment receipt';
  const issuedAt = new Date();
  const dropping = isDroppingBill(bill);
  const approvedLines = approvedChargeLines(bill);
  const reference = `${isStatement ? 'SOA' : 'REC'}-${String(bill.id).padStart(6, "0")}`;
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

  const originalItemRows = bill.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td class="amount">${formatPeso(item.amount)}</td>
        </tr>`,
    )
    .join("");

  const itemRows = dropping ? approvedLines.map(line => `<tr>
    <td>${escapeHtml(line.name)}<br /><span class="muted">${line.percent}% of ${formatPeso(line.base)}</span></td>
    <td class="amount">${formatPeso(line.amount)}</td></tr>`).join('') || `<tr><td colspan="2">${bill.droppingAssessment
      ? 'The approved total is recorded below. An itemized breakdown was not retained with this approval.'
      : 'No saved dropping assessment. The original enrollment balance is retained for review.'}</td></tr>` : originalItemRows;

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

  const adjustmentRows = (bill.adjustments ?? [])
    .map((adjustment) => {
      const reasons = adjustment.reasons?.length
        ? `<br /><span class="muted">Reason: ${escapeHtml(adjustment.reasons.join(" + "))}</span>`
        : "";
      return `
        <tr>
          <td>${escapeHtml(adjustment.label)}${reasons}</td>
          <td class="amount">${bill.droppingAssessment ? "" : "− "}${formatPeso(adjustment.amount)}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title} ${reference}</title>
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
      ${printBrand}
      <div>
        <div class="doc-title">${title.toUpperCase()}</div>
        <div class="doc-meta">
          ${reference}<br />
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
      <caption>${dropping ? 'Approved dropping charges' : 'Fee breakdown'}</caption>
      <thead>
        <tr><th>Description</th><th class="amount">Amount</th></tr>
      </thead>
      <tbody>
        ${itemRows || `<tr><td colspan="2" class="muted center">No fee items.</td></tr>`}
      </tbody>
    </table>

    ${bill.droppingAssessment ? `<p class="muted">${escapeHtml(droppingAssessmentContext(bill))} · Effective ${escapeHtml(bill.droppingAssessment.effectiveDate)} · Approved policy v${bill.droppingAssessment.policyVersion ?? '—'}</p>` : ''}

    ${
      !dropping && adjustmentRows
        ? `<table>
      <caption>${bill.droppingAssessment ? "Historical vouchers and incentives (not deducted again)" : "Credits applied"}</caption>
      <thead><tr><th>Credit</th><th class="amount">Amount</th></tr></thead>
      <tbody>${adjustmentRows}</tbody>
    </table>`
        : ""
    }

    ${isStatement ? '' : `<table>
      <caption>Payments received</caption>
      <thead>
        <tr>
          <th>Date</th><th>Method</th><th>Reference</th><th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
      </tbody>
    </table>`}

    <div class="totals">
      ${!dropping ? `<div class="row"><span class="muted">Gross total</span><span>${formatPeso(bill.total)}</span></div>` : ''}
      ${
        !bill.droppingAssessment && bill.discountTotal > 0
          ? `<div class="row discount"><span>Credits</span><span>− ${formatPeso(bill.discountTotal)}</span></div>`
          : ""
      }
      <div class="row"><span class="muted">${bill.droppingAssessment ? "Approved dropping charge" : dropping ? "Recorded assessment" : "Net total"}</span><span>${formatPeso(bill.netTotal)}</span></div>
      ${appliedCreditLines(bill, 'Student credit used').map(credit => `<div class="row"><span>${escapeHtml(credit.label)}</span><span>${formatPeso(credit.amount)}</span></div>`).join('')}
      ${(bill.creditIssued ?? 0) > 0 ? `<div class="row"><span>Credit issued for future enrollment</span><span>${formatPeso(bill.creditIssued ?? 0)}</span></div>` : ""}
      <div class="row"><span class="muted">Verified payments</span><span>${formatPeso(totalReceived)}</span></div>
      <div class="row grand"><span>Remaining balance</span><span>${formatPeso(bill.balance)}</span></div>
    </div>

    ${dropping ? `<section style="margin-top:40px; break-before:page">
      <h2>Financial history</h2>
      <p class="muted">Original enrollment records retained for reference. These are not additional dropping charges.</p>
      <table><caption>Original enrollment fees · ${formatPeso(bill.total)}</caption><thead><tr><th>Description</th><th class="amount">Original amount</th></tr></thead><tbody>${originalItemRows}</tbody></table>
      ${adjustmentRows ? `<table><caption>Historical vouchers and incentives (not deducted again)</caption><thead><tr><th>Award</th><th class="amount">Amount</th></tr></thead><tbody>${adjustmentRows}</tbody></table>` : ''}
    </section>` : ''}

    <div class="foot">
      ${isStatement ? 'This bill is fully settled. No payment is due.' : 'This is a system-generated receipt and does not require a signature.'}
      Generated on ${escapeHtml(formatIssuedAt(issuedAt))}.
    </div>
  </div>
</body>
</html>`;
}

// Render the document in a hidden iframe and open the browser's print dialog,
// from which the user can print or "Save as PDF". Using an iframe (rather than
// window.open) avoids popup blockers and a visible blank window.
export function printBillDocument(bill: Bill, party: ReceiptParty): void {
  const kind = billDocumentKind(bill);
  if (!kind) return;
  const html = buildBillDocumentHtml(bill, party, kind);
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
