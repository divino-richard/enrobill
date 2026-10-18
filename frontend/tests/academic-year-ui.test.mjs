import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { default: TermsPage } = await server.ssrLoadModule('/src/pages/admin/terms-page.tsx');
const { default: TermDetailPage } = await server.ssrLoadModule('/src/pages/admin/term-detail-page.tsx');
const { TooltipProvider } = await server.ssrLoadModule('/src/components/ui/tooltip.tsx');
const term = {
  id: 7, schoolYear: '2026-2027', startDate: '2026-10-05', endDate: '2027-09-24',
  isActive: true, admissionOpen: true, progressionOpen: false, progressionOverride: null,
  progressionAuto: false, downpaymentValue: 170, installmentCount: 12, createdAt: null,
};
const freebies = [
  { id: 1, schoolYearId: 7, type: 'early_enrollment', name: 'Early Enrollment Promo', isActive: true, startsOn: '2026-10-05', endsOn: '2026-10-31' },
  { id: 2, schoolYearId: 7, type: 'referral', name: 'Referral Tuition Incentive', isActive: false, startsOn: null, endsOn: null },
];
function renderPage(url, years = [term], campaigns = freebies) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['admin', 'terms'], years);
  client.setQueryData(['dropping-policy', 7], { id: null, schoolYearId: 7, version: 0, enabled: false, periods: {} });
  client.setQueryData(['admin', 'freebies', 'school-year', 7], campaigns);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(TooltipProvider, null, createElement(MemoryRouter, { initialEntries: [url] }, createElement(Routes, null,
      createElement(Route, { path: '/admin/terms', element: createElement(TermsPage) }),
      createElement(Route, { path: '/admin/terms/:id', element: createElement(TermDetailPage) }))))));
  client.clear();
  return html;
}
function selectedPanel(html) {
  return html.match(/<div[^>]*data-state="active"[^>]*role="tabpanel"[^>]*>[\s\S]*?(?=<div[^>]*data-state="inactive"[^>]*role="tabpanel"|$)/)?.[0] ?? '';
}

test('the year list links to details without exposing configuration actions in a menu', () => {
  const html = renderPage('/admin/terms');
  assert.match(html, /href="\/admin\/terms\/7"/);
  assert.match(html, /View details for SY 2026-2027/);
  const row = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  assert.equal((row.match(/<a /g) ?? []).length, 1, 'each year exposes one native navigation link');
  assert.doesNotMatch(row, />View details</);
  assert.doesNotMatch(html, /role="menu"|aria-haspopup="menu"|Deactivate year|Close admissions|Enable progression|Delete year/);
});

test('overview exposes year, admissions, progression, and installment settings together', () => {
  const html = renderPage('/admin/terms/7');
  const panel = selectedPanel(html);
  assert.match(panel, /School year/);
  assert.match(panel, /Close admissions/);
  assert.match(panel, /Enable progression/);
  assert.match(panel, /Installment policy/);
  assert.doesNotMatch(panel, /Configure policy|Edit incentive/);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 3);
  assert.doesNotMatch(html, />Payment plan<|trigger-payments|content-payments/);
  assert.match(panel, /<section aria-label="Delete academic year"/);
  assert.match(panel, />Delete year<\/button>/);
  assert.doesNotMatch(panel, /<details|<summary/);
});

test('inactive years cannot open admissions or progression', () => {
  const html = renderPage('/admin/terms/7', [{ ...term, isActive: false, admissionOpen: false }]);
  for (const label of ['Open admissions', 'Enable progression']) {
    const button = html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0];
    assert.ok(button);
    assert.match(button, / disabled=""/);
  }
  assert.match(html, />Set as active<\/button>/);
});

test('old payment plan links open overview with saved amounts and a modal edit action', () => {
  const panel = selectedPanel(renderPage('/admin/terms/7?section=payments'));
  assert.match(panel, /Installment policy/);
  assert.match(panel, /170\.00/);
  assert.match(panel, /12 monthly installments/);
  assert.match(panel, /<button[^>]*aria-haspopup="dialog"[^>]*>Edit policy<\/button>/);
  assert.match(panel, /Deactivate year/);
  assert.match(panel, /Close admissions/);
  assert.doesNotMatch(panel, /Save policy|Downpayment type/);
});

test('downpayments are always peso amounts in the overview and academic year list', () => {
  const years = [{ ...term, downpaymentValue: 20, installmentCount: 1 }];
  const panel = selectedPanel(renderPage('/admin/terms/7', years));
  assert.match(panel, /₱20\.00 downpayment · 1 monthly installment</);
  assert.match(renderPage('/admin/terms', years), /₱20\.00 down · 1 monthly/);
  assert.doesNotMatch(panel, /20%|1 monthly installments/);
});

test('unconfigured dropping policy has its own clear setup entry', () => {
  const panel = selectedPanel(renderPage('/admin/terms/7?section=dropping'));
  assert.match(panel, /Dates not configured/);
  assert.match(panel, /Add Paying policy for Enrollment period/);
  assert.match(panel, /Add With voucher policy for Final quarter/);
  assert.doesNotMatch(panel, /Next period|Review policy/);
  assert.doesNotMatch(panel, /Edit freebie|Edit policy/);
});

test('incentives preserve separate configurations and their saved states', () => {
  const panel = selectedPanel(renderPage('/admin/terms/7?section=incentives'));
  assert.match(panel, /Early-enrollment freebie/);
  assert.match(panel, /Referral tuition incentive/);
  assert.match(panel, /Enabled/);
  assert.match(panel, /Disabled/);
  assert.match(panel, /Oct 31, 2026/);
  assert.match(panel, /Edit freebie/);
  assert.match(panel, /Edit incentive/);
  assert.doesNotMatch(panel, /No enrollment window yet|No referral incentive yet|Set up incentive/);
});

test('unconfigured incentives explain the next step without presenting them as saved but disabled', () => {
  const panel = selectedPanel(renderPage('/admin/terms/7?section=incentives', [term], []));
  assert.match(panel, /No enrollment window yet/);
  assert.match(panel, /No referral incentive yet/);
  assert.match(panel, /Set up freebie/);
  assert.match(panel, /Set up incentive/);
  assert.match(panel, /href="\/admin\/referrals"/);
  assert.doesNotMatch(panel, /Disabled|Edit freebie|Edit incentive/);
});

test('missing years show recovery and unknown sections fall back to overview', () => {
  assert.match(renderPage('/admin/terms/999'), /Academic year not found/);
  assert.match(renderPage('/admin/terms/999'), /href="\/admin\/terms"/);
  assert.match(selectedPanel(renderPage('/admin/terms/7?section=unknown')), /Deactivate year/);
});
