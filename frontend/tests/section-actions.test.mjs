import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { default: SectionsPage } = await server.ssrLoadModule('/src/pages/admin/sections-page.tsx');
const { getSectionAssignmentState } = await server.ssrLoadModule('/src/features/sections/assignment-state.ts');
const { AddStudentsContent } = await server.ssrLoadModule('/src/features/sections/add-students-content.tsx');
const { MoveStudentForm } = await server.ssrLoadModule('/src/features/sections/move-student-form.tsx');
const section = {
  id: 1, schoolYearId: 1, program: 'gas', yearLevel: 'grade_11', name: 'A',
  capacity: 30, assignedCount: 1, adviser: null,
  students: [{ enrollmentId: 1, studentId: 1, studentNumber: '2026-00001', name: 'Alex Rivera', status: 'enrolled' }],
};

function renderPage(input = section, programs = []) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['admin', 'terms'], [{ id: 1, schoolYear: '2026-2027', isActive: true }]);
  client.setQueryData(['programs'], programs);
  client.setQueryData(['admin', 'sections', 'list', { schoolYearId: 1 }], [input]);
  client.setQueryData(['admin', 'sections', 'unsectioned', { schoolYearId: 1 }], []);
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(MemoryRouter, null, createElement(SectionsPage))));
  } finally {
    client.clear();
  }
}

test('Add students stays available to explain eligibility when nobody is unsectioned', () => {
  const html = renderPage();
  const button = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .find(([markup]) => markup.includes('Add students'))?.[0];
  assert.ok(button, 'Add students should be a visible action');
  assert.match(button, /aria-haspopup="dialog"/);
  assert.doesNotMatch(button, /disabled=""/);
});

test('the row actions menu has an accessible name identifying the student', () => {
  const html = renderPage();
  const trigger = html.match(/<button[^>]*aria-label="Actions for Alex Rivera"[^>]*>/)?.[0];
  assert.ok(trigger);
  assert.match(trigger, /aria-haspopup="menu"/);
  assert.doesNotMatch(html, /Change section|<span class="sr-only">Move Alex Rivera/);
});

test('the section header preserves the configured program name rather than displaying its internal code', () => {
  const html = renderPage({ ...section, program: 'abm' }, [
    { id: 1, code: 'abm', name: 'BE-ABM (Accounting, Business & Management)', category: 'Academic Track', isActive: true },
  ]);
  const heading = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/)?.[0];
  assert.ok(heading);
  assert.match(heading, />BE-ABM<\/span> · A/);
  assert.match(heading, /aria-label="BE-ABM \(Accounting, Business &amp; Management\)"/);
});

test('move destinations exclude the current section and incompatible or full sections', () => {
  const eligible = { ...section, id: 2, name: 'B' };
  const candidates = [
    section, eligible,
    { ...section, id: 3, schoolYearId: 2 },
    { ...section, id: 4, program: 'abm' },
    { ...section, id: 5, yearLevel: 'grade_12' },
    { ...section, id: 6, assignedCount: 30 },
  ];
  const state = getSectionAssignmentState(section, candidates, []);
  assert.deepEqual(state.moveTargets.map(target => target.id), [2]);
});

test('no matching section and full matching sections give different recovery guidance', () => {
  const none = getSectionAssignmentState(section, [section, { ...section, id: 2, program: 'abm' }], []);
  assert.equal(none.moveUnavailableTitle, 'No other matching sections');
  assert.match(none.moveUnavailableReason, /Create another section for the same school year, program and grade/);
  const full = getSectionAssignmentState(section, [section, { ...section, id: 2, assignedCount: 30 }], []);
  assert.equal(full.moveUnavailableTitle, 'Matching sections are full');
  assert.match(full.moveUnavailableReason, /Free up a seat or increase the capacity/);
  assert.deepEqual(full.moveTargets, []);
});

