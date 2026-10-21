import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { default: ProgramsPage } = await server.ssrLoadModule('/src/pages/portal/programs-page.tsx');
const { default: ProgressionPage } = await server.ssrLoadModule('/src/pages/admin/progression-page.tsx');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const old = { id: 1, schoolYear: '2026-2027', program: 'gas', yearLevel: 'grade_11',
  status: 'enrolled', isCurrent: false, enrolledAt: '2026-10-19T08:00:00Z' };
const current = { ...old, id: 2, schoolYear: '2027-2028', yearLevel: 'grade_12', status: 'pending', isCurrent: true, enrolledAt: null };
function render(path, records = [old], context = { activeSchoolYear: '2027-2028', pendingProgression: { decision: 'promote', schoolYear: '2027-2028' } }) {
  const user = { id: 7, role: 'student' };
  useAuthStore.setState({ user }); Object.assign(useAuthStore.getInitialState(), { user });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['me', 'student'], { id: 1, status: 'enrolled', studentNumber: 'ROLLOVER-1',
    trackOrStrand: 'gas', yearLevel: 'grade_12', schoolYear: '2026-2027', programContext: context });
  client.setQueryData(['me', 'enrollments', 7], records);
  client.setQueryData(['me', 'documents'], []);
  client.setQueryData(['me', 'documents', 'history'], []);
  client.setQueryData(['programs'], []);
  client.setQueryData(['me', 're-enrollment', 7], { state: 'not_applicable', source: null });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, { initialEntries: [path] }, createElement(ProgramsPage))));
  client.clear(); return html;
}

test('promotion awaiting enrollment shows the new standing without presenting last year as current', () => {
  const html = render('/portal/programs');
  assert.match(html, /Grade 12/);
  assert.match(html, /SY 2027-2028/);
  assert.match(html, /Awaiting enrollment/);
  assert.doesNotMatch(html, /Grade 11|>Enrolled<|Oct 19, 2026/);
});

test('the only old enrollment remains in History when there is no current enrollment', () => {
  const html = render('/portal/programs?section=history');
  assert.match(html, /Grade 11/);
  assert.match(html, /SY 2026-2027/);
  assert.doesNotMatch(html, /No past enrollments/);
});

test('created next-year enrollment uses its actual pending status and retains old history', () => {
  const context = { activeSchoolYear: '2027-2028', pendingProgression: null };
  const overview = render('/portal/programs', [current, old], context);
  assert.match(overview, /Grade 12/);
  assert.match(overview, /Pending/);
  assert.doesNotMatch(overview, /Awaiting enrollment|Oct 19, 2026/);
  const history = render('/portal/programs?section=history', [current, old], context);
  assert.match(history, /<li[^>]*>[\s\S]*?Grade 11/);
});

test('no active year does not relabel the most recent enrollment as current', () => {
  const html = render('/portal/programs', [old], { activeSchoolYear: null, pendingProgression: null });
  assert.match(html, /No active academic year/);
  assert.doesNotMatch(html, /SY 2026-2027|>Enrolled</);
});

test('staff can see unfinished prior-year enrollment while the new progression window is closed', () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['admin', 'progression'], { progressionOpen: false, pending: 0, readyToEnroll: 0,
    activeYear: { id: 2, schoolYear: '2027-2028' }, nextYear: null,
    carryForward: { sourceYear: { id: 1, schoolYear: '2026-2027' }, targetYear: { id: 2, schoolYear: '2027-2028' }, count: 1 } });
  client.setQueryData(['programs'], []);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, null, createElement(ProgressionPage))));
  assert.match(html, /Create 1 enrollment/);
  assert.match(html, /2026-2027/);
  assert.match(html, /2027-2028/);
  client.clear();
});
