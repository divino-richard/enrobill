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
const { PendingRequestCharges } = await server.ssrLoadModule('/src/features/dropping/pending-request-charges.tsx');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const { philippinesToday } = await server.ssrLoadModule('/src/features/dropping-finance/api.ts');

const request = {
  id: 1, reference: 'DROP-000001', enrollmentId: 1, studentId: 1, packetVersion: 1,
  status: 'submitted', snapshot: { studentName: 'Review Student', studentNumber: '2026-001', schoolYear: '2026-2027', program: 'gas', yearLevel: 'grade_11' },
  balance: 10000, billId: 12, reason: 'Moving to another city.',
  droppingCategory: 'paying', droppingAssessment: null, financialSummary: null,
  submissions: [{ version: 1, submittedAt: '2026-10-05T10:00:00Z', reason: 'Moving to another city.', files: [{ id: 'file-1', name: 'signed-form.pdf', mime: 'application/pdf', size: 1024 }] }],
  events: [{ action: 'submitted', actorName: 'Review Student', at: '2026-10-05T10:00:00Z', remarks: null }],
  effectiveDate: null, confirmedAt: null, finalRemarks: null, createdAt: '2026-10-05T09:00:00Z',
};
const assessment = {
  ready: true, issues: [], blockingIssues: [], fingerprint: 'current', policyVersion: 1,
  period: 'quarter_2', category: 'paying', effectiveDate: philippinesToday(),
  originalTotal: 10000, finalCharge: 6000, verifiedPayments: 1000, balance: 5000, credit: 0, feeBreakdown: {},
};
function renderReview(value, role = 'admin', changes = {}) {
  useAuthStore.setState({ user: { role } });
  Object.assign(useAuthStore.getInitialState(), { user: { role } });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['dropping', 1], { ...request, ...changes });
  client.setQueryData(['dropping-assessment', 1, philippinesToday()], value);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, { initialEntries: ['/admin/dropping-requests/1'] },
      createElement(Routes, null, createElement(Route, { path: '/admin/dropping-requests/:id', element: createElement(DroppingPage) })))));
  client.clear();
  return html;
}

test('incomplete setup exposes one recovery action and keeps its checklist closed', () => {
  const html = renderReview({ ...assessment, ready: false,
    issues: ['Policy disabled', 'Invalid periods', 'Unclassified fees'],
    blockingIssues: [{ category: 'policy', messages: ['Policy disabled', 'Invalid periods'] }, { category: 'fees', messages: ['Unclassified fees'] }],
  });
  assert.match(html, /href="\/admin\/billing\/12"/);
  assert.match(html, /<button[^>]*aria-haspopup="dialog"[^>]*>Resolve setup/);
  assert.doesNotMatch(html, /Policy disabled|Invalid periods|Unclassified fees|>Approve</);
  assert.match(html, /Preview signed-form.pdf/);
  assert.match(html, /aria-label="More request actions"/);
  assert.doesNotMatch(html, /Return for correction|Reject request/);
  assert.match(html, /<aside[^>]*aria-labelledby="request-activity-title"/);
  assert.doesNotMatch(html, /<details[^>]*aria-label="Request history"/);
});

test('a date-only issue still lets the reviewer choose an effective date', () => {
  const html = renderReview({ ...assessment, ready: false, issues: ['Choose an effective date'], blockingIssues: [{ category: 'date', messages: ['Choose an effective date'] }] });
  const button = html.match(/<button[^>]*>Approve<\/button>/)?.[0];
  assert.ok(button);
  assert.doesNotMatch(button, / disabled=""/);
});

