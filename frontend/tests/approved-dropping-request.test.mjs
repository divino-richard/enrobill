import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { default: DroppingPage } = await server.ssrLoadModule('/src/features/dropping/dropping-page.tsx');
const { default: ProgramsPage } = await server.ssrLoadModule('/src/pages/portal/programs-page.tsx');
const { DroppingReturnGuidance, ApprovedRequestCharges } = await server.ssrLoadModule('/src/features/dropping/approved-request.tsx');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const request = {
  id: 1, reference: 'DROP-000001', enrollmentId: 1, studentId: 1, packetVersion: 1,
  status: 'confirmed', snapshot: { studentName: 'Test Student', studentNumber: '2026-001', schoolYear: '2026-2027', program: 'gas', yearLevel: 'grade_11' },
  balance: 1930, billId: 12, reason: 'Moving.', droppingCategory: 'paying',
  droppingAssessment: {
    effectiveDate: '2026-10-07', period: 'quarter_1', category: 'paying', policyVersion: 26,
    originalTotal: 18000, finalCharge: 2100, verifiedPayments: 0, balance: 2100, credit: 0,
    feeCharges: [{ name: 'Laboratory', originalAmount: 1600, percent: 100, charge: 1600 }, { name: 'Registration', originalAmount: 500, percent: 100, charge: 500 }],
  },
  financialSummary: { verifiedPayments: 170, balance: 1930, creditApplied: 0, creditIssued: 0, availableCredit: 0 },
  submissions: [{ version: 1, submittedAt: '2026-10-05T10:00:00Z', reason: 'Moving.', files: [] }],
  events: [{ action: 'confirmed', actorName: 'Admin User', at: '2026-10-06T23:00:00Z', remarks: 'Approved note' }],
  effectiveDate: '2026-10-07', confirmedAt: '2026-10-06T23:00:00Z', finalRemarks: 'Approved note', createdAt: '2026-10-05T09:00:00Z',
};
const summary = {
  state: 'settlement_required', canStart: false, blockers: [],
  effectiveDroppingDate: '2026-10-07', returnDeadline: '2028-10-07',
  source: { id: 1, droppingRequestId: 1, billId: 12 },
  offer: { schoolYearId: 2, schoolYear: '2027-2028' }, enrollment: null, requirements: null,
  previousBills: [{ id: 12, schoolYear: '2026-2027', balance: 1930, pendingPayment: 0 }], availableCredit: 0,
};
function render(Component, props) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Component, props)));
}
function guidance(overrides = {}) {
  return render(DroppingReturnGuidance, { request, data: { ...summary, ...overrides } });
}

function renderPage(record = request, programPath, active = false, currentYear = active) {
  const user = { id: 7, role: 'student' };
  useAuthStore.setState({ user });
  Object.assign(useAuthStore.getInitialState(), { user });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['dropping', 1], record);
  client.setQueryData(['dropping', false], record ? [record] : []);
  client.setQueryData(['me', 'student'], { id: 1, status: active ? 'enrolled' : 'dropped', studentNumber: '2026-001', trackOrStrand: 'gas', yearLevel: 'grade_11' });
  client.setQueryData(['me', 'enrollments', 7], [{ id: 1, status: active ? 'enrolled' : 'dropped', isCurrent: currentYear, program: 'gas', yearLevel: 'grade_11', schoolYear: '2026-2027' }]);
  client.setQueryData(['me', 'documents'], []);
  client.setQueryData(['programs'], []);
  client.setQueryData(['me', 're-enrollment', 7], summary);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [programPath ?? '/portal/dropping-requests/1'] }, createElement(Routes, null,
    createElement(Route, { path: '/portal/dropping-requests/:id', element: createElement(DroppingPage) }),
    createElement(Route, { path: '/portal/programs', element: createElement(ProgramsPage) })))));
  client.clear();
  return html;
}

