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
  settlementBalance: 0, settlementBlockers: [],
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
  assert.match(html, /Both semesters’ clearance and grades have been accepted/);
  assert.doesNotMatch(button(html, 'Retain'), /disabled=""/);
  assert.doesNotMatch(button(html, 'Promote to Grade 12'), /disabled=""/);
  assert.doesNotMatch(html, /Undo decision/);
});

test('incomplete reviews explain the blocked promotion without blocking retention', () => {
  const html = render({ eligible: false, review: { first: review, second: { clearanceCleared: false, gradesPassed: false } } });
  assert.match(html, /2 of 4 accepted/);
  assert.match(html, /Complete the remaining clearance and grade reviews above before promotion/);
  assert.match(button(html, 'Promote to Grade 12'), /disabled=""/);
  assert.match(button(html, 'Promote to Grade 12'), /aria-describedby=/);
  assert.doesNotMatch(button(html, 'Retain'), /disabled=""/);
});

const unsettled = { settlementBalance: 1500, settlementBlockers: ['Fully settle all previous school-year bills before proceeding to the next grade or enrollment. Only verified payments and applied credits count.'] };

test('accepted reviews still explain the bill settlement required for promotion', () => {
  const html = render({ ...unsettled, eligible: false });
  assert.match(html, /Financial hold/);
  assert.match(html, /Both semesters’ clearance and grades have been accepted/);
  assert.match(html, /Ask the cashier to confirm full settlement before promotion or next-year enrollment/);
  assert.match(html, /1,500\.00/);
  assert.match(html, /Prior school-year balance/);
  assert.equal((html.match(/Pending payments are excluded/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Fully settle all previous school-year bills|>Ready</);
  assert.ok(html.indexOf('Academic review') < html.indexOf('Financial hold'));
  assert.ok(html.indexOf('Financial hold') < html.indexOf(button(html, 'Retain')));
  assert.match(button(html, 'Promote to Grade 12'), /disabled=""/);
  assert.match(button(html, 'Promote to Grade 12'), /aria-describedby="[^"]+ [^"]+"/);
  assert.doesNotMatch(button(html, 'Retain'), /disabled=""/);
});

test('incomplete academics and prior bills both remain visible', () => {
  const html = render({ ...unsettled, eligible: false, review: { first: review, second: { clearanceCleared: false, gradesPassed: false } } });
  assert.match(html, /2 of 4 accepted/);
  assert.match(html, /Complete the remaining clearance and grade reviews above before promotion/);
  assert.match(html, /Ask the cashier to confirm full settlement before promotion/);
});

test('top-grade students are offered graduation', () => {
  const html = render({ ...unsettled, isTopGrade: true, nextYearLevel: null });
  assert.doesNotMatch(button(html, 'Graduate'), /disabled=""/);
  assert.doesNotMatch(html, /Promote|Financial hold|Ask the cashier/);
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

test('recorded promotion and retention explain the enrollment block until settlement', () => {
  for (const decision of ['promote', 'retain']) {
    const html = render({ ...recorded, ...unsettled, decision, materialized: false, isTopGrade: decision === 'retain' });
    assert.match(html, /Enrollment on hold/);
    assert.match(html, /Ask the cashier to confirm full settlement before creating the next-year enrollment/);
    assert.doesNotMatch(button(html, 'Undo decision'), /disabled=""/);
  }
});

test('already materialized and graduated records do not show an enrollment settlement block', () => {
  for (const changes of [{ decision: 'promote', materialized: true }, { decision: 'graduate', materialized: false }]) {
    const html = render({ ...recorded, ...unsettled, ...changes });
    assert.doesNotMatch(html, /Financial hold|Enrollment on hold/);
  }
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
