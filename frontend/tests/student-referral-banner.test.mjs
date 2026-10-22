import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => server.close());
const { StudentReferralCard, StudentReferralDetails, StudentReferralRequirements } = await server.ssrLoadModule(
  "/src/features/referrals/components/student-referral-card.tsx",
);
const { Sheet } = await server.ssrLoadModule('/src/components/ui/sheet.tsx');

function renderDetails(summary, props = {}) {
  return renderToStaticMarkup(createElement(Sheet, null,
    createElement(StudentReferralDetails, { summary, onCreate: () => {}, onCopy: () => {}, ...props })));
}

function renderBanner(summary, props = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["me", "referrals", undefined], summary);
  const html = renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(StudentReferralCard, props)),
  );
  client.clear();
  return html;
}

const base = {
  eligibleToRefer: true,
  campaignEnabled: true,
  targetSchoolYear: { id: 1, schoolYear: "2026-2027" },
  successfulCount: 0,
  benefitStatus: "not_earned",
  referrals: [],
};

test("the dashboard exposes one closed referral entry point, not the full workflow", () => {
  const html = renderBanner({
    ...base,
    code: { id: 1, code: "PRIVATE-REFERRAL-CODE", isActive: true },
    referrals: [{ id: 1, referredDisplay: "Sample S.", status: "claimed" }],
  });
  assert.match(html, /View referrals/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /PRIVATE-REFERRAL-CODE|Sample S\.|How the tuition benefit works/);
});

test("a potential referrer without a code can still open referral details", () => {
  const html = renderBanner({ ...base, code: null });
  assert.match(html, /Start referring/);
  assert.doesNotMatch(html, /Create referral code|Referral progress/);
});

test("ineligible students without an existing code remain hidden", () => {
  assert.equal(renderBanner({ ...base, eligibleToRefer: false, code: null }), "");
});

test("paused campaigns and inactive codes offer review, not a sharing invitation", () => {
  for (const summary of [
    { ...base, campaignEnabled: false, code: { id: 1, code: "EXISTING", isActive: true } },
    { ...base, code: { id: 1, code: "INACTIVE", isActive: false } },
    { ...base, targetSchoolYear: null, code: null },
  ]) {
    const html = renderBanner(summary);
    assert.match(html, /View referral/);
    assert.doesNotMatch(html, /Share your code|Start referring|Unlock your tuition benefit/);
  }
});

test("compact unavailable referrals offer a quiet, accessible requirements entry point", () => {
  for (const summary of [
    { ...base, eligibleToRefer: false, code: null },
    { ...base, targetSchoolYear: null, code: null },
    { ...base, campaignEnabled: false, code: null },
    { ...base, code: { id: 1, code: "INACTIVE", isActive: false } },
  ]) {
    const html = renderBanner(summary, { compact: true, showWhenUnavailable: true });
    assert.match(html, /Referral requirements/);
    assert.match(html, /aria-haspopup="dialog"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /\bh-11\b/);
    assert.doesNotMatch(html, /<section|bg-primary\/5|Referral tuition incentive|To create a referral code/);
  }
});

test("compact eligible referrals keep code creation and sharing prominent", () => {
  for (const [summary, action] of [
    [{ ...base, code: null }, "Start referring"],
    [{ ...base, code: { id: 1, code: "ACTIVE", isActive: true } }, "View referrals"],
  ]) {
    const html = renderBanner(summary, { compact: true, showWhenUnavailable: true });
    assert.match(html, /<section[^>]+aria-label="Referral tuition incentive"/);
    assert.match(html, new RegExp(action));
    assert.doesNotMatch(html, /Referral requirements/);
  }
});

test("compact unavailable referrals retain a prominent entry point when progress exists", () => {
  for (const progress of [
    { referrals: [{ id: 1, referredDisplay: "Sample S.", status: "claimed" }] },
    { successfulCount: 1 },
    { benefitStatus: "pending" },
    { benefitStatus: "eligible" },
    { benefitStatus: "applied" },
    { benefitStatus: "applied_no_balance" },
  ]) {
    const html = renderBanner(
      { ...base, campaignEnabled: false, code: null, ...progress },
      { compact: true, showWhenUnavailable: true },
    );
    assert.match(html, /<section[^>]+aria-label="Referral tuition incentive"/);
    assert.match(html, /View referral/);
    assert.doesNotMatch(html, /Referral requirements/);
  }
});

