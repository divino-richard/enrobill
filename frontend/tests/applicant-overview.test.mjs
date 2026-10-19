import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { ApplicantOverview } = await server.ssrLoadModule('/src/features/applications/components/applicant-overview.tsx');
const { default: ApplicationEditPage } = await server.ssrLoadModule('/src/pages/portal/application-edit-page.tsx');
const { DEFAULT_APPLICATION_FORM_VALUES } = await server.ssrLoadModule('/src/features/applications/hooks/form.ts');
const { TooltipProvider } = await server.ssrLoadModule('/src/components/ui/tooltip.tsx');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const user = { id: 6, role: 'applicant', name: 'Adena Raven Buchanan Ratliff' };
useAuthStore.setState({ user });
Object.assign(useAuthStore.getInitialState(), { user });
const base = {
  id: 6, reference: 'APP-2026-000006', status: 'submitted',
  program: 'BE-ABM (Accounting, Business and Management)', programCode: 'abm',
  yearLevel: 'grade_11', schoolYear: '2026-2027', decisionNote: null,
  submittedAt: '2026-10-19T08:00:00Z', updatedAt: '2026-10-19T08:00:00Z',
};

function render(applications = [base], mode = 'loaded') {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, retryOnMount: false } } });
  if (mode === 'loaded') client.setQueryData(['applications'], applications);
  if (mode === 'error') {
    client.getQueryCache().build(client, { queryKey: ['applications'] }).setState({
      status: 'error', fetchStatus: 'idle', error: new Error('Failed to load'),
    });
  }
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, { initialEntries: ['/portal'] }, createElement(ApplicantOverview))));
  client.clear();
  return html;
}

