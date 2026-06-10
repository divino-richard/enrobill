# Enrobill — Enrollment & Tuition Management System with Guardian Access Portal

A generalized flow of the system: the actors, the modules, the end-to-end
process, and the state each record moves through. This is intentionally
technology-agnostic — it describes *what* happens, not *how* it's coded.

---

## 1. Actors (roles)

| Actor | Description | Primary concerns |
|-------|-------------|------------------|
| **Administrator / Registrar** | School staff who configure the system and approve enrollments. | Academic setup, fee structures, enrollment review. |
| **Cashier / Accounting** | Staff who handle money. | Assessments, posting payments, receipts, adjustments. |
| **Guardian (Parent)** | A portal user who acts on behalf of one or more students. | Enrolling students, viewing bills, paying, receipts. |
| **Student** | A portal user in their own right. Can **self-enroll online** and manage their own enrollment/bills. | Self-enrollment, viewing own bills, paying, receipts. |

> A single guardian can manage **multiple students** (siblings). A student may
> optionally be linked to a guardian.
>
> **Both** a guardian and the student can log in and initiate enrollment
> (see §4, Phase 2). To prevent collisions, the system enforces **one active
> enrollment per student per school year** regardless of who submitted it.

---

## 2. Modules

1. **Academic & Fee Setup** — prerequisites configured by Admin.
2. **Account Onboarding** — student or guardian account creation + linking.
3. **Enrollment** — online application (by student or guardian) → review → approval.
4. **Tuition Assessment / Billing** — turn an enrollment into a bill.
5. **Payment & Receipts** — collect money, update balances.
6. **Guardian Access Portal** — self-service view across all of the above.
7. **Reporting & Notifications** — oversight and reminders.

---

## 3. End-to-end flow

```
   ┌─────────────────────────────────────────────────────────────────────┐
   │ PHASE 0 · SETUP (Admin)                                              │
   │  School year/term → Levels/Programs → Fee structures → Pay schemes  │
   └─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │ PHASE 1 · ACCOUNT ONBOARDING (Student or Guardian)                  │
   │  Register account → Verify email → (guardian: add/link student[s])  │
   └─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │ PHASE 2 · ENROLLMENT                                                 │
   │  Student OR Guardian submits   ──►  Registrar reviews               │
   │      (student, year, level, docs)        approve / reject / return  │
   └─────────────────────────────────────────────────────────────────────┘
                                   │ (approved)
                                   ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │ PHASE 3 · TUITION ASSESSMENT / BILLING                              │
   │  Apply fee structure + chosen scheme → generate assessment/invoice  │
   │  with line-item breakdown and due date(s)                           │
   └─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │ PHASE 4 · PAYMENT & RECEIPTS                                         │
   │  Guardian pays (online) OR cashier posts (over-the-counter)         │
   │  → balance updated → official receipt issued                        │
   └─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │ PHASE 5 · MONITORING (ongoing)                                       │
   │  Portal: ledger, balance, history, receipts                         │
   │  Admin: collection & enrollment reports                             │
   │  Notifications: due reminders, payment confirmations, status        │
   └─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Phase detail

### Phase 0 — Academic & Fee Setup (Admin)
Prerequisite configuration that everything else depends on:
1. Create a **school year / term** (e.g. SY 2026–2027).
2. Define **grade levels / programs / sections**.
3. Define a **fee structure** per level — tuition, miscellaneous, and other
   fees as line items with amounts.
4. Define **payment schemes** — e.g. *full payment*, *installment*, *monthly*,
   each with its own due-date schedule and any discounts/surcharges.

### Phase 1 — Account Onboarding (Student or Guardian)
Either actor can create an account and proceed to enroll online:
- **Student:** registers (name, email, password) → verifies email → ready to
  self-enroll. May optionally link a guardian.
- **Guardian:** registers → verifies email → **adds/links student(s)** (a new
  student record, or links to an existing one the school provides).

### Phase 2 — Enrollment
Enrollment can be initiated **online by either the student (self-enrollment) or
a linked guardian** — both follow the same path and land in the same queue.

1. The initiator (student or guardian) starts an **enrollment application**:
   student → school year → level/program → upload required documents.
   - **Guard:** the system blocks a second active application for the same
     **student × school year** (whether the duplicate comes from the guardian,
     the student, or a resubmission), so the two actors can't double-enroll.
2. Submit. The application enters the **review queue**.
3. Registrar **reviews**:
   - **Approve** → student is enrolled; an enrollment record is created.
   - **Reject** → with a reason.
   - **Return** → request missing info/documents; the initiator resubmits.

### Phase 3 — Tuition Assessment / Billing
1. On approval, the system **assesses fees**: it applies the level's fee
   structure and the guardian's chosen payment scheme.
2. It generates an **assessment / invoice** with a full line-item breakdown,
   total, and one or more **due dates**.
3. The bill appears in the **Guardian Portal**.

### Phase 4 — Payment & Receipts
1. Guardian sees the **outstanding balance** and due schedule.
2. Pays one of two ways:
   - **Online** through the portal (payment gateway).
   - **Over-the-counter**, where the **cashier posts** the payment.
3. Payment is recorded → **balance recalculated** → **official receipt** issued
   (downloadable in the portal).
4. For installment/monthly schemes, the **schedule is tracked** and the next
   due amount/date is surfaced.

### Phase 5 — Monitoring, Reporting & Notifications
- **Guardian:** view the student **ledger** (charges vs. payments), running
  balance, full **payment history**, and downloadable receipts.
- **Admin / Cashier:** **collection reports**, **outstanding balances**,
  enrollment counts and status breakdowns.
- **Notifications:** due-date reminders, payment confirmations, and enrollment
  status changes (email/in-app).

---

## 5. Record lifecycles (states)

**Enrollment**
```
Draft ─► Submitted ─► Under Review ─► Approved (Enrolled)
                          │
                          ├─► Returned ─► (resubmit) ─► Under Review
                          └─► Rejected
