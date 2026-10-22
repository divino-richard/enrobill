import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { default: BillDetailPage } = await server.ssrLoadModule('/src/pages/admin/bill-detail-page.tsx');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const { formatBillDate, paymentDecisions, paymentDecisionCopy, upcomingInstallments } = await server.ssrLoadModule('/src/features/bills/staff-billing.ts');
const { PaymentReviewDetails, PaymentDecisionConfirmation, PaymentProofPreview } = await server.ssrLoadModule('/src/features/bills/components/staff-payment-review.tsx');
const { AlertDialog } = await server.ssrLoadModule('/src/components/ui/alert-dialog.tsx');
const { StaffBillSummary, StaffInstallmentPlan } = await server.ssrLoadModule('/src/features/bills/components/staff-bill-reference.tsx');

const payment = { id: 8, amount: 170, method: 'gcash', status: 'pending', reference: '000123', paidAt: '2026-10-05', note: 'Tuition deposit', submittedBy: 'Test Student', proofUrl: '/proof.png' };
const bill = {
  id: 6, studentId: 5, schoolYearId: 1, schoolYear: '2026-2027', status: 'unpaid', collectionState: 'standard',
  total: 18421.25, netTotal: 18421.25, discountTotal: 0, amountPaid: 0, balance: 18421.25, amountDue: 170,
  student: { id: 5, name: 'Test Student', studentNumber: '2026-00005', track: 'gas', yearLevel: 'grade_11' },
  items: [{ id: 1, name: 'Tuition Fee', amount: 18421.25 }], payments: [payment], adjustments: [],
  installments: [
    { id: 1, sequence: 1, label: 'Down payment', dueDate: '2026-10-05', status: 'overdue', amount: 170, amountPaid: 0, balance: 170 },
    ...Array.from({ length: 5 }, (_, index) => ({ id: index + 2, sequence: index + 2, label: `Installment ${index + 1}`, dueDate: `2027-0${index + 1}-05`, status: 'unpaid', amount: 1000, amountPaid: 0, balance: 1000 })),
  ],
};

function renderBill(input = bill, role = 'cashier') {
  const user = { id: 20, role };
  useAuthStore.setState({ user });
  Object.assign(useAuthStore.getInitialState(), { user });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['admin', 'bills', 'detail', input.id], input);
  client.setQueryData(['programs'], []);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, { initialEntries: [`/admin/billing/${input.id}`] }, createElement(Routes, null,
      createElement(Route, { path: '/admin/billing/:id', element: createElement(BillDetailPage) })))));
  client.clear();
  return html;
}

