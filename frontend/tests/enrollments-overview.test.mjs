import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { default: EnrollmentsPage } = await server.ssrLoadModule('/src/pages/admin/enrollments-page.tsx');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const queryKey = ['admin', 'enrollments', 'list', { page: 1, perPage: 30, sort: 'createdAt', dir: 'desc' }];
const enrollment = {
  id: 10, schoolYear: '2027-2028', program: 'gas', yearLevel: 'grade_12', status: 'enrolled',
  isCurrent: true, hasBill: true, bill: { id: 15, status: 'paid' }, feePreview: 1000,
  student: { id: 5, name: 'Berk Molina', studentNumber: '2026-00009' },
  openBillCount: 1, openBillTotal: 800,
  openBills: [{ id: 9, schoolYear: '2026-2027', status: 'partial', balance: 800, isCurrent: false }],
  settlementBlockers: [],
};

function renderPage({ rows = [enrollment], role = 'cashier', error = false, fetching = false } = {}) {
  const user = { id: 20, role };
  useAuthStore.setState({ user });
  Object.assign(useAuthStore.getInitialState(), { user });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, retryOnMount: false } } });
  client.setQueryData(['programs'], []);
  client.setQueryData(['admin', 'terms'], []);
  if (!error) client.setQueryData(queryKey, { rows, meta: { currentPage: 1, lastPage: 1, perPage: 30, total: rows.length, from: 1, to: rows.length } });
  const query = client.getQueryCache().build(client, { queryKey });
  if (error) query.setState({ status: 'error', fetchStatus: 'idle', error: new Error('Network unavailable') });
  if (fetching) query.setState({ fetchStatus: 'fetching' });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(EnrollmentsPage))));
  client.clear();
  return html;
}

test('settled enrollment keeps its paid status when another school year has debt', () => {
  const html = renderPage();
  assert.match(html, /SY 2027-2028/);
  assert.match(html, />Enrollment status</);
  assert.match(html, />Billing</);
  assert.match(html, />Paid</);
  // The bill link is inside the portaled row menu, which is closed during SSR.
  assert.doesNotMatch(html, />View bill<|>Billing status</);
  assert.doesNotMatch(html, /href="\/admin\/billing\/9"|>1 unpaid bill</);
  assert.match(html, /1 other open bill/);
});

test('current partial bills are distinguished from paid bills', () => {
  const html = renderPage({ rows: [{ ...enrollment, bill: { id: 15, status: 'partial' } }] });
  assert.match(html, />Partially paid</);
  assert.doesNotMatch(html, />Paid</);
});

test('only cashiers get a visible Generate bill action for an unbilled pending enrollment', () => {
  const pending = { ...enrollment, status: 'pending', hasBill: false, bill: null, openBills: [], openBillCount: 0 };
  assert.match(renderPage({ rows: [pending] }), />Generate bill</);
  assert.doesNotMatch(renderPage({ rows: [pending], role: 'admin' }), />Generate bill</);
  assert.doesNotMatch(renderPage({ rows: [{ ...pending, status: 'dropped' }] }), />Generate bill</);
});

test('unpaid prior bills disable bill generation and expose the reason to staff', () => {
  const pending = { ...enrollment, status: 'pending', hasBill: false, bill: null,
    settlementBlockers: ['Settle the remaining balance for SY 2026-2027.'] };
  const html = renderPage({ rows: [pending] });
  const generate = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(([markup]) => markup.includes('Generate bill'))?.[0];
  assert.ok(generate);
  assert.match(generate, /disabled=""/);
  assert.match(generate, /aria-describedby="enrollment-settlement-10"/);
  assert.match(html, /id="enrollment-settlement-10"/);
  assert.match(html, /Settle prior bills before billing this enrollment/);
  assert.match(html, /Settle the remaining balance for SY 2026-2027/);
  assert.match(renderPage({ rows: [pending], role: 'admin' }), /Settle the remaining balance for SY 2026-2027/);
});

test('an unbilled pending enrollment without settlement blockers can generate its bill', () => {
  const pending = { ...enrollment, status: 'pending', hasBill: false, bill: null };
  const html = renderPage({ rows: [pending] });
  const generate = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(([markup]) => markup.includes('Generate bill'))?.[0];
  assert.ok(generate);
  assert.doesNotMatch(generate, /disabled=""|aria-describedby=/);
  assert.doesNotMatch(html, /Settle prior bills before billing/);
});

test('filters and row actions have stable names including student and school year', () => {
  const html = renderPage();
  for (const label of ['Search enrollments', 'Enrollment status', 'School year', 'Year level', 'Track or strand', 'Actions for Berk Molina, SY 2027-2028']) {
    assert.ok(html.includes(`aria-label="${label}"`), label);
  }
});

test('failed lists retain filters and offer retry', () => {
  const html = renderPage({ error: true });
  assert.match(html, /aria-label="Search enrollments"/);
  assert.match(html, /role="alert"/);
  assert.match(html, />Retry</);
});

test('refreshes identify updating results while retaining the visible student', () => {
  const html = renderPage({ fetching: true });
  assert.match(html, /Updating results/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Berk Molina/);
});
