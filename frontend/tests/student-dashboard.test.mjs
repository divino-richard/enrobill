import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { dashboardSchedule, schoolMoment } = await server.ssrLoadModule('/src/features/students/dashboard-schedule.ts');
const { DashboardClasses } = await server.ssrLoadModule('/src/features/students/components/dashboard-classes.tsx');
const { DashboardBilling } = await server.ssrLoadModule('/src/features/students/components/dashboard-billing.tsx');
const { StudentDashboard } = await server.ssrLoadModule('/src/features/students/components/student-dashboard.tsx');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');

const morning = { id: 'science', day: 1, startTime: '07:30', endTime: '08:30', subject: 'Science', room: '123', teacher: 'Heidi Best' };
const later = { ...morning, id: 'math', startTime: '09:00', endTime: '10:00', subject: 'Mathematics' };
const tomorrow = { ...morning, id: 'english', day: 2, subject: 'English' };
const schedule = { status: 'published', section: { name: 'A' }, entries: [later, tomorrow, morning] };
const bill = { id: 7, schoolYear: '2026-2027', status: 'partial', total: 18421.25, netTotal: 18421.25, amountPaid: 170, balance: 18251.25, amountDue: 1520.93, payments: [], installments: [{ id: 1, sequence: 1, balance: 1520.93, dueDate: '2026-11-05', status: 'unpaid' }] };
const at = time => new Date(`2026-10-19T${time}:00+08:00`);
const classes = (time, value = schedule) => renderToStaticMarkup(createElement(DashboardClasses, { schedule: value, now: at(time) }));
const billing = (value = bill, today = '2026-10-19') => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(DashboardBilling, { bill: value, today })));

test('classes change at their start and end, and use Manila time', () => {
  assert.deepEqual(dashboardSchedule(schedule.entries, at('07:29')).classes.map(item => item.state), ['Up next', 'Later today']);
  assert.deepEqual(dashboardSchedule(schedule.entries, at('07:30')).classes.map(item => item.state), ['In progress', 'Up next']);
  const ended = dashboardSchedule(schedule.entries, at('08:30'));
  assert.deepEqual(ended.finished.map(item => item.id), ['science']);
  assert.deepEqual(ended.classes.map(item => item.state), ['Up next']);
  assert.equal(schoolMoment(new Date('2026-10-19T16:00:00Z')).date, '2026-10-20');
});

test('the next class wraps to next week when the final class has ended', () => {
  assert.equal(dashboardSchedule([morning], at('08:30')).next.daysAhead, 7);
  assert.match(classes('10:00', { ...schedule, entries: [morning] }), /Next Monday/);
});

test('the day changes at Manila midnight, not the browser timezone', () => {
  const before = dashboardSchedule(schedule.entries, new Date('2026-10-19T15:59:00Z'));
  const after = dashboardSchedule(schedule.entries, new Date('2026-10-19T16:00:00Z'));
  assert.equal(before.classes.length, 0);
  assert.equal(before.finished.length, 2);
  assert.equal(after.finished.length, 0);
  assert.equal(after.classes[0].id, 'english');
  assert.equal(after.classes[0].state, 'Up next');
});

test('class location is explicit and finished classes remain available without dominating', () => {
  assert.match(classes('07:45'), /Room 123 · Heidi Best/);
  const html = classes('10:00');
  assert.match(html, /Classes finished for today/);
  assert.match(html, /Next class:.*English/);
  assert.match(html, /Tomorrow · 7:30 AM/);
  assert.match(html, /Finished today \(2\)/);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
});

test('empty and unpublished schedules have distinct states and do not expose stale entries', () => {
  assert.match(classes('07:00', { ...schedule, entries: [] }), /No classes today/);
  const html = classes('07:00', { ...schedule, status: 'not_published' });
  assert.match(html, /Your schedule is on its way/);
  assert.doesNotMatch(html, /Science|Room 123/);
});

test('upcoming bills are calm and verified cash remains distinct from applied credits', () => {
  const html = billing({ ...bill, balance: 16151.25, appliedCredits: [{ kind: 'returning_student', label: 'Returning student credit', amount: 2100 }] });
  assert.match(html, /Next payment/);
  assert.match(html, /Due Nov 5, 2026/);
  assert.match(html, /No payment is overdue on this bill/);
  assert.match(html, /Verified payments<\/dt><dd[^>]*>₱170\.00/);
  assert.match(html, /Returning student credit<\/dt><dd[^>]*>₱2,100\.00/);
  assert.match(html, /Remaining balance<\/dt><dd[^>]*>₱16,151\.25/);
  assert.doesNotMatch(html, /bg-amber|% covered|role="progressbar"/);
});