test('approved student request keeps the outcome, charge reconciliation and a single next action', () => {
  const html = renderPage();
  assert.match(html, /<h1[^>]*>Dropping request<\/h1>/);
  const titles = ['Dropped effective', 'Charges and payments', 'Settle your dropping balance to return', 'Submitted request', 'Reason for dropping', 'Request history'];
  for (let i = 1; i < titles.length; i++) assert.ok(html.indexOf(titles[i - 1]) < html.indexOf(titles[i]), titles[i]);
  assert.match(html, /Verified payments<\/dt><dd[^>]*>-₱170\.00/);
  assert.match(html, /Remaining balance<\/dt><dd[^>]*>₱1,930\.00/);
  assert.match(html, /Laboratory/);
  assert.match(html, /Registration/);
  assert.match(html, /Submitted on Oct 5, 2026/);
  assert.doesNotMatch(html, /Download approval|Your dropping request is approved|Original assessment history|Approved policy v26|Re-enrollment details|Calculation details|Financial summary/);
  assert.equal((html.match(/href="\/portal\/bills\/12"/g) ?? []).length, 1);
  assert.match(html, /<details[^>]*aria-label="Request details"><summary/);
  assert.doesNotMatch(html.match(/<details[^>]*aria-label="Request details">/)?.[0] ?? '', /open=/);
});

test('My Program keeps the request list in its tab and links to a standalone detail page', () => {
  const html = renderPage(request, '/portal/programs?section=dropping');
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*>.*?Dropping requests<\/button>/s);
  assert.match(html, /aria-label="Dropping requests"/);
  assert.match(html, /href="\/portal\/dropping-requests\/1"/);
  assert.doesNotMatch(html, /href="\/portal\/programs\?section=dropping&amp;request=1"/);
  assert.doesNotMatch(html, />Request to drop<\/button>/);
});

test('a direct request page stands alone and returns to the My Program dropping list', () => {
  const html = renderPage(request, '/portal/dropping-requests/1');
  assert.doesNotMatch(html, /Program information|role="tab"/);
  assert.match(html, /<h1[^>]*>Dropping request<\/h1>/);
  assert.match(html, /href="\/portal\/programs\?section=dropping"/);
  assert.match(html, /DROP-000001/);
  assert.match(html, /Charges and payments/);
  assert.match(html, /href="\/portal\/bills\/12"/);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
});

test('an invalid request parameter safely shows the dropping list', () => {
  const html = renderPage(request, '/portal/programs?section=dropping&request=invalid');
  assert.match(html, /aria-label="Dropping requests"/);
  assert.doesNotMatch(html, /Charges and payments|Unable to load this request/);
});

test('active students open an unsaved form directly without showing the requests table or a draft', () => {
  const html = renderPage(null, '/portal/programs?section=dropping&request=new', true);
  assert.match(html, /<h2[^>]*>Request to drop<\/h2>/);
  assert.match(html, /Reason for dropping/);
  assert.match(html, /Signed form and attachments/);
  assert.doesNotMatch(html, /Official form|Briefly explain|Keep your original documents|<h2[^>]*>Documents<\/h2>/);
  assert.match(html, /href="\/portal\/programs\?section=overview"/);
  assert.match(html, />Cancel<\/button>/);
  assert.match(html, /disabled=""[^>]*>Submit request<\/button>/);
  assert.doesNotMatch(html, /aria-label="Dropping requests"|DROP-000001|>Draft<|Cancel request/);
});

test('Overview offers dropping only for an enrolled record in the active school year', () => {
  assert.match(renderPage(null, '/portal/programs?section=overview', true), /aria-label="Enrollment options"/);
  assert.doesNotMatch(renderPage(null, '/portal/programs?section=overview', true, false), /aria-label="Enrollment options"/);
});

test('students without an active enrollment cannot use the new-request form', () => {
  const html = renderPage(null, '/portal/programs?section=dropping&request=new');
  assert.match(html, /No active enrollment to drop/);
  assert.doesNotMatch(html, /Submit request|Reason for dropping/);
});

test('the request list does not create requests even for active students', () => {
  const html = renderPage(null, '/portal/programs?section=dropping', true);
  assert.match(html, /No dropping requests found/);
  assert.doesNotMatch(html, />Request to drop<\/button>/);
});