test('ready financial review shows the estimate and allows approval review', () => {
  const html = renderReview(assessment);
  const button = html.match(/<button[^>]*>Approve<\/button>/)?.[0];
  assert.ok(button);
  assert.doesNotMatch(button, / disabled=""/);
  assert.match(html, /6,000\.00/);
  assert.match(html, /5,000\.00/);
  assert.match(html, /Fee policy/);
  assert.match(html, /Paying/);
  assert.match(html, /href="\/admin\/billing\/12"/);
  assert.doesNotMatch(html, /request-status-title|Review the documents and charges before approving/);
  assert.ok(html.indexOf('Documents submitted') < html.indexOf('estimated-charges-title'));
  assert.equal((html.match(/₱5,000\.00/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Financial summary|Current balance|Calculation details|₱10,000\.00/);
});

test('cashiers cannot approve or access administrator policy setup', () => {
  const html = renderReview({ ...assessment, ready: false, issues: ['Policy disabled'], blockingIssues: [{ category: 'policy', messages: ['Policy disabled'] }] }, 'cashier');
  assert.doesNotMatch(html, />Approve<|href="\/admin\/terms"/);
  assert.match(html, /View setup/);
});

test('admin-initiated approval records its reason and actor without suggesting missing documents', () => {
  const html = renderReview(assessment, 'admin', {
    status: 'confirmed', packetVersion: 0, submissions: [],
    snapshot: { ...request.snapshot, initiatedBy: 'admin' },
    reason: 'Student could not be reached.',
    droppingAssessment: { ...assessment, finalized: true },
    effectiveDate: philippinesToday(),
    events: [{ action: 'confirmed', actorName: 'Registrar', actorRole: 'admin', at: '2026-10-05T10:00:00Z', remarks: null }],
  });
  assert.match(html, /Initiated by administrator/);
  assert.match(html, /No signed form required/);
  assert.match(html, /Student could not be reached/);
  assert.match(html, /Registrar · Administrator/);
  assert.doesNotMatch(html, /Documents have not been submitted|Update documents|Submit request|>Approve<|Cancel request/);
});

test('student document corrections remain student-owned', () => {
  for (const role of ['admin', 'cashier']) {
    assert.doesNotMatch(renderReview(assessment, role, { status: 'needs_correction' }), /Update documents|Submit request/);
  }
});

test('approved staff requests use frozen charges and current payments while retaining admin actions', () => {
  const html = renderReview(assessment, 'admin', {
    status: 'confirmed', effectiveDate: '2026-10-05', finalRemarks: 'Approved by registrar.',
    events: [...request.events, { action: 'confirmed', actorName: 'Registrar', at: '2026-10-05T11:00:00Z', remarks: 'Approved by registrar.' }],
    droppingAssessment: { ...assessment, finalized: true },
    financialSummary: { verifiedPayments: 2500, creditApplied: 500, balance: 3000, creditIssued: 200, availableCredit: 150 },
  });
  assert.doesNotMatch(html, /Download approval|Preparing approval|acknowledgment/);
  assert.match(html, /href="\/admin\/billing\/12"/);
  assert.match(html, /Approved by registrar/);
  assert.doesNotMatch(html, /aria-label="Approval (confirmation|details)"/);
  assert.match(html, /<aside[^>]*aria-labelledby="request-activity-title"/);
  assert.ok(html.indexOf('request-activity-title') < html.indexOf('approved-charges-title'));
  assert.match(html, /₱6,000\.00/);
  assert.match(html, /-₱2,500\.00/);
  assert.match(html, /-₱500\.00/);
  assert.match(html, /₱3,000\.00/);
  assert.match(html, /Available student credit:.*₱150\.00/);
  assert.doesNotMatch(html, />Approve<|estimated-charges-title|₱5,000\.00|View return options/);
});

test('legacy staff approvals retain the recorded bill instead of today’s estimate', () => {
  const html = renderReview(assessment, 'admin', {
    status: 'confirmed', droppingAssessment: { ...assessment, legacy: true, finalCharge: null }, balance: 4200,
  });
  assert.match(html, /Recorded remaining balance/);
  assert.match(html, /₱4,200\.00/);
  assert.match(html, /href="\/admin\/billing\/12"/);
  assert.doesNotMatch(html, /₱6,000\.00|estimated-charges-title|>Approve</);
});

test('closed staff requests retain bill access and activity without calculating charges', () => {
  for (const status of ['cancelled', 'rejected']) {
    const html = renderReview(assessment, 'admin', { status,
      events: [...request.events, { action: status, actorName: 'Registrar', at: '2026-10-06T10:00:00Z', remarks: 'Request closed after review.' }],
    });
    assert.match(html, /aria-labelledby="request-activity-title"/);
    assert.match(html, /Request closed after review/);
    assert.match(html, /href="\/admin\/billing\/12"/);
    assert.doesNotMatch(html, /estimated-charges-title|approved-charges-title|>Approve<|<section role="status"/);
  }
});

test('student review shows status and permanent activity before one separate charge estimate', () => {
  const html = renderReview(assessment, 'student', { balance: 0 });
  assert.match(html, /role="status"[^>]*aria-labelledby="request-status-title"/);
  assert.match(html, /Waiting for school approval/);
  assert.match(html, /Your enrollment stays active/);
  assert.match(html, /<aside[^>]*aria-labelledby="request-activity-title"/);
  assert.ok(html.indexOf('Reason for dropping') < html.indexOf('request-activity-title'));
  assert.ok(html.indexOf('Documents submitted') < html.indexOf('estimated-charges-title'));
  assert.match(html, /Balance<\/dt><dd[^>]*>₱5,000\.00/);
  assert.doesNotMatch(html, /Financial summary|Current balance|Calculation details|Original assessment|View bill|<details[^>]*aria-label="Request history"/);
  assert.equal((html.match(/₱5,000\.00/g) ?? []).length, 1);
});

test('unavailable student estimates do not expose staff setup or invented totals', () => {
  const html = renderReview({ ...assessment, ready: false, finalCharge: null, issues: ['Policy disabled'], blockingIssues: [{ category: 'policy', messages: ['Policy disabled'] }] }, 'student');
  assert.match(html, /The school will confirm the charges when reviewing your request/);
  assert.doesNotMatch(html, /Policy disabled|Setup required|Choose the effective date|₱/);
});

test('closed unapproved requests retain activity without a live charge estimate', () => {
  for (const status of ['cancelled', 'rejected']) {
    const html = renderReview(assessment, 'student', { status });
    assert.match(html, /aria-labelledby="request-activity-title"/);
    assert.doesNotMatch(html, /estimated-charges-title|Waiting for school approval/);
  }
});

test('student estimate reconciles fee percentages, payments and credit without duplicate balances', () => {
  const html = renderToStaticMarkup(createElement(PendingRequestCharges, {
    assessment: { ...assessment, finalCharge: 2100, verifiedPayments: 170, creditApplied: 500, balance: 1430,
      feeCharges: [{ billItemId: 1, name: 'Laboratory', originalAmount: 1600, percent: 100 }, { billItemId: 2, name: 'Registration', originalAmount: 1000, percent: 50 }] },
    loading: false, failed: false, onRetry() {},
  }));
  assert.match(html, /Laboratory/);
  assert.match(html, /50% of ₱1,000\.00/);
  assert.match(html, /Verified payments<\/dt><dd[^>]*>-₱170\.00/);
  assert.match(html, /Applied credits<\/dt><dd[^>]*>-₱500\.00/);
  assert.equal((html.match(/₱1,430\.00/g) ?? []).length, 1);
  assert.match(html, /Final charges depend on the approved dropping date/);
});

test('student estimate distinguishes failed and loading calculations from a zero balance', () => {
  const render = props => renderToStaticMarkup(createElement(PendingRequestCharges, { onRetry() {}, ...props }));
  const failed = render({ failed: true, loading: false });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Try again/);
  assert.doesNotMatch(failed, /₱0\.00|>Balance</);
  const loading = render({ failed: false, loading: true });
  assert.match(loading, /Loading charge estimate/);
  assert.doesNotMatch(loading, /₱0\.00|>Balance</);
});