test('adding only offers students in the selected program and grade', () => {
  const matching = { enrollmentId: 11, studentId: 11, name: 'Casey Santos', studentNumber: '2026-00011', program: 'gas', yearLevel: 'grade_11' };
  const state = getSectionAssignmentState(section, [section], [
    matching, { ...matching, enrollmentId: 12, program: 'abm' },
    { ...matching, enrollmentId: 13, yearLevel: 'grade_12' },
    { ...matching, enrollmentId: 14, program: null },
  ]);
  assert.deepEqual(state.addable.map(student => student.enrollmentId), [11]);
});

function renderAdd(props = {}) {
  return renderToStaticMarkup(createElement(AddStudentsContent, {
    students: [], availableSeats: 29, loading: false, error: null, busy: false,
    onRetry: () => {}, onAdd: () => {}, ...props,
  }));
}

test('Add students explains no candidates and full sections without a disabled dead end', () => {
  const empty = renderAdd();
  assert.match(empty, /No unassigned students/);
  assert.match(empty, /open their current section and choose Move/);
  const full = renderAdd({ availableSeats: 0 });
  assert.match(full, /This section is full/);
  assert.match(full, /Increase its capacity in Edit section/);
  assert.doesNotMatch(full, /No unassigned students|aria-label="Add/);
});

test('Add students distinguishes query failures and loading from a genuinely empty list', () => {
  const loading = renderAdd({ loading: true });
  assert.match(loading, /role="status"[^>]*>Loading available students/);
  const failed = renderAdd({ error: 'Available students could not be loaded. Please try again.' });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Try again<\/button>/);
  assert.doesNotMatch(loading + failed, /No unassigned students/);
});

test('candidate rows identify the student and block duplicate adds during a request', () => {
  const students = [{ enrollmentId: 2, name: 'Casey Santos', studentNumber: '2026-00002' }];
  const html = renderAdd({ students, busy: true, availableSeats: 1 });
  assert.match(html, /1 seat available/);
  assert.match(html, /2026-00002/);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Add Casey Santos to section"/);
});

function renderMove(props = {}) {
  return renderToStaticMarkup(createElement(MoveStudentForm, {
    targets: [{ ...section, id: 2, name: 'B', assignedCount: 29 }],
    unavailableTitle: 'No other matching sections',
    unavailableReason: 'Create another section for the same school year, program and grade, then move this student.',
    selectedId: null, busy: false, error: null,
    onSelect: () => {}, onMove: () => {}, onCancel: () => {}, ...props,
  }));
}

test('moving requires a deliberate selection from eligible destinations before confirmation', () => {
  const initial = renderMove();
  assert.match(initial, /<legend[^>]*>Destination section/);
  assert.match(initial, /Same school year, program and grade/);
  assert.match(initial, /type="radio"/);
  assert.match(initial, /GAS · B/);
  assert.match(initial, /1 seat available/);
  assert.match(initial, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>Move student/);
  const chosen = renderMove({ selectedId: 2 });
  assert.match(chosen, /type="radio"[^>]*checked=""/);
  const submit = chosen.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
  assert.ok(submit);
  assert.doesNotMatch(submit, / disabled=""/);
  assert.match(renderMove({ selectedId: 99 }), /<button[^>]*type="submit"[^>]*disabled=""/);
});

test('a move failure retains the chosen destination and pending requests cannot be resubmitted', () => {
  const failed = renderMove({ selectedId: 2, error: 'That section is already full.' });
  assert.match(failed, /type="radio"[^>]*checked=""/);
  assert.match(failed, /role="alert"[^>]*>That section is already full/);
  const pending = renderMove({ selectedId: 2, busy: true });
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /<fieldset disabled=""/);
  assert.match(pending, /<button[^>]*type="submit"[^>]*disabled=""/);
  assert.match(pending, /role="status"[^>]*>Moving student/);
});

test('no available destination explains why and offers Close without a misleading move or remove action', () => {
  const html = renderMove({ targets: [] });
  assert.match(html, /No other matching sections/);
  assert.match(html, /Create another section/);
  assert.match(html, /Close<\/button>/);
  assert.doesNotMatch(html, /type="submit"|Remove from section|type="radio"/);
});
