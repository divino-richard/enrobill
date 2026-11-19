import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { default: ProgressionPage } = await server.ssrLoadModule('/src/pages/admin/progression-page.tsx');
const sourceYear = { id: 1, schoolYear: '2026-2027' };
const targetYear = { id: 2, schoolYear: '2027-2028' };
const summary = { activeYear: sourceYear, nextYear: targetYear, progressionOpen: true,
  pending: 0, readyToEnroll: 1, blockedByBalance: 2, carryForward: null };
const review = { clearanceCleared: true, gradesPassed: true };
const student = { studentId: 1, name: 'Bea Molina', studentNumber: '2026-00001', track: 'gas',
  yearLevel: 'grade_11', nextYearLevel: 'grade_12', isTopGrade: false, eligible: false,
  review: { first: review, second: review }, status: 'pending', decision: null,
  settlementBalance: 800, settlementBlockers: ['Settle the remaining balance for SY 2026-2027.'] };

function render({ changes = {}, rows = [] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['admin', 'progression'], { ...summary, ...changes });
  client.setQueryData(['admin', 'progression', 'roster', { page: 1, perPage: 30, search: '', status: '', grade: '', program: '', clearance: '' }], {
    data: rows, meta: { page: 1, perPage: 30, total: rows.length, lastPage: 1 },
  });
  client.setQueryData(['programs'], []);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, null, createElement(ProgressionPage))));
  client.clear();
  return html;
}

function button(html, label) {
  const markup = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(([value]) => value.includes(label))?.[0];
  assert.ok(markup, `Missing ${label}`);
  return markup;
}

test('ready enrollments remain actionable while blocked decisions are counted separately', () => {
  const html = render();
  assert.doesNotMatch(button(html, 'Enroll 1 into SY 2027-2028'), /disabled=""/);
  assert.match(html, /2 students with recorded decisions are blocked from next-year enrollment/);
  assert.match(html, /The 1 ready student can still be enrolled/);
  assert.match(html, /Pending or unverified payments do not count toward settlement/);
});

test('all-blocked decisions show the settlement requirement without an enrollment action', () => {
  const html = render({ changes: { readyToEnroll: 0 } });
  assert.match(html, /Prior bills must be settled/);
  assert.doesNotMatch(html, /Enroll 0|ready student can still be enrolled/);
});

test('carry-forward distinguishes ready and blocked enrollments after the progression window closes', () => {
  const html = render({ changes: { activeYear: targetYear, nextYear: null, progressionOpen: false,
    readyToEnroll: 0, blockedByBalance: 0,
    carryForward: { sourceYear, targetYear, count: 1, blockedByBalance: 2 } } });
  assert.match(html, /1 student is ready for enrollment/);
  assert.match(html, /2 students are blocked by unpaid prior bills/);
  assert.doesNotMatch(button(html, 'Create 1 enrollment'), /disabled=""/);
});

test('carry-forward with no ready enrollments shows a disabled settlement action', () => {
  const html = render({ changes: { progressionOpen: false, readyToEnroll: 0, blockedByBalance: 0,
    carryForward: { sourceYear, targetYear, count: 0, blockedByBalance: 1 } } });
  assert.match(html, /1 student is blocked by unpaid prior bills/);
  assert.match(button(html, 'Awaiting settlement'), /disabled=""/);
  assert.doesNotMatch(html, /Create 0 enrollments/);
});

test('roster readiness names unpaid bills when academic requirements are complete', () => {
  const html = render({ rows: [student] });
  assert.match(html, /Unpaid prior bills/);
  assert.doesNotMatch(html, />4\/4</);
});

test('top-grade graduation readiness is not blocked by prior bills', () => {
  const html = render({ rows: [{ ...student, isTopGrade: true, eligible: true, yearLevel: 'grade_12', nextYearLevel: null }] });
  assert.match(html, />Ready</);
  assert.doesNotMatch(html, /Unpaid prior bills/);
});