```

**Invoice / Bill**
```
Generated ─► Partially Paid ─► Paid
     │                          
     └─────────► Overdue (when a due date passes with balance remaining)
```

**Payment**
```
Pending ─► Confirmed
   │
   ├─► Failed      (online gateway declined)
   └─► Refunded / Voided  (reversal after confirmation)
```

---

## 6. Access boundaries (who sees what)

| Capability | Student | Guardian | Cashier | Registrar / Admin |
|------------|:-------:|:--------:|:-------:|:-----------------:|
| Manage school year / levels / fees | — | — | — | ✅ |
| Submit enrollment application | ✅ (self) | ✅ (own students) | — | — |
| Approve / reject enrollment | — | — | — | ✅ |
| Generate assessment | — | — | ✅ | ✅ |
| Pay online | ✅ | ✅ | — | — |
| Post over-the-counter payment | — | — | ✅ | ✅ |
| View bills / receipts | ✅ (own only) | ✅ (own students) | ✅ (all) | ✅ (all) |
| Reports | — | — | ✅ | ✅ |

> A **student** is scoped to their **own** data; a **guardian** to **their
> linked students'** data. Staff roles (cashier, registrar/admin) see across
> all students.

---

## 7. Core data entities (high level)

`Student` (own login; optionally linked to a Guardian) · `Guardian` (own login)
· `SchoolYear` · `Level/Program` · `FeeStructure` (line items per Level) ·
`PaymentScheme` · `Enrollment` (Student × SchoolYear × Level — **unique active
record per Student × SchoolYear**) · `Assessment/Invoice` (from an Enrollment) ·
`InvoiceItem` · `Payment` · `Receipt`.

Both **Student** and **Guardian** are authenticatable accounts (each with a
role), so they can submit enrollment online; staff roles add review, assessment,
and reporting. This maps cleanly onto the API resources + role-based access the
backend will expose, and the **Student Portal + Guardian Portal + Admin
dashboard** screens the frontend will render.
