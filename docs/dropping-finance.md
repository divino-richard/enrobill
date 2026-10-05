# Dropping charges and returning students

This release implements the approved senior high school policy for new official
dropping approvals. College and returning within the same school year are outside
this release. Previously approved requests remain historical and are not
reassessed automatically.

## Setup before the first approval

1. Apply the additive `2026_09_30_000000_add_dropping_finance` migration.
2. In Academic Years, configure the enrollment period and four quarter ranges.
   All five ranges must be consecutive and cover the school year. Enrollment
   dates may begin before classes start. Saving creates a new policy version.
3. Map fees to Registration, Miscellaneous, Laboratory, Tuition, or Other.
   Registration and Laboratory are separate from Miscellaneous. Existing bills
   need their own mappings; editing the fee catalog does not change old bills.
4. Confirm each affected enrollment as Paying or Voucher / ESC.
5. Enable the configured school-year policy. Unresolved bills, categories, dates,
   or pending payments block approval and appear in the calculation preview.

No dates, fee classifications, or funding categories are guessed for existing
records. Test/sample dates belong in automated tests, not live school policies.

## Charge calculation

The effective dropping date selects the period. Calculations use original bill
items and integer cents. Half amounts round to the nearest cent, half up.

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

Old debt remains on the old bill, which the student can still pay. Admin can create
a later pending enrollment under the same student account using **Enroll again**,
choosing program, year level, and voucher eligibility afresh. Activation requires
the new bill's normal payment requirement plus settlement of previous debt or a
current approved arrangement covering it. A later missed arrangement payment does
not automatically drop an enrollment that is already active.

Unpaid installment amounts are redistributed against the final balance while
retaining the existing due dates, including an unpaid downpayment. The original
schedule is saved in the assessment. A previously fully waived bill with no
schedule receives a single dropping charge due on the effective dropping date.

Admin and Cashier can record arrangements with amounts, due dates, and remarks.
The approving actor is recorded. An overdue unpaid arrangement cannot satisfy a
pending returning enrollment's previous-balance requirement. Bill schedules,
payment validation, the due-now queue, and reminders all use the replacement
arrangement dates and outstanding amounts.

## Concurrency and verification

Financial transitions serialize on the student, then enrollment and bill rows.
Approval also checks the document version and calculation fingerprint, and saves
the assessment and Dropped status in one transaction. A duplicate approved
request returns its existing result without issuing another credit.

Automated coverage lives in `backend/tests/Feature/*Dropping*Test.php`,
`DroppingFinanceTest.php`, and the returning enrollment tests. Run the backend
suite (`cd backend && composer test`), frontend build/lint and the existing
incentive/referral UI tests, plus desktop/mobile browser checks before release.

An opt-in integration test exercises simultaneous approvals, approval versus
payment, and simultaneous allocations on MySQL:

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
