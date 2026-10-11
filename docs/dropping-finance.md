# Dropping charges and returning students

This release implements the approved senior high school policy for new official
dropping approvals. College and returning within the same school year are outside
this release. Previously approved requests remain historical and are not
reassessed automatically.

## Setup before the first approval

1. Apply the additive `2026_09_30_000000_add_dropping_finance` migration.
2. Apply the additive `2026_10_06_000000_add_dropping_fee_rules` migration.
   Academic Years → Dropping charges displays all five periods. Use Set dates or
   Edit dates on the period header to manage its single shared date range.
   All five ranges must be consecutive and cover the school year. Enrollment
   dates may begin before classes start. Saving creates a new policy version.
3. Select actual school-year fee items and whole percentages (1–100) for each
   period using the searchable fee select. Each category has its own Add policy or
   Edit action. Its modal edits fees only; the category is fixed by the action.
   Dates and category fees save independently, preserving the latest values for
   the other settings. Fees may be configured before dates, but the policy remains
   unavailable until the complete calendar and fees are set. Every category/period needs
   at least one selected fee. Fee selections for another grade are excluded.
   Older policies keep their category-based rules for each untouched category/period
   until explicitly replaced. Saving one period preserves every other period.
4. Review the voucher recorded on each affected enrollment's bill. The dropping
   category is applied automatically: a voucher on that bill uses Voucher / ESC;
   no voucher uses Paying. Other incentives do not qualify as vouchers. A voucher
   already applied still counts if it is later retired from the catalog. Adding
   or removing a voucher before approval updates the category and charge preview.
5. The policy becomes available automatically once all five ranges are consecutive
   and both categories are configured. Gaps may be saved while adjusting adjoining
   periods, but charges stay unavailable until those gaps are resolved. Unresolved
   bills, fee mappings, dates, or pending payments still block approval.

No dates or fee classifications are guessed for existing records. Test/sample
dates belong in automated tests, not live school policies. The previous manual
category is no longer used for new assessments; existing approved assessments
retain their saved category and charges. No category backfill is required.

## Charge calculation

The effective dropping date selects the period. Calculations use original bill
items and integer cents. Half amounts round to the nearest cent, half up.

Fee-based policies snapshot selected fee identities, names, grade applicability,
and percentages. New bills retain the source fee ID even if the catalog item is
later deleted. Older bill lines can match an exact, unique saved name/category;
missing or ambiguous matches block approval. Use the bill's **Classify fees**
dialog to explicitly link those lines to the school-year fee schedule. A fee
can be linked to only one bill line. Amounts always come from the original bill,
not the current catalog. Review shows the selected fees and original amounts.
Percentages are summed in integer hundredths of cents and rounded once.

The following category-based rules remain available to historical policies:

| Period | Paying | Voucher / ESC |
| --- | --- | --- |
| Enrollment | Registration | Registration |
| First quarter | Miscellaneous + Laboratory | 50% Miscellaneous |
| Second quarter | Miscellaneous + Laboratory + 50% Tuition | Miscellaneous |
| Third quarter | All original fees | Miscellaneous + Laboratory |
| Final quarter | All original fees | 50% all original fees |

The result is the final student charge. Historical vouchers and incentives stay
visible but are not deducted a second time. The approval saves the policy version,
original fee items, benefits, schedule, payments, and final calculation. Later
catalog changes cannot change the approved assessment.

## Payments, credits, and returns

Verified payments stay on their original bills. Excess cash payments at approval
issue student credit; credit allocations are separate from cash receipts and
discounts. Credit can cover an eligible later-school-year bill after its own fees
and benefits are assessed. Unused credit stays available; allocations released by
later benefits return to the available balance. There are no automatic refunds or
credit expiry.

### Collection timing (existing and new approvals)

The original bill keeps its approved charge and verified payment/credit history.
An approved drop uses `collectionState: deferred_until_reenrollment`: **Payable
upon re-enrollment**. `amountDue` is zero and the active `installments` array is
empty, even for previously approved drops. There is no immediate payment,
clearance, settlement deadline, or late fee. Voluntary partial and full payments
are accepted; unverified payments never reduce the balance.

A valid pending later-year return changes previous dropping bills to
`required_for_reenrollment`: **Settle before completing re-enrollment**. Their
remaining balance is required for activation, without installment deadlines.
Partial payments are still accepted. The new year’s bill uses normal billing
(`standard`). Both its normal enrollment payment requirement and all previous
balances must be satisfied with verified payments and existing applicable credits
before activation. Arrangements cannot bypass either requirement.

