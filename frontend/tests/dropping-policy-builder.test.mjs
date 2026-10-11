import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { periodDateProblems } = await server.ssrLoadModule('/src/features/dropping-finance/policy-builder.ts');
const { DroppingPeriods } = await server.ssrLoadModule('/src/features/dropping-finance/policy-editor.tsx');
const term = { id: 1, startDate: '2026-06-01', endDate: '2027-03-31' };
const fee = { id: 2, name: 'Laboratory fee', amount: 1000, yearLevel: 'all', category: 'other' };
const periods = {
  enrollment: { startsOn: '2026-05-01', endsOn: '2026-05-31' },
  quarter_1: { startsOn: '2026-06-01', endsOn: '2026-08-31' },
  quarter_2: { startsOn: '2026-09-01', endsOn: '2026-10-31' },
  quarter_3: { startsOn: '2026-11-01', endsOn: '2027-01-31' },
  quarter_4: { startsOn: '2027-02-01', endsOn: '2027-03-31' },
};
function render(fees = [fee], policy = null) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['dropping-policy', 1], policy);
  client.setQueryData(['admin', 'fees', 1], fees);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(DroppingPeriods, { term }))));
  client.clear();
  return html;
}

test('all five periods are directly available without a setup wizard', () => {
  const html = render();
  assert.equal((html.match(/aria-label="Add Paying policy for /g) ?? []).length, 5);
  assert.equal((html.match(/aria-label="Add With voucher policy for /g) ?? []).length, 5);
  assert.equal((html.match(/aria-label="Set dates for /g) ?? []).length, 5);
  assert.match(html, /Enrollment period/);
  assert.match(html, /Final quarter/);
  assert.doesNotMatch(html, /Next period|Review policy|Search and select fees/);
});
test('a saved paying policy exposes its charge and an independent voucher add action', () => {
  const html = render([fee], { periods: { enrollment: periods.enrollment }, feeRules: { paying: { enrollment: [{feeId: 2, percent: 50, name: fee.name}] }, voucher_esc: { enrollment: [] } } });
  assert.match(html, /aria-label="Edit Paying policy for Enrollment period"/);
  assert.match(html, /aria-label="Edit dates for Enrollment period"/);
  assert.match(html, /aria-label="Add With voucher policy for Enrollment period"/);
  assert.match(html, /Laboratory fee/);
  assert.match(html, /50% charge/);
  assert.match(html, /₱500\.00/);
  assert.match(html, /Student charges use their original bill/);
  assert.equal((html.match(/aria-label="Add /g) ?? []).length, 9);
});
test('both configured categories expose edit, full percentages, and rounded peso amounts', () => {
  const html = render([{ ...fee, amount: 170.55 }], { periods: { quarter_2: periods.quarter_2 }, feeRules: { paying: { quarter_2: [{ feeId: 2, percent: 100, name: fee.name }] }, voucher_esc: { quarter_2: [{ feeId: 2, percent: 50, name: fee.name }] } } });
  assert.match(html, /aria-label="Edit Paying policy for Second quarter"/);
  assert.match(html, /aria-label="Edit With voucher policy for Second quarter"/);
  assert.match(html, /100% charge/);
  assert.match(html, /₱170\.55/);
  assert.match(html, /₱85\.28/);
});
test('unavailable fees keep the saved rule without inventing a charge amount', () => {
  const html = render([], { periods: { enrollment: periods.enrollment }, feeRules: { paying: { enrollment: [{ feeId: 2, percent: 100, name: fee.name }] } } });
  assert.match(html, /Laboratory fee/);
  assert.match(html, /100% charge/);
  assert.match(html, /Amount unavailable/);
  assert.doesNotMatch(html, /₱0\.00/);
});
test('legacy formulas remain visible as original-bill charges', () => {
  const html = render([fee], { id: 1, periods: { enrollment: periods.enrollment }, feeRules: null });
  assert.equal((html.match(/aria-label="Edit (Paying|With voucher) policy for /g) ?? []).length, 2);
  assert.match(html, /Registration/);
  assert.match(html, /Based on the original bill/);
  assert.doesNotMatch(html, /₱/);
});
test('fees configured before dates remain editable without implying the period dates are set', () => {
  const html = render([fee], { id: 1, periods: {}, feeRules: { paying: { enrollment: [] }, voucher_esc: { enrollment: [{ feeId: 2, percent: 50, name: fee.name }] } } });
  assert.match(html, /aria-label="Set dates for Enrollment period"/);
  assert.match(html, /aria-label="Edit With voucher policy for Enrollment period"/);
  assert.match(html, /aria-label="Add Paying policy for Enrollment period"/);
  assert.match(html, /₱500\.00/);
});
test('a single period can be configured before neighboring periods', () => {
  assert.deepEqual(periodDateProblems('quarter_2', { quarter_2: periods.quarter_2 }, term), []);
  assert.deepEqual(periodDateProblems('enrollment', { enrollment: periods.enrollment }, term), []);
});
test('date validation rejects missing dates, reversed ranges, overlaps and incomplete year boundaries', () => {
  assert.match(periodDateProblems('enrollment', {}, term).join(' '), /Choose/);
  assert.match(periodDateProblems('quarter_1', { quarter_1: { startsOn: '2026-08-01', endsOn: '2026-06-01' } }, term).join(' '), /end date/);
  assert.match(periodDateProblems('quarter_2', { ...periods, quarter_2: { ...periods.quarter_2, startsOn: '2026-08-31' } }, term).join(' '), /Start after/);
  assert.match(periodDateProblems('quarter_1', { ...periods, quarter_1: { ...periods.quarter_1, endsOn: '2026-09-01' } }, term).join(' '), /End before/);
  assert.match(periodDateProblems('quarter_4', { quarter_4: { ...periods.quarter_4, endsOn: '2027-03-01' } }, term).join(' '), /year’s end/);
});
