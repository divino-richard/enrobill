import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { BillCard } = await server.ssrLoadModule('/src/features/bills/components/bill-card.tsx');
const { buildBillReceiptHtml } = await server.ssrLoadModule('/src/features/bills/receipt.ts');
const bill = {
  id: 2, studentId: 5, schoolYear: '2026-2027', status: 'partial', collectionState: 'standard',
  total: 1300, discountTotal: 300, netTotal: 1000, amountPaid: 100, creditApplied: 100, balance: 800, amountDue: 250,
  items: [{ id: 1, name: 'Tuition', amount: 800 }, { id: 2, name: 'Registration', amount: 500 }],
  payments: [{ id: 1, amount: 100, status: 'verified' }, { id: 2, amount: 100, status: 'pending' }],
};
const dropped = {
  ...bill, collectionState: 'deferred_until_reenrollment', enrollmentStatus: 'dropped',
  total: 18421.25, discountTotal: 18421.25, netTotal: 2100, amountPaid: 170, creditApplied: 0, balance: 1930, amountDue: 0,
  items: [{ id: 1, name: 'Original tuition', amount: 18421.25 }],
  droppingAssessment: {
    category: 'paying', period: 'quarter_1', finalCharge: 2100, originalTotal: 18421.25,
    feeCharges: [{ name: 'Laboratory', originalAmount: 1600, percent: 100 }, { name: 'Registration', originalAmount: 500, percent: 100 }],
  },
};

function renderBill(input = bill, errorStatus) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, retryOnMount: false } } });
  const queryKey = ['admin', 'students', 5, 'bill'];
  if (errorStatus) {
    client.getQueryCache().build(client, { queryKey }).setState({
      status: 'error', fetchStatus: 'idle', error: { isAxiosError: true, response: { status: errorStatus } },
    });
  } else {
    client.setQueryData(queryKey, input);
  }
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(BillCard, { studentId: 5 }))));
  client.clear();
  return html;
}

test('student billing distinguishes the balance from installments and pending payments', () => {
  const html = renderBill();
  const balance = html.match(/<section aria-label="Balance"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(balance, /Remaining balance/);
  assert.match(balance, /₱800\.00/);
  assert.match(balance, /Due now[\s\S]*?₱250\.00/);
  assert.match(html, /1 payment awaiting verification/);
  assert.match(html, /Vouchers and incentives/);
  assert.match(html, /Verified payments/);
  assert.match(html, /Student credit applied/);
  assert.match(html, /href="\/admin\/billing\/2"/);
  assert.doesNotMatch(html, /₱700\.00|Net total|Outstanding balance|View bill and installment plan/);
});

test('dropping bills show approved charges without deducting historical vouchers again', () => {
  const html = renderBill(dropped);
  for (const text of ['Dropping bill', 'Payable upon re-enrollment', 'Approved dropping charge', 'First quarter · Paying', 'Laboratory', 'Registration', '₱2,100.00', '₱1,930.00']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Original tuition|18,421\.25|Vouchers and incentives|Due now/);
});

test('missing or inconsistent dropping breakdowns do not substitute original fees', () => {
  for (const assessment of [null, { ...dropped.droppingAssessment, finalCharge: 100 }]) {
    const html = renderBill({ ...dropped, droppingAssessment: assessment });
    assert.match(html, /No itemized dropping assessment is on file/);
    assert.match(html, /₱2,100\.00/);
    assert.doesNotMatch(html, /Original tuition|Laboratory|Registration|Vouchers and incentives/);
  }
});

test('credit-covered bills remain settled without treating credits as verified payments', () => {
  const html = renderBill({ ...bill, status: 'paid', amountPaid: 0, creditApplied: 1000, balance: 0, amountDue: 0, payments: [] });
  assert.match(html, /No remaining balance/);
  assert.match(html, /Verified payments<\/dt><dd[^>]*>₱0\.00/);
  assert.match(html, /Student credit applied/);
  assert.doesNotMatch(html, /Due now|-₱0\.00|awaiting verification/);
});

test('returning student credit is itemized separately from excess payments and cash on bills and receipts', () => {
  const input = { ...bill, total: 18421.25, netTotal: 18421.25, discountTotal: 0, amountPaid: 0,
    creditApplied: 3000, balance: 15421.25, payments: [], appliedCredits: [
      { kind: 'excess_payment', label: 'Excess payment credit', amount: 900 },
      { kind: 'returning_student', label: 'Returning student credit', amount: 2100 },
    ] };
  const html = renderBill(input);
  assert.match(html, /Returning student credit<\/dt><dd[^>]*>-₱2,100\.00/);
  assert.match(html, /Excess payment credit<\/dt><dd[^>]*>-₱900\.00/);
  assert.match(html, /Verified payments<\/dt><dd[^>]*>₱0\.00/);
  assert.match(html, /₱15,421\.25/);
  assert.doesNotMatch(html, /Student credit applied|₱3,000\.00/);
  const receipt = buildBillReceiptHtml(input, { name: 'Returning Student' });
  assert.match(receipt, /Returning student credit<\/span><span>₱2,100\.00/);
  assert.match(receipt, /Excess payment credit<\/span><span>₱900\.00/);
  assert.match(receipt, /Verified payments<\/span><span>₱0\.00/);
  assert.match(receipt, /Remaining balance<\/span><span>₱15,421\.25/);
});

test('long fee lists keep additional items accessible with a labeled disclosure', () => {
  const items = Array.from({ length: 21 }, (_, index) => ({ id: index, name: `Fee ${index + 1}`, amount: 100 }));
  const html = renderBill({ ...bill, items });
  assert.match(html, /View all 21 fees/);
  const target = html.match(/aria-expanded="false" aria-controls="([^"]+)"/)?.[1];
  assert.ok(target);
  assert.ok(html.includes(`id="${target}"`));
  assert.match(html, />Fee 4</);
  assert.doesNotMatch(html, />Fee 5</);
});

test('billing errors offer retry while unbilled students have an enrollment link', () => {
  const error = renderBill(null, 500);
  assert.match(error, /Billing unavailable/);
  assert.match(error, /role="alert"/);
  assert.match(error, /Try again/);
  assert.doesNotMatch(error, /Not billed yet|₱0\.00/);
  const missing = renderBill(null, 404);
  assert.match(missing, /Not billed yet/);
  assert.match(missing, /href="\/admin\/enrollments"/);
  assert.doesNotMatch(missing, /Billing unavailable|Try again/);
});
