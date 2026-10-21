import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { TablePagination } = await server.ssrLoadModule('/src/components/ui/table-pagination.tsx');
const { default: ProgressionPage } = await server.ssrLoadModule('/src/pages/admin/progression-page.tsx');
const { default: DroppingPage } = await server.ssrLoadModule('/src/features/dropping/dropping-page.tsx');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');

function button(html, label) {
  const match = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .find(([markup]) => markup.includes(label))?.[0];
  assert.ok(match, `Missing ${label}`);
  return match;
}

function renderPagination(overrides = {}) {
  return renderToStaticMarkup(createElement(TablePagination, {
    total: 61, pageIndex: 0, pageSize: 30, pageCount: 3,
    canPreviousPage: false, canNextPage: true,
    onPreviousPage() {}, onNextPage() {}, onPageSizeChange() {},
    ...overrides,
  }));
}

test('pagination exposes result totals and prevents navigation beyond either end', () => {
  const first = renderPagination();
  assert.match(first, /61 results/);
  assert.match(first, /Page 1 of 3/);
  assert.match(first, /aria-label="Rows per page"/);
  assert.match(button(first, 'Previous page'), /disabled=""/);
  assert.doesNotMatch(button(first, 'Next page'), /disabled=""/);
  const middle = renderPagination({ pageIndex: 1, canPreviousPage: true });
  assert.doesNotMatch(button(middle, 'Previous page'), /disabled=""/);
  assert.doesNotMatch(button(middle, 'Next page'), /disabled=""/);
  const last = renderPagination({ pageIndex: 2, canPreviousPage: true, canNextPage: false });
  assert.match(last, /Page 3 of 3/);
  assert.doesNotMatch(button(last, 'Previous page'), /disabled=""/);
  assert.match(button(last, 'Next page'), /disabled=""/);
});

test('pagination handles zero results and singular totals', () => {
  const empty = renderPagination({ total: 0, pageCount: 0, canNextPage: false });
  assert.match(empty, /0 results/);
  assert.match(empty, /Page 0 of 0/);
  assert.match(button(empty, 'Previous page'), /disabled=""/);
  assert.match(button(empty, 'Next page'), /disabled=""/);
  assert.match(renderPagination({ total: 1, pageCount: 1, canNextPage: false }), /1 result<\/p>/);
});

test('server pagination disables navigation and page-size changes while fetching', () => {
  const html = renderPagination({ pageIndex: 1, canPreviousPage: true, disabled: true });
  assert.match(button(html, 'Previous page'), /disabled=""/);
  assert.match(button(html, 'Next page'), /disabled=""/);
  assert.match(button(html, 'Rows per page'), /disabled=""/);
});

function renderPage(Component, configure) {
  const user = { id: 1, role: 'admin' };
  useAuthStore.setState({ user });
  Object.assign(useAuthStore.getInitialState(), { user });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['programs'], []);
  configure(client);
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(MemoryRouter, null, createElement(Component))));
  } finally {
    client.clear();
  }
}

function renderProgression(total) {
  return renderPage(ProgressionPage, client => {
    client.setQueryData(['admin', 'progression'], {
      activeYear: { id: 1, schoolYear: '2026-2027' }, nextYear: null,
      progressionOpen: true, pending: total, readyToEnroll: 0,
    });
    client.setQueryData(['admin', 'progression', 'roster', {
      page: 1, perPage: 30, search: '', status: '', grade: '', program: '', clearance: '',
    }], {
      data: Array.from({ length: Math.min(total, 30) }, (_, index) => ({
        studentId: index + 1, studentNumber: `2026-${index + 1}`, name: `Student ${index + 1}`,
        track: 'gas', yearLevel: 'grade_11', status: 'pending', eligible: false,
        review: { first: { clearanceCleared: false, gradesPassed: false }, second: { clearanceCleared: false, gradesPassed: false } },
      })),
      meta: { page: 1, perPage: 30, total, lastPage: Math.max(1, Math.ceil(total / 30)) },
    });
  });
}

function renderDropping(total) {
  return renderPage(DroppingPage, client => {
    client.setQueryData(['dropping', true], Array.from({ length: total }, (_, index) => ({
      id: index + 1, reference: `DROP-${index + 1}`, status: 'submitted', createdAt: '2026-10-05',
      snapshot: { studentName: `Student ${index + 1}`, studentNumber: `2026-${index + 1}`, schoolYear: '2026-2027', program: 'gas' },
    })));
  });
}

test('progression keeps the server total and uses the 30-row default', () => {
  const html = renderProgression(61);
  assert.match(html, /61 results/);
  assert.match(html, /Page 1 of 3/);
  assert.match(html, />Student 30</);
  assert.doesNotMatch(html, />Student 31</);
  assert.match(html, /aria-label="Rows per page"/);
  assert.doesNotMatch(button(html, 'Next page'), /disabled=""/);
});

test('staff dropping requests paginate the filtered list at 30 rows', () => {
  const html = renderDropping(31);
  assert.match(html, /31 results/);
  assert.match(html, /Page 1 of 2/);
  assert.match(html, />Student 30</);
  assert.doesNotMatch(html, />Student 31</);
  assert.match(html, /aria-label="Rows per page"/);
  assert.doesNotMatch(button(html, 'Next page'), /disabled=""/);
});

test('both pages keep pagination available with empty results', () => {
  for (const html of [renderProgression(0), renderDropping(0)]) {
    assert.match(html, /0 results/);
    assert.match(html, /Page 0 of 0/);
    assert.match(html, /aria-label="Rows per page"/);
    assert.match(button(html, 'Previous page'), /disabled=""/);
    assert.match(button(html, 'Next page'), /disabled=""/);
  }
});
