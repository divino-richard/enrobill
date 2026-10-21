import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { default: TeacherGradesPage } = await server.ssrLoadModule('/src/pages/teacher/grades-page.tsx');
const { getTeacherRosterState, getTeacherRosterError } = await server.ssrLoadModule('/src/features/teacher-grades/roster-state.ts');
const year = { id: 1, schoolYear: '2026-2027', isActive: true };
const emptyRoster = { schoolYearId: 1, schoolYear: year.schoolYear, schoolYears: [], sections: [] };
const assignedRoster = { ...emptyRoster, schoolYears: [year] };
const populatedRoster = {
  ...assignedRoster,
  sections: [
    {
      id: 1, name: 'A', program: 'GAS', yearLevel: 'grade_11',
      students: [
        { id: 11, name: 'Alex Rivera', studentNumber: '2026-00011', documents: [] },
        { id: 12, name: 'Casey Santos', studentNumber: '2026-00012', documents: [] },
      ],
    },
    {
      id: 2, name: 'B', program: 'GAS', yearLevel: 'grade_11',
      students: [{ id: 13, name: 'Jordan Lee', studentNumber: '2026-00013', documents: [] }],
    },
  ],
};

function renderPage({ data, error } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false, retryOnMount: false } },
  });
  const queryKey = ['teacher', 'grades', undefined];
  if (data) client.setQueryData(queryKey, data);
  if (error) {
    client.getQueryCache().build(client, { queryKey }).setState({
      status: 'error', fetchStatus: 'idle', error,
    });
  }
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(MemoryRouter, null, createElement(TeacherGradesPage))));
  } finally {
    client.clear();
  }
}

test('missing adviser assignments and sections awaiting enrollment have different guidance', () => {
  const unassigned = getTeacherRosterState(emptyRoster, '');
  assert.equal(unassigned.emptyState.kind, 'assignment');
  assert.equal(unassigned.hasStudents, false);
  const assigned = getTeacherRosterState(assignedRoster, '');
  assert.equal(assigned.emptyState.kind, 'enrollment');
  assert.equal(assigned.studentCount, 0);
  assert.equal(getTeacherRosterState({
    ...assignedRoster,
    sections: [{ ...populatedRoster.sections[0], students: [] }],
  }, '').emptyState.kind, 'enrollment');
});

test('search ignores surrounding whitespace and matches names and student numbers across sections', () => {
  const byName = getTeacherRosterState(populatedRoster, '  rIVeRa  ');
  assert.equal(byName.studentCount, 1);
  assert.equal(byName.sections[0].students[0].id, 11);
  assert.equal(byName.sections.length, 1);
  const byNumber = getTeacherRosterState(populatedRoster, ' 2026-00013 ');
  assert.equal(byNumber.sections[0].id, 2);
  assert.equal(byNumber.sections[0].students[0].id, 13);
  assert.equal(populatedRoster.sections[0].students.length, 2, 'filtering preserves the cached roster');
  assert.equal(getTeacherRosterState(populatedRoster, '   ').studentCount, 3);
});

test('a failed search keeps search available and does not ask for a new adviser assignment', () => {
  const state = getTeacherRosterState(populatedRoster, 'unmatched');
  assert.equal(state.hasStudents, true);
  assert.equal(state.emptyState.kind, 'search');
  assert.equal(state.emptyState.title, 'No matching students');
  assert.deepEqual(state.sections, []);
  assert.equal(getTeacherRosterState(assignedRoster, 'unmatched').emptyState.kind, 'enrollment');
});

test('an unassigned teacher sees the active year and refresh without unusable filters', () => {
  const html = renderPage({ data: emptyRoster });
  assert.match(html, /<h2[^>]*>No advisory section assigned<\/h2>/);
  assert.match(html, /Ask a school administrator to assign you to a section/);
  assert.match(html, /SY 2026-2027/);
  assert.match(html, /Refresh students/);
  assert.match(html, /role="status" aria-atomic="true"/);
  assert.doesNotMatch(html, /role="combobox"|type="search"|No handled students|Sections tab/);
});

test('an assigned teacher awaiting students gets enrollment guidance and a meaningful year selector', () => {
  const html = renderPage({
    data: { ...assignedRoster, schoolYears: [year, { id: 2, schoolYear: '2025-2026', isActive: false }] },
  });
  assert.match(html, /<h2[^>]*>No enrolled students yet<\/h2>/);
  assert.match(html, /Students will appear once they are enrolled in your assigned sections/);
  assert.match(html, /role="combobox"[^>]*aria-label="School year"/);
  assert.match(html, /SY 2026-2027/);
  assert.doesNotMatch(html, /type="search"|Ask a school administrator to assign/);
});

test('populated sections retain grade management and labeled student search', () => {
  const html = renderPage({ data: populatedRoster });
  assert.match(html, /type="search"[^>]*aria-label="Search students by name or student number"/);
  assert.match(html, /3 students in your advisory sections/);
  assert.equal((html.match(/Manage grades/g) ?? []).length, 3);
  assert.match(html, /Alex Rivera/);
  assert.match(html, /Jordan Lee/);
  assert.doesNotMatch(html, /No advisory section assigned|No enrolled students yet|Refresh students/);
});

test('loading is announced without presenting an empty assignment or filters', () => {
  const html = renderPage();
  assert.match(html, /role="status"[^>]*>Loading students…/);
  assert.doesNotMatch(html, /No advisory section assigned|No enrolled students yet|type="search"|role="combobox"/);
});

test('school-year failures offer recovery suited to the backend response', () => {
  const noYear = { isAxiosError: true, response: { status: 422 } };
  const inaccessibleYear = { isAxiosError: true, response: { status: 404 } };
  assert.equal(getTeacherRosterError(noYear).resetYear, false);
  assert.equal(getTeacherRosterError(inaccessibleYear).resetYear, true);
  const noYearHtml = renderPage({ error: noYear });
  assert.match(noYearHtml, /role="alert"/);
  assert.match(noYearHtml, /No school year available/);
  assert.match(noYearHtml, />Check again<\/button>/);
  const inaccessibleYearHtml = renderPage({ error: inaccessibleYear });
  assert.match(inaccessibleYearHtml, /School year unavailable/);
  assert.match(inaccessibleYearHtml, />Check available school years<\/button>/);
  assert.doesNotMatch(noYearHtml + inaccessibleYearHtml, /No advisory section assigned|role="combobox"|type="search"/);
});

test('request failures offer retry instead of falsely reporting an empty roster', () => {
  const html = renderPage({ error: new Error('Network error') });
  assert.match(html, /Couldn&#x27;t load your students/);
  assert.match(html, /role="alert"/);
  assert.match(html, />Try again<\/button>/);
  assert.doesNotMatch(html, /No advisory section assigned|No enrolled students yet|Refresh students/);
});
