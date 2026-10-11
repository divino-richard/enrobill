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
function renderReview(value, role = 'admin') {
  useAuthStore.setState({ user: { role } });
  Object.assign(useAuthStore.getInitialState(), { user: { role } });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['dropping', 1], request);
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
  assert.doesNotMatch(html, /Policy disabled|Invalid periods|Unclassified fees|Review &amp; approve/);
  assert.match(html, /Preview signed-form.pdf/);
  assert.match(html, /aria-label="More request actions"/);
  assert.doesNotMatch(html, /Return for correction|Reject request/);
  assert.match(html, /<details[^>]*>.*Activity/s);
});

test('a date-only issue still lets the reviewer choose an effective date', () => {
  const html = renderReview({ ...assessment, ready: false, issues: ['Choose an effective date'], blockingIssues: [{ category: 'date', messages: ['Choose an effective date'] }] });
  const button = html.match(/<button[^>]*>Review &amp; approve<\/button>/)?.[0];
  assert.ok(button);
  assert.doesNotMatch(button, / disabled=""/);
});

test('ready financial review shows the estimate and allows approval review', () => {
  const html = renderReview(assessment);
  const button = html.match(/<button[^>]*>Review &amp; approve<\/button>/)?.[0];
  assert.ok(button);
  assert.doesNotMatch(button, / disabled=""/);
  assert.match(html, /6,000\.00/);
  assert.match(html, /5,000\.00/);
});

test('cashiers cannot approve or access administrator policy setup', () => {
  const html = renderReview({ ...assessment, ready: false, issues: ['Policy disabled'], blockingIssues: [{ category: 'policy', messages: ['Policy disabled'] }] }, 'cashier');
  assert.doesNotMatch(html, /Review &amp; approve|href="\/admin\/terms"/);
});
