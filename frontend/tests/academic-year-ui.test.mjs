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
const { ReferralIncentiveEditor } = await server.ssrLoadModule('/src/features/terms/term-forms.tsx');
const { ReferralPolicyDetails } = await server.ssrLoadModule('/src/features/referrals/components/referral-policy-guide.tsx');
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
  const early = panel.match(/<section aria-label="Early-enrollment freebie">[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(early, /<button[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?Edit freebie<\/button>/);
  assert.match(early, /Window starts/);
  assert.match(early, /Window ends/);
  assert.doesNotMatch(early, /role="checkbox"|Save freebie|Cancel/);
  assert.doesNotMatch(panel, /No enrollment window yet|No referral incentive yet|Set up incentive/);
});

test('referral cards offer the guide without showing detailed policy in any saved state', () => {
  for (const referral of [undefined, freebies[1], { ...freebies[1], isActive: true }]) {
    const campaigns = referral ? [freebies[0], referral] : [freebies[0]];
    const panel = selectedPanel(renderPage('/admin/terms/7?section=incentives', [term], campaigns));
    const summary = panel.match(/<section aria-label="Referral tuition incentive">[\s\S]*?<\/section>/)?.[0];
    assert.ok(summary);
    assert.match(summary, /<button[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?How referrals work<\/button>/);
    assert.equal((summary.match(/How referrals work/g) ?? []).length, 1);
    assert.match(summary, /<button[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?(?:Edit incentive|Set up incentive)<\/button>/);
    assert.match(summary, /role="status"/);
    assert.doesNotMatch(summary, /<details|role="checkbox"|Save changes|Each student qualifies with their own voucher/);
    assert.doesNotMatch(summary, /Their application is accepted|miscellaneous fees|Voucher requirement|Previous payments|Disabling stops|once per school year/);
  }
});

test('the shared referral guide keeps eligibility, billing, and campaign rules together', () => {
  const html = renderToStaticMarkup(createElement(ReferralPolicyDetails));
  assert.match(html, /Grade 11 in the previous school year/);
  assert.match(html, /before submitting their application/);
  assert.match(html, /Students cannot refer themselves/);
  assert.match(html, /Their application is accepted with a valid referral code/);
  assert.match(html, /One referred Grade 11 student must be officially enrolled/);
  assert.match(html, /awarded once per school year/);
  assert.match(html, /Extra referrals do not add credit/);
  assert.match(html, /Each student must have their own active voucher/);
  assert.match(html, /a missing voucher for one student does not block the other/);
  assert.match(html, /remaining unpaid bill, including miscellaneous fees, after their voucher is applied/);
  assert.match(html, /Previous payments are not refunded or carried forward/);
  assert.match(html, /no additional credit is issued/);
  assert.match(html, /Set an enrollment cutoff before enabling referrals during normal admissions/);
  assert.match(html, /Disabling stops new referral codes and claims/);
  assert.match(html, /Existing successful referrals and applied benefits are kept/);
});

function renderReferralEditor(props = {}) {
  return renderToStaticMarkup(createElement(ReferralIncentiveEditor, {
    enabled: true, hasChanges: false, saving: false,
    cutoff: '2026-11-30', cutoffLocked: false, onCutoffChange: () => {},
    startDate: term.startDate, endDate: term.endDate,
    onEnabledChange: () => {}, onCancel: () => {}, onSave: () => {},
    ...props,
  }));
}

test('referral editor protects unchanged and pending submissions while keeping cancellation available', () => {
  const unchanged = renderReferralEditor();
  assert.match(unchanged, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>Save changes<\/button>/);
  const cancel = unchanged.match(/<button[^>]*>Cancel<\/button>/)?.[0];
  assert.ok(cancel);
  assert.doesNotMatch(cancel, / disabled=""/);
  const changed = renderReferralEditor({ enabled: false, hasChanges: true });
  assert.match(changed, /role="checkbox"[^>]*aria-checked="false"/);
  const submit = changed.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
  assert.ok(submit);
  assert.doesNotMatch(submit, / disabled=""/);
  const pending = renderReferralEditor({ enabled: false, hasChanges: true, saving: true });
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /role="checkbox"[^>]*disabled=""/);
  assert.match(pending, /<button[^>]*disabled=""[^>]*>Cancel<\/button>/);
  assert.match(pending, /<button[^>]*disabled=""[^>]*>Saving…<\/button>/);
});

test('a failed referral save keeps the draft and access to the guide without repeating its content', () => {
  const html = renderReferralEditor({ enabled: false, hasChanges: true, error: 'Unable to save. Please try again.' });
  assert.match(html, /role="alert"[^>]*>Unable to save\. Please try again\./);
  assert.match(html, /role="checkbox"[^>]*aria-checked="false"/);
  assert.match(html, /<button[^>]*type="button"[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?How referrals work<\/button>/);
  assert.doesNotMatch(html, /Grade 11 applicant|Grade 12 referrer|No separate date window|Existing successful referrals|miscellaneous fees/);
  const id = html.match(/<label for="([^"]+)"/)?.[1];
  assert.ok(id);
  assert.ok(html.includes(`id="${id}"`));
});

test('unconfigured incentives explain the next step without presenting them as saved but disabled', () => {
  const panel = selectedPanel(renderPage('/admin/terms/7?section=incentives', [term], []));
  assert.match(panel, /No enrollment window yet/);
  assert.match(panel, /No referral incentive yet/);
  assert.match(panel, /Set up freebie/);
  assert.match(panel, /Set up incentive/);
  assert.match(panel, /<button[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?Set up freebie<\/button>/);
  assert.match(panel, /href="\/admin\/referrals"/);
  assert.doesNotMatch(panel, /Disabled|Edit freebie|Edit incentive/);
});

test('missing years show recovery and unknown sections fall back to overview', () => {
  assert.match(renderPage('/admin/terms/999'), /Academic year not found/);
  assert.match(renderPage('/admin/terms/999'), /href="\/admin\/terms"/);
  assert.match(selectedPanel(renderPage('/admin/terms/7?section=unknown')), /Deactivate year/);
});


test('the referral deadline is visible and published cutoffs cannot be edited', () => {
  const html = renderReferralEditor({ cutoffLocked: true });
  assert.match(html, /Referral enrollment cutoff/);
  const picker = html.match(/<button[^>]*id="[^"]+-cutoff"[^>]*>/)?.[0];
  assert.ok(picker);
  assert.match(picker, /aria-haspopup="dialog"/);
  assert.match(picker, /disabled=""/);
  assert.match(html, /November 30th, 2026/);
  const missingCutoff = renderReferralEditor({ cutoff: '', hasChanges: true });
  assert.match(missingCutoff, /Select cutoff date/);
  assert.match(missingCutoff, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>Save changes<\/button>/);
});

test('referral cutoff validation rejects dates outside the year and accepts both boundaries', () => {
  for (const [cutoff, valid] of [['2027-10-03', false], ['2027-10-04', true], ['2028-08-25', true], ['2028-08-26', false]]) {
    const html = renderReferralEditor({ cutoff, hasChanges: true, startDate: '2027-10-04', endDate: '2028-08-25' });
    const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
    assert.ok(submit);
    assert.equal(submit.includes('disabled=""'), !valid, cutoff);
    const picker = html.match(/<button[^>]*id="[^"]+-cutoff"[^>]*>/)?.[0];
    assert.ok(picker);
    if (!valid) {
      assert.match(picker, /aria-invalid="true"/);
      assert.match(html, /role="alert"[^>]*>Choose a date/);
    }
  }
});

test('draft fees block opening admissions and link to the matching fee schedule', () => {
  const panel = selectedPanel(renderPage('/admin/terms/7', [{ ...term, admissionOpen: false, feesPublishedAt: null }]));
  const button = panel.match(/<button[^>]*>Open admissions<\/button>/)?.[0];
  assert.match(button ?? '', /disabled=""/);
  assert.match(panel, /href="\/admin\/fees\?school_year_id=7"/);
  assert.match(panel, /Publish the fee schedule before opening admissions/);
});