test("noncompact unavailable referrals retain their existing explanation and action", () => {
  const html = renderBanner(
    { ...base, eligibleToRefer: false, code: null },
    { showWhenUnavailable: true },
  );
  assert.match(html, /To create a referral code, you must have been enrolled in Grade 11/);
  assert.match(html, /View referral/);
  assert.doesNotMatch(html, /Referral requirements/);
});

test('ineligible students see requirements instead of a disabled workflow', () => {
  const html = renderDetails({ ...base, eligibleToRefer: false, code: null });
  assert.match(html, /Referral requirements/);
  assert.match(html, /You’re not eligible to create a code/);
  assert.match(html, /must have been enrolled in Grade 11 in the previous school year/);
  assert.match(html, /enrollment history looks incorrect, contact Northlink/);
  assert.doesNotMatch(html, /Create referral code|Waiting for a student|No enrolled referral yet|0 successful|Only one is required|Referred applicants|No applications linked/);
});

test('code and live progress share one view while program rules stay collapsed', () => {
  const summary = { ...base, code: { code: 'PRIVATE-CODE', isActive: true }, successfulCount: 1,
    benefitStatus: 'pending', referrals: [{ id: 1, referredDisplay: 'Sample S.', status: 'successful' }] };
  const html = renderDetails(summary);
  assert.doesNotMatch(html, /role="tab(list|panel)?"/);
  assert.match(html, /PRIVATE-CODE/);
  assert.match(html, /Copy code/);
  assert.match(html, /Your progress/);
  assert.match(html, /Waiting for Grade 12 enrollment/);
  assert.match(html, /Sample S\./);
  assert.match(html, /Student enrolled/);
  assert.match(html, /aria-expanded="false"[^>]*data-slot="accordion-trigger"/);
  assert.match(html, /How referrals work/);
  assert.doesNotMatch(html, /At least one referred|Payments made before|Your Grade 12 benefit is awarded/);
  assert.ok(html.indexOf('PRIVATE-CODE') < html.indexOf('Your progress'));
  assert.ok(html.indexOf('Sample S.') < html.indexOf('How referrals work'));
});

test('requirements preserve all program conditions when expanded', () => {
  const html = renderToStaticMarkup(createElement(StudentReferralRequirements, { defaultOpen: true }));
  assert.match(html, /aria-expanded="true"[^>]*data-slot="accordion-trigger"/);
  assert.match(html, /At least one referred Grade 11 student must become officially enrolled/);
  assert.match(html, /active voucher for your own Grade 12 enrollment/);
  assert.match(html, /remaining unpaid Grade 12 bill, including miscellaneous fees, after your voucher/);
  assert.match(html, /Payments made before this benefit is applied are not refunded or carried forward/);
  assert.match(html, /Each student needs their own active voucher/);
  assert.match(html, /Your Grade 12 benefit is awarded once per school year/);
  assert.match(html, /before submitting their application/);
  assert.match(html, /same code with more than one applicant/);
  assert.doesNotMatch(html, /Referred applicants|Copy code|Your progress/);
});

test('unavailable students without progress see requirements expanded automatically', () => {
  for (const summary of [
    { ...base, eligibleToRefer: false, code: null },
    { ...base, targetSchoolYear: null, code: null },
    { ...base, campaignEnabled: false, code: null },
    { ...base, code: { code: 'INACTIVE', isActive: false } },
  ]) {
    const html = renderDetails(summary);
    assert.match(html, /aria-expanded="true"[^>]*data-slot="accordion-trigger"/);
    assert.match(html, /Grade 12 benefit requirements/);
    assert.doesNotMatch(html, /Your progress|Referred applicants|Copy code/);
  }
});

test('unavailable campaigns distinguish missing school year, pause and inactive code without inviting creation or sharing', () => {
  for (const [summary, reason] of [
    [{ ...base, targetSchoolYear: null, code: null }, 'Referral codes are not available yet'],
    [{ ...base, campaignEnabled: false, code: null }, 'Referrals are paused'],
    [{ ...base, code: { code: 'INACTIVE', isActive: false } }, 'Your referral code is inactive'],
  ]) {
    const html = renderDetails(summary);
    assert.match(html, new RegExp(reason));
    assert.doesNotMatch(html, /Create referral code|Copy code|Referred applicants|Waiting for a student|enrollment history looks incorrect/);
  }
  const existing = renderDetails({ ...base, campaignEnabled: false, code: { code: 'KEPT-FOR-REFERENCE', isActive: true } });
  assert.match(existing, /KEPT-FOR-REFERENCE/);
  assert.match(existing, /Your existing code is kept for reference/);
  assert.doesNotMatch(existing, /Copy code|Share this code with/);
});