test('pending review stays in Payments without reducing verified totals or balance', () => {
  const html = renderBill();
  const balance = html.match(/<section aria-label="Bill balance"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.doesNotMatch(html, /pending-payment-heading|1 payment to verify|Awaiting verification;/);
  assert.equal((html.match(/>Review payment</g) ?? []).length, 1);
  assert.ok(html.indexOf('>Payments</h2>') < html.indexOf('>Installment plan</h2>'));
  assert.match(balance, /Balance<\/dt><dd[^>]*><span[^>]*>₱18,421\.25/);
  assert.match(balance, />Unpaid</);
  assert.doesNotMatch(html.slice(0, html.indexOf('Bill balance')), />Unpaid</);
  assert.match(balance, /Due now<\/dt><dd[^>]*>₱170\.00/);
  assert.match(balance, /Verified payments<\/dt><dd[^>]*>₱0\.00/);
  assert.doesNotMatch(html, /₱18,251\.25|Student credit applied|Outstanding|Net bill|Net total|Balance due/);
  const recordButtons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].filter(([button]) => button.includes('Record payment'));
  assert.equal(recordButtons.length, 1);
  assert.match(recordButtons[0][0], /disabled=""/);
  assert.ok(html.indexOf('Record payment') > html.indexOf('>Payments</h2>'));
  assert.ok(html.indexOf('Record payment') < html.indexOf('Payments awaiting verification'));
  assert.doesNotMatch(html, /pending-payment-guidance|Review pending payments before recording another/);
  assert.doesNotMatch(html, /Receipt available after a verified payment|receipt-guidance/);
  const pendingRow = html.match(/<ul aria-label="Payments awaiting verification"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
  for (const value of ['GCash', 'Oct 5, 2026', 'Ref. 000123', 'Submitted by Test Student']) {
    assert.ok(pendingRow.includes(value), value);
  }
});

test('reference details stay available without an empty voucher card or expanded fee list', () => {
  const html = renderBill();
  assert.match(html, /No vouchers or incentives applied/);
  assert.doesNotMatch(html, /<h2[^>]*>Vouchers and incentives|hover:bg-muted cursor-pointer/);
  assert.match(html, /<details[^>]*><summary[^>]*>Fee breakdown/);
  assert.doesNotMatch(html, /<details[^>]*open[^>]*><summary[^>]*>Fee breakdown/);
  assert.match(html, /Tuition Fee/);
  assert.match(html, /aria-expanded="false"[^>]*aria-controls="bill-installments"/);
  assert.match(html, /View full schedule \(6\)/);
  assert.doesNotMatch(html, /Installment 3/);
});

test('admins can inspect pending payments without any cashier record control', () => {
  const html = renderBill(bill, 'admin');
  assert.match(html, /Only cashiers can record, verify, or reject/);
  assert.match(html, />View details</);
  assert.doesNotMatch(html, />Record payment<|>Review payment<|>Verify payment<|>Reject payment</);
  assert.doesNotMatch(html, /Classify fees|Original bill fees|Legacy classification/);
});

test('settled bills distinguish credit from payments and keep the receipt available', () => {
  const html = renderBill({ ...bill, status: 'paid', balance: 0, amountDue: 0, amountPaid: 170, creditApplied: 18251.25, payments: [{ ...payment, status: 'verified' }] });
  assert.match(html, /Student credit applied/);
  assert.match(html, /₱18,251\.25/);
  assert.doesNotMatch(html, /payment to verify|Receipt available after/);
  assert.match(html, />Print receipt</);
  assert.match(html, /<ul aria-label="Payment history"[^>]*>[\s\S]*?>View details<[\s\S]*?<\/ul>/);
  assert.doesNotMatch(html, /<summary[^>]*>Payment history/);
  const empty = renderBill({ ...bill, payments: [], balance: 0, amountDue: 0, status: 'paid' });
  assert.match(empty, /No payment records. This bill has no remaining balance/);
});

test('returning credits appear once in Bill summary and student account history is absent from staff bills', () => {
  const creditHistory = [{ id: 1, sourceBillId: 6, kind: 'returning_student', label: 'Returning student credit',
    amount: 2100, allocated: 2100, remaining: 0, allocations: [{ id: 1, billId: 8, amount: 2100, releasedAmount: 0 }] }];
  const html = renderBill({ ...bill, id: 8, payments: [], amountDue: 0, balance: 16321.25, creditApplied: 2100,
    appliedCredits: [{ kind: 'returning_student', label: 'Returning student credit', amount: 2100 }], creditHistory });
  assert.equal((html.match(/Returning student credit/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Student account|Student credit history|Previous balance|Available student credit/);
  const summary = html.slice(html.indexOf('>Bill summary</h2>'), html.indexOf('>Installment plan</h2>'));
  assert.match(summary, /Returning student credit<\/dt><dd[^>]*>−₱2,100\.00/);
  assert.match(summary, /Remaining balance<\/dt><dd[^>]*>₱16,321\.25/);
  assert.doesNotMatch(summary, /Verified payments|Bill total/);
  const topBalance = html.match(/<section aria-label="Bill balance"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.doesNotMatch(topBalance, /Returning student credit|₱2,100\.00/);

  const source = renderBill({ ...bill, collectionState: 'deferred_until_reenrollment', enrollmentStatus: 'dropped',
    netTotal: 2100, amountPaid: 2100, balance: 0, amountDue: 0, creditIssued: 100, payments: [], historicalInstallments: [], creditHistory });
  assert.match(source, /Original billing details/);
  assert.match(source, /Original fees/);
  assert.doesNotMatch(source, /Student account|Student credit history|Returning student credit|Available student credit|history for credit allocations/);
  assert.doesNotMatch(source, /href="\/admin\/billing\/8"/);
});

test('bill summary itemizes vouchers, mixed credits, and verified payments without changing their totals', () => {
  const input = { ...bill, discountTotal: 1000, netTotal: 17421.25, creditApplied: 3000, amountPaid: 500, balance: 13921.25,
    appliedCredits: [
      { kind: 'returning_student', label: 'Returning student credit', amount: 2100 },
      { kind: 'excess_payment', label: 'Excess payment credit', amount: 900 },
    ] };
  const html = renderToStaticMarkup(createElement(StaffBillSummary, { bill: input }));
  const rows = [...html.matchAll(/<dt[^>]*>([^<]+)<\/dt><dd[^>]*>([^<]+)<\/dd>/g)].map(([, label, value]) => [label, value]);
  assert.deepEqual(rows.slice(0, 6), [
    ['Fees', '₱18,421.25'], ['Vouchers and incentives', '−₱1,000.00'],
    ['Returning student credit', '−₱2,100.00'], ['Excess payment credit', '−₱900.00'],
    ['Verified payments', '−₱500.00'], ['Remaining balance', '₱13,921.25'],
  ]);
  assert.match(html, /Fee breakdown/);
  assert.doesNotMatch(html, /Student account|Student credit history|Bill total/);
});

test('bill summary uses the server balance for unpaid, payment-only, credit-covered, and legacy bills', () => {
  for (const input of [
    { ...bill, appliedCredits: [], creditApplied: 0, amountPaid: 0 },
    { ...bill, appliedCredits: [], creditApplied: 0, amountPaid: 421.25, balance: 18000 },
    { ...bill, status: 'paid', creditApplied: 18421.25, amountPaid: 0, balance: 0,
      appliedCredits: [{ kind: 'returning_student', label: 'Returning student credit', amount: 18421.25 }] },
    { ...bill, creditApplied: 2100, amountPaid: 0, balance: 16321.25 },
  ]) {
    const html = renderToStaticMarkup(createElement(StaffBillSummary, { bill: input }));
    const expected = input.balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    assert.equal(html.match(/>Remaining balance<\/dt><dd[^>]*>([^<]+)<\/dd>/)?.[1], `₱${expected}`);
    if (input.amountPaid === 0) assert.doesNotMatch(html, /Verified payments/);
    if (input.creditApplied === 0) assert.doesNotMatch(html, /Returning student credit|Excess payment credit|Student credit applied/);
    if (input.appliedCredits === undefined) assert.match(html, /Student credit applied/);
    assert.doesNotMatch(html, /−₱0\.00/);
  }
});

test('multiple pending payments each keep one review action without a duplicate summary', () => {
  const html = renderBill({ ...bill, payments: [{ ...payment, amount: 0.1 }, { ...payment, id: 9, amount: 0.2 }] });
  assert.match(html, /id="review-payment-8"/);
  assert.match(html, /id="review-payment-9"/);
  assert.equal((html.match(/>Review payment</g) ?? []).length, 2);
  assert.doesNotMatch(html, /payments to verify|Review first payment|₱0\.30/);
});

test('dropping bills retain their collection notice and financial history after payments', () => {
  const html = renderBill({ ...bill, collectionState: 'deferred_until_reenrollment', enrollmentStatus: 'dropped', amountDue: 0, historicalInstallments: [] });
  assert.match(html, /Payable upon re-enrollment/);
  assert.match(html, /Original billing details/);
  assert.ok(html.indexOf('>Payments</h2>') < html.indexOf('>Charges and payments</h2>'));
  assert.doesNotMatch(html, />Installment plan<\/h2>/);
});

test('original billing details keep historical sections independently collapsed without nested disclosures', () => {
  const html = renderBill({ ...bill, collectionState: 'deferred_until_reenrollment', enrollmentStatus: 'dropped',
    adjustments: [{ id: 1, label: 'Original scholarship', amount: 500, type: 'fixed', value: 500 }],
    historicalInstallments: [{ id: 1, label: 'Original downpayment', amount: 170, dueDate: '2026-10-05' },
      { id: 2, label: 'Original installment', amount: 1520.93, dueDate: null }],
    paymentArrangement: { remarks: 'Approved before dropping', installments: [{ dueDate: '2026-12-05', amount: 1000 }] },
  });
  const history = html.match(/<section aria-labelledby="original-billing-heading"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(history);
  assert.ok(html.indexOf('>Charges and payments</h2>') < html.indexOf('>Original billing details</h2>'));
  const summaries = [...history.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)].map(([, content]) => content.replace(/<[^>]+>/g, ' '));
  assert.equal(summaries.length, 4);
  assert.match(summaries[0], /Original fees.*1 item.*₱18,421\.25/);
  assert.match(summaries[1], /Original discounts.*1 item/);
  assert.match(summaries[2], /Past installment schedule.*2 installments/);
  assert.match(summaries[3], /Previous payment arrangement.*1 installment/);
  let depth = 0;
  for (const [tag] of history.matchAll(/<\/?details\b[^>]*>/g)) {
    if (tag.startsWith('</')) depth -= 1;
    else { depth += 1; assert.doesNotMatch(tag, /\sopen(?:=|\s|>)/); }
    assert.ok(depth <= 1, 'Opening a historical section must not require another disclosure');
  }
  assert.equal(depth, 0);
  for (const value of ['Tuition Fee', 'Original scholarship', 'Original downpayment', 'Oct 5, 2026', 'No date recorded', 'Approved before dropping', 'Dec 5, 2026', '₱1,000.00']) assert.ok(history.includes(value), value);
  assert.doesNotMatch(history, /View original fees and schedules|No active payment schedule|Student account|Student credit history/);
});

test('original billing details omit unavailable historical sections', () => {
  const html = renderBill({ ...bill, collectionState: 'deferred_until_reenrollment', enrollmentStatus: 'dropped',
    items: [], adjustments: [], historicalInstallments: [], paymentArrangement: null });
  const history = html.match(/<section aria-labelledby="original-billing-heading"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(history, /No original fees recorded/);
  assert.doesNotMatch(history, /<details|Original discounts|Past installment schedule|Previous payment arrangement/);
});

test('payment review retains identifying context and references with leading zeroes', () => {
  const html = renderToStaticMarkup(createElement(PaymentReviewDetails, { bill, payment }));
  for (const text of ['₱170.00', 'GCash', 'Oct 5, 2026', '000123', 'Test Student', '2026-2027', 'Tuition deposit']) assert.ok(html.includes(text), text);
});

test('only pending payments have cashier decisions; resolved payments are view-only', () => {
  assert.deepEqual(paymentDecisions(payment, false), ['verify', 'reject']);
  assert.deepEqual(paymentDecisions(payment, true), []);
  for (const status of ['verified', 'rejected']) {
    assert.deepEqual(paymentDecisions({ ...payment, status }, false), []);
    assert.deepEqual(paymentDecisions({ ...payment, status }, true), []);
  }
});

test('confirmation describes consequences and locks all decisions during submission', () => {
  let calls = 0;
  for (const decision of ['verify', 'reject']) {
    const html = renderToStaticMarkup(createElement(AlertDialog, { open: true }, createElement(PaymentDecisionConfirmation, { decision, payment, busy: true, error: 'Unable to update payment. Try again.', onBack() { calls++; }, onConfirm() { calls++; } })));
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /role="alert"/);
    assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
    assert.ok(html.includes(paymentDecisionCopy(decision, payment).busy));
  }
  assert.equal(calls, 0);
  assert.match(paymentDecisionCopy('reject', payment).description, /will not reduce the balance/);
});

test('proof viewer handles images, PDFs and missing attachments without an external-open action', () => {
  const image = renderToStaticMarkup(createElement(PaymentProofPreview, { payment }));
  assert.match(image, /<img[^>]*src="\/proof.png"/);
  assert.match(image, /alt="Proof for ₱170.00 paid on Oct 5, 2026"/);
  const pdf = renderToStaticMarkup(createElement(PaymentProofPreview, { payment: { ...payment, proofUrl: '/proof.PDF?signature=test' } }));
  assert.match(pdf, /<iframe[^>]*title="Payment proof document"/);
  const empty = renderToStaticMarkup(createElement(PaymentProofPreview, { payment: { ...payment, proofUrl: null } }));
  assert.match(empty, /No proof is attached/);
  assert.doesNotMatch(image + pdf + empty, /Open original|target="_blank"/);
});

test('schedule prioritizes unpaid obligations, keeps server-calculated remaining amounts, and formats dates', () => {
  const plan = [{ ...bill.installments[1], status: 'paid', balance: 0 }, { ...bill.installments[0], status: 'partial', balance: 70, amountPaid: 100 }, bill.installments[2]];
  assert.deepEqual(upcomingInstallments(plan).map(item => item.id), [1, 3]);
  const html = renderToStaticMarkup(createElement(StaffInstallmentPlan, { bill: { ...bill, installments: plan } }));
  assert.match(html, /₱70\.00/);
  assert.doesNotMatch(html, /Remaining of|₱170\.00/);
  assert.match(html, /Due Oct 5, 2026/);
  assert.equal(formatBillDate(null), '—');
  assert.equal(formatBillDate('invalid'), '—');
  assert.equal(formatBillDate('2026-10-04T16:30:00Z'), 'Oct 5, 2026');
});

test('staff bills omit the student referral banner while keeping payment restrictions', () => {
  const guarded = { ...bill, payments: [], referralPaymentGuard: { reason: 'referral_pending', message: 'Your referral benefit is reserved. Do not send a payment while this hold is active.' } };
  const html = renderBill(guarded);
  assert.doesNotMatch(html, /Referral benefit reserved|Your referral benefit|Do not send a payment/);
  assert.doesNotMatch(renderBill(guarded, 'admin'), /Referral benefit reserved|Your referral benefit|Do not send a payment/);
  const record = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(([button]) => button.includes('Record payment'))?.[0];
  assert.ok(record);
  assert.match(record, /^<button[^>]*disabled=""/);
  assert.doesNotMatch(html, /Use Record payment when the school receives/);
  assert.deepEqual(paymentDecisions(payment, false, guarded.referralPaymentGuard), ['reject']);
  assert.deepEqual(paymentDecisions(payment, true, guarded.referralPaymentGuard), []);
  assert.deepEqual(paymentDecisions(payment, false, null), ['verify', 'reject']);
  assert.match(paymentDecisionCopy('reject', payment, guarded.referralPaymentGuard).description, /New payments remain on hold/);
});
