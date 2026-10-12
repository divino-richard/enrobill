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

## Bill presentation and reconciliation

Dropping statements and receipts show only the fees stored in the approved
assessment, with the original billed amount, applied percentage and resulting
charge. The selected period, student category, effective date and saved policy
version explain the basis. The current fee catalog is never used to reconstruct
an approved charge. Historical category formulas use their frozen breakdown.
Missing or inconsistent itemization shows a clear historical-data fallback;
it does not pretend the original enrollment fees were dropping charges.

Line amounts reconcile to the single rounded approved total. If percentages
produce fractional cents, residual cents are assigned by largest remainder.
Statements then show verified payments and applied student credits separately
from the remaining balance. Pending payments never reduce that balance.

Original enrollment items, vouchers and schedules remain under financial history;
they do not appear as additional dropping charges. Receipt history follows the
current assessment and payment reconciliation. Bills lists show assessed totals,
verified payments, applicable credits and remaining balances on desktop and mobile.
The same payment status is used on lists and details.

Return guidance prioritizes eligibility issues, unpaid previous balances and
payment verification before cashier billing. Existing pending returns with an
unpaid dropping balance must not be presented as ready for billing. No record is
deleted or financially recalculated by these presentation changes.

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

A returning student must settle the previous dropping balance **before a pending
enrollment can be created**. Unverified or partial payments and payment
arrangements do not satisfy this prerequisite. The original bill remains deferred
while the student is dropped; choosing to return requires settling it first.
Payment verification by itself never creates an enrollment.

After settlement, **Enroll again** creates only a pending enrollment. The cashier
then generates its new school-year bill through the normal billing action, applies
eligible benefits and credits, and records or verifies the required payment.
The normal enrollment payment requirement (including a voucher waiver) controls
activation, with the two-year return deadline still enforced.

Pending returns created by an earlier release keep their existing records and
bills. Their previous dropping bills use `required_for_reenrollment`: **Required for re-enrollment**. They still cannot activate with unpaid prior
balances, and cannot generate a missing new-year bill until settlement. No
existing bill, payment, credit or active enrollment is deleted by this change.

**My Bills → Bills by school year** identifies each bill as **Enrollment charges**
or **Dropping charges**; previous dropping charges remain on their original bill,
separate from new school-year fees. Payment status reflects the bill's backend
`unpaid`, `partial`, or `paid` status. Collection timing explains when payment is
required and does not replace that status: a deferred bill can still be unpaid,
partially paid, or paid.

**Enroll again** retains the student account and number and creates a pending
later-year enrollment with program, grade and voucher eligibility chosen afresh.
`ReturningEnrollmentRules::startEligibility` supplies the settlement prerequisite;
`ReturningEnrollmentRules` supplies date eligibility to the summary, creation checks,
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
leaving the normal program tabs available. The dialog shows the current status,
return deadline, balances and bill actions without repeating the previous program
or adding record-navigation links. Program and voucher guidance is expandable
when starting a return; eligibility issues and pending verification stay visible.
Dates omit timezone labels throughout the UI; Asia/Manila calculations are unchanged.
The dashboard notice, bill details,
and dropping approvals link there. The bills list and admission history omit the
return banner. The dashboard uses a highlighted notice with state-specific color,
a short explanation, return deadline, and one action. There is no separate sidebar item or page;
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

Starting a return checks full previous settlement and creates a pending enrollment
under the student lock. It does not create a bill. Cashier billing follows the
same path as an accepted new applicant. Retries return that same enrollment, including after admissions close or
the deadline expires, without creating another bill or extending eligibility.
Students pay the old and new bills separately. The portal refreshes pending
requirements after payment submission, on window focus, and periodically while
the return is pending. Existing verified-payment activation checks remain the
only route to becoming enrolled. No new account, application, or clearance is
needed. The normal student dashboard resumes once enrollment becomes active.

### Starting a dropping request

Active students start from **My Program → Overview → Enrollment options → Request
to drop**. The same menu offers **Download dropping form** for preparation.
The submission form spans the tab width and focuses on the reason, prepared
documents, and confirmation, without a download action or repeated instructions. Opening,
leaving, or cancelling this form does not create a draft or change enrollment.
The table is for tracking requests, not starting them.

Submitting a reason and valid documents creates the request, first document packet,
and notification together with status **Waiting for approval**. Enrollment stays
active until approval. Failed uploads roll back the request and remove any files
already stored. The endpoint requires a complete submission; enrollment-only
requests no longer create drafts. The student/enrollment lock and unique active
request constraint prevent duplicates; retries return the existing open request.

If an open request already exists, the Overview action opens that request instead.
Existing legacy drafts and requests returned for correction can still be completed
using the existing document-submission flow; no historical records are removed.

### Approved request presentation

Students access the request list from **My Program → Dropping requests**. Individual
requests open on a standalone `/portal/dropping-requests/:id` page, with a back link
to that list and My Program selected in the sidebar. The standalone sidebar entry
is removed. `/portal/dropping-requests` redirects to the list tab, while older
`/portal/programs?section=dropping&request=:id` links redirect to the detail page. Staff navigation is
unchanged. Re-enrollment stays in the Overview summary and the approved request's
next-step guidance rather than repeating a banner above the request list.

The student page focuses on the approval status, effective dropping date, charges,
and the next step. School remarks remain visible when present. The student approval
download and separate approval card are omitted; approver details remain in the
collapsed request history. Submitted reasons and documents are available in a
collapsed **Submitted request** section. Staff approval controls are unchanged.

Charges and return guidance share one section with one next-step action. The shared
bill statement shows frozen approved fee lines and reconciles current verified
payments, applied credit, and remaining balance. Policy versions and original
assessment history are available on the bill instead of repeated on the request.
Legacy approvals without an itemized snapshot explain the missing record instead
of inferring fees from today's policy.

On desktop, the fee breakdown sits beside a summary panel that groups the balance
with the next action. These panels stack in the same reading order on smaller
screens. Submitted request and request history use matching expandable rows below.

Settlement links directly to the unpaid bill, pending payment verification links
to payment status, and eligibility issues take precedence over payment prompts.
Closed admissions keep payments voluntary. Settled returns show the next enrollment
step; completed returns and older dropping records do not repeat an obsolete
deadline. Return details remain in My Program. Document preview/download errors
stay with their triggering action.

Student bills show the remaining balance and payment action before the approved
fee breakdown. Original assessments and past payment schedules remain in History;
the repeated no-active-schedule note is omitted. The bills list begins directly
with its column headers. My Program and bill details share white underline tabs,
which scroll horizontally on small screens.