test('existing progress remains accessible when code creation or sharing is unavailable', () => {
  const summary = { ...base, eligibleToRefer: false, campaignEnabled: false, code: null, successfulCount: 1, benefitStatus: 'pending', referrals: [{ id: 1, referredDisplay: 'Sample S.', status: 'successful' }] };
  const html = renderDetails(summary);
  assert.match(html, /Referrals are paused/);
  assert.match(html, /Waiting for Grade 12 enrollment/);
  assert.match(html, /1 enrolled referral/);
  assert.match(html, /Sample S\./);
  assert.match(html, /Student enrolled/);
  assert.doesNotMatch(html, /Create referral code|Copy code/);
  assert.match(renderBanner(summary), /View referral/);
});

test('eligible students can create or copy a code without a premature waiting status', () => {
  const fresh = renderDetails({ ...base, code: null });
  assert.match(fresh, /Create your code before making any Grade 12 payment/);
  assert.match(fresh, /Create referral code/);
  assert.doesNotMatch(fresh, /disabled=""|No enrolled referral yet|Referred applicants|No applications linked/);
  const summary = { ...base, code: { code: 'SHARE-ME', isActive: true } };
  const active = renderDetails(summary);
  assert.match(active, /SHARE-ME/);
  assert.match(active, /Copy code/);
  const updates = renderDetails(summary);
  assert.match(updates, /No applications linked yet/);
  assert.doesNotMatch(updates, /View referral code/);
  assert.doesNotMatch(active, /Create referral code|No enrolled referral yet|0 successful/);
});

test('benefit outcomes and individual referral statuses stay server-owned', () => {
  for (const [benefitStatus, label] of [
    ['pending', 'Waiting for Grade 12 enrollment'],
    ['eligible', 'Waiting for voucher and billing checks'],
    ['applied', 'Tuition benefit applied'],
    ['applied_no_balance', 'Qualified · no unpaid balance'],
    ['school_review', 'School Review'],
  ]) {
    const html = renderDetails({ ...base, benefitStatus, successfulCount: 1, referrals: [{ id: 1, referredDisplay: 'Sample S.', status: 'cancelled' }] });
    assert.match(html, new RegExp(label));
    assert.match(html, /Cancelled/);
  }
});

test('creation and copy feedback preserve pending, failure and success states', () => {
  const creating = renderDetails({ ...base, code: null }, { creating: true });
  assert.match(creating, /disabled=""/);
  assert.match(creating, /Creating code…/);
  const failed = renderDetails({ ...base, code: null }, { createError: 'Please try again.' });
  assert.match(failed, /role="alert"[^>]*>Please try again/);
  assert.match(failed, /aria-describedby=/);
  const active = { ...base, code: { code: 'COPY-ME', isActive: true } };
  assert.match(renderDetails(active, { copyState: 'copied' }), /Code copied. Ready to share/);
  assert.match(renderDetails(active, { copyState: 'error' }), /Select the code above and copy it manually/);
});

test('drawer actions and the scroll area retain accessible labels and focus targets', () => {
  for (const summary of [{ ...base, code: null }, { ...base, code: { code: 'ACTIVE', isActive: true } }]) {
    const html = renderDetails(summary);
    const close = html.match(/<button[^>]*aria-label="Close referral details"[^>]*>/)?.[0];
    assert.match(close, /size-11/);
    const action = html.match(/<button[^>]*>(?:<svg[\s\S]*?<\/svg>)?(?:Create referral code|Copy code)<\/button>/)?.[0];
    assert.match(action, /min-h-11/);
    assert.match(html, /role="region"[^>]*aria-label="Referral overview"[^>]*tabindex="0"/);
    assert.match(html, /aria-expanded="false"[^>]*data-slot="accordion-trigger"/);
    assert.doesNotMatch(html, /text-xs/);
  }
});


test("referral participation explains the reservation before creating a code", () => {
  const html = renderDetails({ ...base, enrollmentCutoff: "2026-11-30" });
  assert.match(html, /Create your code before making any Grade 12 payment/);
  assert.match(html, /pauses collection/);
  assert.match(html, /Enrollment cutoff/);
  assert.match(html, /11:59 PM Philippine time/);
});

test("an expired reservation explains payment release without offering a new code", () => {
  const html = renderDetails({ ...base, campaignEnabled: false, enrollmentCutoffPassed: true,
    enrollmentCutoff: "2026-11-30", benefitStatus: "expired", code: { id: 1, code: "SAVEDCODE", isActive: true } });
  assert.match(html, /Your Grade 12 bill is now payable without the referral benefit/);
  assert.doesNotMatch(html, /Copy code|Create referral code/);
});
