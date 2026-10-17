import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { StudentEnrollmentsCard } = await server.ssrLoadModule('/src/features/students/components/student-enrollments-card.tsx');
const { DroppingSubmissionForm } = await server.ssrLoadModule('/src/features/dropping/dropping-submission-form.tsx');
const { AdminDroppingForm } = await server.ssrLoadModule('/src/features/dropping/admin-dropping-action.tsx');
const { philippinesToday } = await server.ssrLoadModule('/src/features/dropping-finance/api.ts');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const record = { id: 1, program: 'gas', yearLevel: 'grade_11', schoolYear: '2026-2027', status: 'enrolled', isCurrent: true, openDroppingRequestId: null };

function renderCard(enrollments, role = 'admin') {
  const user = { id: 20, role };
  useAuthStore.setState({ user });
  Object.assign(useAuthStore.getInitialState(), { user });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['programs'], []);
  client.setQueryData(['admin', 'students', 'enrollments', 1], enrollments);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null,
    createElement(StudentEnrollmentsCard, { studentId: 1, studentName: 'Test Student' }))));
  client.clear();
  return html;
}

test('admin starts the official dropping workflow only for an active enrolled year', () => {
  const html = renderCard([record, { ...record, id: 2, isCurrent: false }]);
  assert.equal((html.match(/Start dropping/g) ?? []).length, 1);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /Mark as withdrawn|Reset to pending|Enroll again/);
});

test('pending and historical enrollment states cannot start a drop', () => {
  for (const status of ['pending', 'dropped', 'withdrawn', 'completed']) {
    assert.doesNotMatch(renderCard([{ ...record, status }]), /Start dropping/);
  }
  assert.doesNotMatch(renderCard([{ ...record, isCurrent: false }]), /Start dropping/);
});

test('an existing request opens directly instead of offering a duplicate', () => {
  const html = renderCard([{ ...record, openDroppingRequestId: 42 }]);
  assert.match(html, /href="\/admin\/dropping-requests\/42"/);
  assert.match(html, /View dropping request/);
  assert.doesNotMatch(html, /Start dropping/);
});

test('cashiers and other roles have no admin dropping controls', () => {
  for (const role of ['cashier', 'teacher', 'student', 'applicant']) {
    assert.doesNotMatch(renderCard([record, { ...record, id: 2, openDroppingRequestId: 42 }], role), /Start dropping|View dropping request/);
  }
});

function renderAdminForm(assessment) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['programs'], []);
  client.setQueryData(['admin-dropping-assessment', 1, 1, philippinesToday()], { assessment, billId: 10 });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null,
    createElement(AdminDroppingForm, { studentId: 1, studentName: 'Test Student', enrollment: record, onCancel: () => {}, onBusyChange: () => {} }))));
  client.clear();
  return html;
}
const assessment = { ready: true, issues: [], fingerprint: 'current', policyVersion: 1, period: 'quarter_2', category: 'paying', effectiveDate: philippinesToday(), originalTotal: 1000, finalCharge: 500, verifiedPayments: 100, balance: 400, credit: 0, feeBreakdown: {} };

test('admin form collects reason and date without requiring signed documents', () => {
  const html = renderAdminForm(assessment);
  assert.match(html, /Reason for dropping/);
  assert.match(html, /Effective date/);
  assert.match(html, /<textarea[^>]*required=""/);
  assert.match(html, /Balance after dropping/);
  assert.match(html, /400\.00/);
  // A ready calculation alone cannot advance an empty reason to confirmation.
  assert.match(html, /type="submit" disabled="">Review drop/);
  assert.doesNotMatch(html, /type="file"|Signed form and attachments|complete, signed documents|>Submit request</);
});

test('admin form explains financial blockers and offers recovery before confirmation', () => {
  const html = renderAdminForm({ ...assessment, ready: false, fingerprint: null, issues: ['Pending payments'], blockingIssues: [{ category: 'payments', messages: ['Pending payments'] }] });
  assert.match(html, /Review pending payments/);
  assert.match(html, /href="\/admin\/billing\/10"/);
  assert.match(html, /type="submit" disabled="">Review drop/);
});

test('shared form retains student submission wording and blocks dismissal while uploading', () => {
  const html = renderToStaticMarkup(createElement(DroppingSubmissionForm, { busy: true, onSubmit: () => {}, onCancel: () => {} }));
  assert.match(html, /I reviewed my complete, signed documents/);
  assert.match(html, /Your enrollment stays active until approval/);
  assert.match(html, /disabled="">Cancel/);
  assert.match(html, /disabled="">Uploading documents/);
  assert.doesNotMatch(html, /Continue to review/);
});