test('billing distinguishes due today, overdue, unknown dates and settled balances', () => {
  assert.match(billing(bill, '2026-11-05'), /Payment due today/);
  assert.match(billing(bill, '2026-11-06'), /Payment overdue/);
  assert.match(billing(bill, '2026-11-06'), /Overdue since Nov 5, 2026/);
  const undated = billing({ ...bill, installments: [] });
  assert.match(undated, /See your bill for payment details/);
  assert.doesNotMatch(undated, /No payment is overdue/);
  const settled = billing({ ...bill, balance: 0, amountDue: 0, status: 'paid' });
  assert.match(settled, /Bill settled/);
  assert.match(settled, /View statement/);
  assert.doesNotMatch(settled, /View bill &amp; pay|Payment overdue|Next payment/);
});

test('pending verification points to the submitted payment without changing the authoritative balance', () => {
  const html = billing({ ...bill, payments: [{ id: 1, status: 'pending', amount: 1520.93 }] }, '2026-11-06');
  assert.match(html, /Payment awaiting verification/);
  assert.match(html, /₱1,520\.93 submitted/);
  assert.match(html, /href="\/portal\/bills\/7\?tab=payments"/);
  assert.match(html, /Remaining balance<\/dt><dd[^>]*>₱18,251\.25/);
  assert.doesNotMatch(html, /View bill &amp; pay|Payment overdue/);
  assert.match(billing({ ...bill, pendingPaymentCount: 1 }), /Payment awaiting verification/);
});

function freeze(t) {
  t.mock.timers.enable({ apis: ['Date'], now: at('07:00') });
  t.after(() => t.mock.timers.reset());
}

function dashboard({ value = bill, returned = false, state = 'ready' } = {}) {
  const user = { id: 12, role: 'student' };
  useAuthStore.setState({ user });
  Object.assign(useAuthStore.getInitialState(), { user });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, retryOnMount: false } } });
  client.setQueryData(['me', 'student'], { id: 4, firstName: 'Regan', studentNumber: '2026-000004', status: 'enrolled', trackOrStrand: 'gas', yearLevel: 'grade_11' });
  client.setQueryData(['me', 're-enrollment', 12], { state: 'enrolled', source: null });
  const keys = [['me', 'bill'], ['me', 'class-schedule', 12, undefined], ['me', 'documents']];
  if (state === 'ready') {
    client.setQueryData(keys[0], value);
    client.setQueryData(keys[1], schedule);
    client.setQueryData(keys[2], returned ? [{ id: 1, reviewStatus: 'returned' }] : []);
  } else if (state === 'error') {
    keys.forEach(queryKey => client.getQueryCache().build(client, { queryKey }).setState({ status: 'error', error: new Error('Unavailable') }));
  }
  client.setQueryData(['me', 'referrals', undefined], { eligibleToRefer: false, code: null, campaignEnabled: true, benefitStatus: 'not_earned', referrals: [], successfulCount: 0, targetSchoolYear: { id: 1, schoolYear: '2026-2027' } });
  client.setQueryData(['programs'], [{ id: 1, code: 'gas', name: 'GAS (General Academic Strand)', isActive: true }]);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(StudentDashboard))));
  client.clear();
  return html;
}

test('routine days put classes first with direct schedule/document links and quiet referral access', t => {
  freeze(t);
  const html = dashboard({ returned: true });
  assert.ok(html.indexOf('Today’s classes') < html.indexOf('Fees &amp; payments'));
  assert.ok(html.indexOf('document needs') < html.indexOf('Today’s classes'));
  assert.match(html, /href="\/portal\/programs\?section=schedule"/);
  assert.match(html, /href="\/portal\/programs\?section=clearance-grades"/);
  assert.match(html, /GAS \(General Academic Strand\)/);
  assert.match(html, /Referral requirements/);
  assert.doesNotMatch(html, /Referral tuition incentive/);
});

test('due or overdue bills move before classes and are rendered only once', t => {
  freeze(t);
  for (const dueDate of ['2026-10-19', '2026-10-18']) {
    const html = dashboard({ value: { ...bill, installments: [{ ...bill.installments[0], dueDate }] } });
    assert.ok(html.indexOf('Fees &amp; payments') < html.indexOf('Today’s classes'));
    assert.equal((html.match(/id="student-bill-title"/g) ?? []).length, 1);
  }
});

test('panel loading, errors and a missing bill remain distinct', t => {
  freeze(t);
  const loading = dashboard({ state: 'loading' });
  assert.match(loading, /Loading your bill|Loading your schedule/);
  assert.doesNotMatch(loading, /No bill yet|No classes today/);
  const failed = dashboard({ state: 'error' });
  assert.match(failed, /Your bill couldn’t be loaded/);
  assert.match(failed, /Your schedule couldn’t be loaded/);
  assert.match(failed, /Document updates couldn’t be loaded/);
  assert.doesNotMatch(failed, /No bill yet|No classes today/);
  assert.match(dashboard({ value: null }), /No bill yet/);
});