**Enroll again** retains the student account and number and creates a pending
later-year enrollment with program, grade and voucher eligibility chosen afresh.
`ReturningEnrollmentRules` supplies eligibility to the summary, creation checks,
model guards (including alternative creation/activation paths), and bill collection
state. Returning enrollment/bill responses include `returnRequirements` with the
effective dropping date, deadline, eligibility, blocking reasons and separate
previous/new-year payment requirements.

### Two-year return window

Activation must occur on or before the second anniversary of the confirmed
effective dropping date, using Asia/Manila calendar days. October 7, 2026 permits
activation through October 7, 2028. February 29, 2024 permits activation through
February 28, 2026. The actual activation/verification date is checked, not the
payment date or application date. Starting before expiry does not extend the
window. Missing confirmed effective dates block return with a data-correction
message; approval dates are never silently substituted.

Expired pending returns cannot activate, even after payment is verified. Their
old dropping bills revert to deferred collection; payments and balances remain.
An already-active enrollment is never revoked, and completing a return ends that
old window’s relevance to normal enrollment in subsequent years.

### Historical schedules and rollout

Original installment rows and approval snapshots are retained without generating
or redistributing dropping installments. `historicalInstallments` exposes the
retained rows separately. Existing arrangements remain readable history only;
creation/editing is disabled for dropping bills. Old installment/arrangement
reminders become non-actionable with `historical: true`; their original stored
content remains unchanged. Future installment reminders skip these bills.

This behavior is derived from approved dropping/enrollment records. No financial
backfill or recalculation of approved charges is required. Existing unpaid drops
and pending returns adopt it immediately; already-active enrollments, balances,
verified payments, and credits are preserved. Where a previous release already
redistributed installment rows, the original approval snapshot remains the
source of the pre-approval schedule. No history is rewritten by this rollout.

## Concurrency and verification

Financial transitions serialize on the student, then enrollment and bill rows.
Approval also checks the document version and calculation fingerprint, and saves
the assessment and Dropped status in one transaction. A duplicate approved
request returns its existing result without issuing another credit.

Automated coverage lives in `backend/tests/Feature/*Dropping*Test.php`,
`DroppingFinanceTest.php`, and the returning enrollment tests. Run the backend
suite (`cd backend && composer test`), frontend build/lint and the existing
incentive/referral UI tests, plus desktop/mobile browser checks before release.

Opt-in integration tests exercise simultaneous approvals, approval versus
payment, simultaneous credit allocations, duplicate returning requests, and
concurrent payment verification on MySQL:

```sh
cd backend
FINANCE_MYSQL_CONCURRENCY=1 php artisan test tests/Concurrency
```

Use local MySQL credentials with permission to create/drop a test schema. The
suite creates a random `enrobill_finance_test_*` database, migrates it, and removes
only that database afterward; it never resets the application database. Default
unit/feature tests use in-memory SQLite.

Previously dropped enrollments retain their status and section assignment.
Deleting a section containing a dropped enrollment or reassigning that historical
enrollment is blocked. Later bill displays use that bill's enrollment program and
grade, even after the student's current program changes.

## Student self-service after dropping

Re-enrollment lives in a compact section alongside the program summary and enrollment
details in **My Program → Overview**.
Its details and start action open in a dialog (`/portal/programs?reenroll=1`),
leaving the normal program tabs available. Dashboard, bills, admission history,
and dropping approvals link there. There is no separate sidebar item or page;
legacy `/portal/re-enrollment` links redirect to the My Program dialog. Closed admissions, incomplete fee
setup, invalid or missing historical dates, expired windows, pending returns,
and successful activation each have an explicit state. Dropped students see
records and return options instead of current classes, referral promotions, or
clearance submission demands. Prior schedules are marked historical; saved
academic documents remain readable across school years.
After activation, saved documents remain accessible in **My Program → History**
(`?section=history`), alongside past enrollments. A staff-created return displays
its approved program and grade, even when they differ from the dropped record.

`GET /api/me/re-enrollment` returns only the signed-in student's eligibility,
available school year, previous bill balances, pending payment amounts, credit,
and activation blockers. `POST /api/me/re-enrollment` accepts only the school
year ID. It requires an active later year with admissions open, valid dates,
an active returning program, and fees for the student's existing grade. Students
retain their prior program and grade; staff must review academic changes and
new voucher eligibility. A previous voucher is never self-renewed.

Starting a return creates a pending enrollment and its bill under the student
lock. Retries return that same enrollment, including after admissions close or
the deadline expires, without creating another bill or extending eligibility.
Students pay the old and new bills separately. The portal refreshes pending
requirements after payment submission, on window focus, and periodically while
the return is pending. Existing verified-payment activation checks remain the
only route to becoming enrolled. No new account, application, or clearance is
needed. The normal student dashboard resumes once enrollment becomes active.
