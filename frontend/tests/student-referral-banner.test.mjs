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
const { StudentReferralCard } = await server.ssrLoadModule(
  "/src/features/referrals/components/student-referral-card.tsx",
);

function renderBanner(summary) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["me", "referrals", undefined], summary);
  const html = renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(StudentReferralCard)),
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
  assert.match(html, /Share your code/);
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
