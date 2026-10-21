import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { DecisionSection } = await server.ssrLoadModule('/src/features/progression/decision-section.tsx');
const review = { clearanceCleared: true, gradesPassed: true };
const student = {
  studentId: 1, status: 'pending', eligible: true, yearLevel: 'grade_11', nextYearLevel: 'grade_12',
  isTopGrade: false, review: { first: review, second: review },
  decision: null, decisionId: null, fromYearLevel: null, toYearLevel: null, revertable: null,
};
function render(changes = {}, props = {}) {
  return renderToStaticMarkup(createElement(DecisionSection, {
    student: { ...student, ...changes }, busy: false, pendingDecision: null, undoPending: false,
    error: null, onDecide() {}, onUndo() {}, ...props,
  }));
}
function button(html, label) {
  const found = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(([markup]) => markup.includes(label))?.[0];
  assert.ok(found, `Missing ${label}`);
  return found;
}

test('ready decisions show the destination and keep both choices available', () => {
  const html = render();
  assert.match(html, /Ready/);
  assert.match(html, /All four requirements accepted/);
  assert.doesNotMatch(button(html, 'Retain'), /disabled=""/);
  assert.doesNotMatch(button(html, 'Promote to Grade 12'), /disabled=""/);
  assert.doesNotMatch(html, /Undo decision/);
});

test('incomplete reviews explain the blocked promotion without blocking retention', () => {
  const html = render({ eligible: false, review: { first: review, second: { clearanceCleared: false, gradesPassed: false } } });
  assert.match(html, /2 of 4 accepted/);
  assert.match(html, /Accept both semesters’ clearance and grades to promote/);
  assert.match(button(html, 'Promote to Grade 12'), /disabled=""/);
  assert.match(button(html, 'Promote to Grade 12'), /aria-describedby=/);
  assert.doesNotMatch(button(html, 'Retain'), /disabled=""/);
});

test('top-grade students are offered graduation', () => {
  const html = render({ isTopGrade: true, nextYearLevel: null });
  assert.doesNotMatch(button(html, 'Graduate'), /disabled=""/);
  assert.doesNotMatch(html, /Promote/);
});

const recorded = { status: 'decided', decisionId: 5, fromYearLevel: 'grade_11', revertable: true };
test('promotion names the recorded outcome and previous grade', () => {
  const html = render({ ...recorded, decision: 'promote', toYearLevel: 'grade_12' });
  assert.match(html, /Promoted to Grade 12/);
  assert.match(html, /Previously Grade 11/);
  assert.doesNotMatch(button(html, 'Undo decision'), /disabled=""/);
  assert.doesNotMatch(html, /All four requirements|>Retain<|Promote to Grade 12/);
});

test('retention states the unchanged grade without a duplicate grade transition', () => {
  const html = render({ ...recorded, decision: 'retain', toYearLevel: 'grade_11' });
  assert.match(html, /Retained in Grade 11/);
  assert.match(html, /Year level unchanged/);
  assert.equal((html.match(/Grade 11/g) ?? []).length, 1);
  assert.ok(button(html, 'Undo decision'));
});

test('graduation uses its recorded source grade and does not invent a destination', () => {
  const html = render({ ...recorded, decision: 'graduate', fromYearLevel: 'grade_12', toYearLevel: null });
  assert.match(html, /Graduated/);
  assert.match(html, /Completed Grade 12/);
  assert.doesNotMatch(html, /undefined|null|Grade 13/);
});

test('locked decisions explain the bill restriction without claiming it was paid', () => {
  const html = render({ ...recorded, decision: 'promote', toYearLevel: 'grade_12', revertable: false });
  assert.match(html, /A bill has been created for the next school year/);
  assert.doesNotMatch(html, /Undo decision|bill is paid/);
});

test('saving and undoing prevent duplicate requests and failures remain visible', () => {
  const saving = render({}, { busy: true, pendingDecision: 'promote' });
  assert.match(button(saving, 'Retain'), /disabled=""/);
  assert.match(button(saving, 'Saving…'), /disabled=""/);
  assert.match(saving, /aria-busy="true"/);
  const undoing = render({ ...recorded, decision: 'retain', toYearLevel: 'grade_11' }, { busy: true, undoPending: true });
  assert.match(button(undoing, 'Undoing…'), /disabled=""/);
  const failed = render({}, { error: 'Decision could not be saved. Please try again.' });
  assert.match(failed, /role="alert"[^>]*>Decision could not be saved/);
  assert.doesNotMatch(button(failed, 'Promote to Grade 12'), /disabled=""/);
});
