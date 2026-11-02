import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { FeeEstimate } = await server.ssrLoadModule('/src/features/fees/fee-estimate.tsx');
const estimate = {
  schoolYear: '2026-2027', yearLevel: 'grade_11', publishedAt: '2026-06-01T00:00:00Z',
  items: [{ id: 1, name: 'Tuition fee', category: 'tuition', amount: 1000.10 }],
  total: 1000.10, downpayment: 200.25, installments: [266.61, 266.61, 266.63],
};
function render({ yearLevel = 'grade_11', data = estimate, error = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (data) client.setQueryData(['fee-estimate', '2026-2027', 'grade_11'], data);
  if (error) client.getQueryCache().find({ queryKey: ['fee-estimate', '2026-2027', 'grade_11'] }).setState({ status: 'error', error: new Error('Unavailable') });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(FeeEstimate, { schoolYear: '2026-2027', yearLevel })));
  client.clear();
  return html;
}
test('applicants see full-year cost separately from downpayment and exact installments', () => {
  const html = render();
  for (const value of ['Estimated fees', 'Tuition fee', '1,000.10', '200.25', '266.61', '266.63', 'Full academic year', 'Downpayment', 'approval']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /Pay now|Payment due now/);
});
test('changing grade never shows the previous grade estimate while loading', () => {
  const html = render({ yearLevel: 'grade_12' });
  assert.match(html, /Loading estimated fees/);
  assert.doesNotMatch(html, /1,000.10|Tuition fee/);
});
test('missing grade asks for selection rather than showing a zero estimate', () => {
  const html = render({ yearLevel: '' });
  assert.match(html, /Select your year level/);
  assert.doesNotMatch(html, /₱0/);
});
test('failed refresh hides stale fees and provides a retry', () => {
  const html = render({ error: true });
  assert.match(html, /Unable to load estimated fees/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /1,000.10/);
});
test('zero fees do not render a fabricated payment schedule', () => {
  const html = render({ data: { ...estimate, items: [{ ...estimate.items[0], amount: 0 }], total: 0, downpayment: 0, installments: [] } });
  assert.match(html, /₱0.00/);
  assert.match(html, /No installments/);
});