test('effective date and school remarks stay visible while approval metadata stays in history', () => {
  const html = renderPage();
  assert.match(html, /Dropped effective<\/dt><dd[^>]*><time dateTime="2026-10-07">Oct 7, 2026/);
  assert.match(html, /School remarks<\/p><p[^>]*>Approved note/);
  assert.doesNotMatch(html, /Approved on<\/dt>|Approved by<\/dt>/);
  assert.match(html, /Admin User/);
  assert.match(renderPage({ ...request, effectiveDate: null }), /Effective dropping date not recorded — contact the school/);
});

test('current credit and verified payments reconcile without replacing the frozen approved charges', () => {
  const html = render(ApprovedRequestCharges, { request: { ...request, financialSummary: { ...request.financialSummary, verifiedPayments: 1000, creditApplied: 500, balance: 600 } } });
  assert.match(html, /Approved dropping charge<\/dt><dd[^>]*>₱2,100\.00/);
  assert.match(html, /Applied student credit<\/dt><dd[^>]*>-₱500\.00/);
  assert.match(html, /Remaining balance<\/dt><dd[^>]*>₱600\.00/);
});

test('missing or legacy assessments do not invent a dropping charge', () => {
  for (const droppingAssessment of [null, { ...request.droppingAssessment, legacy: true }]) {
    const html = render(ApprovedRequestCharges, { request: { ...request, droppingAssessment } });
    assert.match(html, /itemized dropping assessment was not saved/);
    assert.match(html, /Recorded remaining balance/);
    assert.doesNotMatch(html, /Approved dropping charge|Laboratory/);
  }
});

test('settlement directs the student to the unpaid bill before creating an enrollment', () => {
  const html = guidance();
  assert.match(html, /To start re-enrollment, settle your previous dropping balance first/);
  assert.match(html, /href="\/portal\/bills\/12"[^>]*>View bill &amp; payment options/);
  assert.match(html, /Complete re-enrollment by.*Oct 7, 2028/s);
});

test('a submitted partial payment shows verification guidance instead of requesting another payment', () => {
  const html = guidance({ previousBills: [{ ...summary.previousBills[0], pendingPayment: 500 }] });
  assert.match(html, /Payment verification pending/);
  assert.match(html, /Wait for verification before making another payment/);
  assert.match(html, /View payment status/);
  assert.doesNotMatch(html, /View bill &amp; payment options/);
});

test('eligibility blockers take precedence over unpaid balances and never suggest payment resolves them', () => {
  const html = guidance({ state: 'pending', requirements: { eligible: false, previousBalance: 1930 }, blockers: ['The return deadline has passed.'] });
  assert.match(html, /Re-enrollment needs attention/);
  assert.match(html, /Making a payment does not restore eligibility/);
  assert.match(html, /The return deadline has passed/);
  assert.doesNotMatch(html, /View bill &amp; payment options|href="\/portal\/bills/);
});

test('unavailable admissions keep payments voluntary; a settled eligible student can review a return', () => {
  assert.match(guidance({ state: 'unavailable' }), /No payment or clearance is required now. Early payments are voluntary/);
  const ready = guidance({ state: 'ready', previousBills: [] });
  assert.match(ready, /Admissions are open for SY 2027-2028/);
  assert.match(ready, /Review re-enrollment/);
});

test('settled pending returns distinguish awaiting a bill from a new bill payment', () => {
  const pending = { state: 'pending', previousBills: [], enrollment: { id: 2, billId: null } };
  assert.match(guidance(pending), /Waiting for your new bill/);
  const billed = guidance({ ...pending, enrollment: { id: 2, billId: 99 } });
  assert.match(billed, /href="\/portal\/bills\/99"[^>]*>View new bill/);
  assert.doesNotMatch(billed, /Settle your dropping balance/);
});

test('completed returns and earlier dropping records do not reimpose an old deadline', () => {
  const enrolled = guidance({ state: 'enrolled' });
  assert.match(enrolled, /You have returned to school/);
  assert.doesNotMatch(enrolled, /2028|Settle your dropping balance/);
  const old = guidance({ source: { ...summary.source, droppingRequestId: 5 } });
  assert.match(old, /Previous dropping record/);
  assert.doesNotMatch(old, /2028|Settle your dropping balance/);
});