function stages(html) {
  const list = html.match(/<ol\b[^>]*>([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(list, 'progress is an ordered list');
  return [...list.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map(match => match[0]);
}

const scenarios = [
  ['draft', 'Finish your application', 0, 'Not submitted', 'Continue application', '/edit'],
  ['submitted', 'Application submitted', 0, 'Awaiting review', 'View application', ''],
  ['under_review', 'Application under review', 1, 'In progress', 'View application', ''],
  ['returned', 'Update your application', 1, 'Action needed', 'Update application', '/edit'],
  ['accepted', 'Application accepted', 2, 'Accepted', 'View decision', ''],
  ['rejected', 'Application not accepted', 2, 'Not accepted', 'View decision', ''],
];

for (const [status, heading, current, detail, action, suffix] of scenarios) {
  test(`${status} has an accurate stage and one appropriate application action`, () => {
    const html = render([{ ...base, status }]);
    assert.match(html, new RegExp(`<h2[^>]*>${heading}</h2>`));
    const progress = stages(html);
    assert.equal(progress.length, 3);
    assert.equal(progress.filter(step => step.includes('aria-current="step"')).length, 1);
    assert.match(progress[current], /aria-current="step"/);
    assert.ok(progress[current].includes(detail));
    for (let i = 0; i < current; i++) assert.match(progress[i], /Completed/);
    for (let i = current + 1; i < progress.length; i++) assert.match(progress[i], /Upcoming/);
    const links = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
    assert.equal(links.length, 1, 'no duplicate application routes');
    assert.ok(links[0].includes(`href="/portal/application/6${suffix}"`));
    assert.ok(links[0].includes(action));
    assert.match(links[0], /min-h-11/);
    assert.doesNotMatch(html, /On track|Nothing needs attention|Review your submission|Application status/);
  });
}

test('waiting applicants get reassurance instead of an invented task', () => {
  for (const status of ['submitted', 'under_review']) {
    const html = render([{ ...base, status }]);
    assert.match(html, /No action is needed right now/);
    assert.doesNotMatch(html, /Next step|Fix application|\/edit"/);
  }
});

test('returned and rejected applications display the actual registrar note safely', () => {
  for (const status of ['returned', 'rejected']) {
    const html = render([{ ...base, status, decisionNote: 'Please replace the blurry report card.\nInclude <all> pages.' }]);
    assert.match(html, /Please replace the blurry report card/);
    assert.match(html, /Include &lt;all&gt; pages/);
    assert.match(html, /whitespace-pre-wrap wrap-anywhere/);
    assert.match(html, status === 'returned' ? /Requested corrections/ : /Note from the registrar/);
  }
  const missing = render([{ ...base, status: 'returned', decisionNote: '  ' }]);
  assert.doesNotMatch(missing, /application-note-heading/);
  assert.match(missing, /Review the requested corrections/);
});

test('full application details remain readable without truncation', () => {
  const program = `Accountancy, Business and Management — ${'ExtendedProgramName'.repeat(12)}`;
  const html = render([{ ...base, program }]);
  assert.ok(html.includes(program));
  assert.match(html, /<dl\b/);
  assert.match(html, /wrap-anywhere/);
  assert.doesNotMatch(html, /truncate|line-clamp|overflow-ellipsis/);
  assert.equal(html.split(base.reference).length - 1, 1);
  assert.match(html, /sm:grid-cols-3/);
});

test('an active application takes priority over a more recent decided one', () => {
  const html = render([{ ...base, id: 7, status: 'rejected' }, base]);
  assert.match(html, /Application submitted/);
  assert.match(html, /href="\/portal\/application\/6"/);
  assert.doesNotMatch(html, /Application not accepted/);
});

test('empty, loading, and error states keep clear recovery paths', () => {
  const empty = render([]);
  assert.match(empty, /No application yet/);
  assert.match(empty, /href="\/portal\/application\/new"/);
  assert.doesNotMatch(empty, /aria-current="step"/);
  const loading = render([], 'loading');
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /Loading your application/);
  assert.doesNotMatch(loading, /No application yet/);
  const error = render([], 'error');
  assert.match(error, /role="alert"/);
  assert.match(error, /Application unavailable/);
  assert.match(error, /<button[^>]*>Try again<\/button>/);
  assert.doesNotMatch(error, /No application yet/);
});


function renderEditor(status, { open = true, otherStatus } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const application = { ...base, status, values: { ...DEFAULT_APPLICATION_FORM_VALUES, givenName: 'Adena' } };
  client.setQueryData(['applications', 6], application);
  client.setQueryData(['applications'], [application, ...(otherStatus ? [{ ...base, id: 7, status: otherStatus }] : [])]);
  client.setQueryData(['open-term'], open ? { id: 1, schoolYear: '2026-2027' } : null);
  client.setQueryData(['programs'], []);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, { initialEntries: ['/portal/application/6/edit'] },
      createElement(Routes, null, createElement(Route, { path: '/portal/application/:id/edit', element: createElement(TooltipProvider, null, createElement(ApplicationEditPage)) })))));
  client.clear();
  return html;
}

test('continue and update destinations open the existing application form', () => {
  for (const status of ['draft', 'returned', 'rejected']) {
    const html = renderEditor(status);
    assert.match(html, /<form/);
    assert.match(html, /value="Adena"/);
    assert.doesNotMatch(html, /can no longer be edited/);
  }
});

test('reviewed or accepted applications stay locked against direct edit navigation', () => {
  for (const status of ['submitted', 'under_review', 'accepted']) {
    const html = renderEditor(status);
    assert.match(html, /This application can no longer be edited/);
    assert.doesNotMatch(html, /<form/);
  }
});

test('submission routes still respect closed admissions and other active or accepted applications', () => {
  const closed = renderEditor('draft', { open: false });
  assert.match(closed, /Admissions are currently closed/);
  assert.doesNotMatch(closed, /<form/);
  for (const otherStatus of ['draft', 'submitted', 'under_review', 'returned', 'accepted']) {
    const html = renderEditor('returned', { otherStatus });
    assert.match(html, otherStatus === 'accepted' ? /already have an accepted application/ : /another application in progress/);
    assert.doesNotMatch(html, /<form/);
  }
});
