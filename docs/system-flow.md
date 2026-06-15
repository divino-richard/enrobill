# Enrobill — Enrollment & Tuition Management System

A generalized flow of the system: the actors, the modules, the end-to-end
process, and the state each record moves through. This is intentionally
technology-agnostic — it describes *what* happens, not *how* it's coded.

---

## 1. Actors (roles)

All users sign in through **one shared login**; their role decides which area
they land in (staff workspace vs. the student/applicant portal).

| Actor | Group | Description | Primary concerns |
|-------|-------|-------------|------------------|
| **Administrator / Registrar** | Staff | Configures the system and reviews enrollment. | Academic setup, fee structures, enrollment review/approval. |
| **Cashier / Accounting** | Staff | Handles money. | Assessments, posting payments, receipts, adjustments. |
| **Applicant** (aspiring student) | Portal | Self-registers to apply for admission/enrollment. | Submitting an application, tracking its status. |
| **Student** | Portal | An enrolled student. | Re-enrolling each year, viewing bills, paying, receipts. |

> An **applicant becomes a student** once their enrollment is approved. Before
> that they are an aspiring student with an application in progress.
>
> The system enforces **one active enrollment per person per school year**, so
> an applicant or student can't double-submit.

---

## 2. Modules

1. **Academic & Fee Setup** — prerequisites configured by Admin.
2. **Account & Login** — one shared login; applicants self-register.
3. **Enrollment / Admission** — apply (applicant) or re-enroll (student) → review → approval.
4. **Tuition Assessment / Billing** — turn an enrollment into a bill.
5. **Payment & Receipts** — collect money, update balances.
6. **Student / Applicant Portal** — self-service view across the above.
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
   │ PHASE 1 · ACCOUNT & LOGIN (shared)                                  │
   │  Applicant self-registers · everyone signs in at one login          │
   │  → role routes them to staff workspace or the portal                │
   └─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │ PHASE 2 · ENROLLMENT / ADMISSION                                    │
   │  Applicant applies / Student re-enrolls  ──►  Registrar reviews     │
   │      (year, level, docs)                       approve/reject/return │
   │  approval: applicant becomes a Student                              │
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
   │  Student pays (online) OR cashier posts (over-the-counter)          │
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

### Phase 1 — Account & Login (shared)
- **One login page** serves every user (admin, cashier, student, applicant).
  After authenticating, the user's **role** routes them to the staff workspace
  or the student/applicant portal.
- **Applicants self-register** (name, email, password) to start an application.
- Staff and student accounts are provisioned by the school / created on
  admission.

### Phase 2 — Enrollment / Admission
1. An **applicant** submits an admission application, or an existing **student**
   re-enrolls: choose school year → level/program → upload required documents.
   - **Guard:** the system blocks a second active application for the same
     **person × school year**, so no one can double-enroll.
2. Submit. The application enters the **review queue**.
3. Registrar **reviews**:
   - **Approve** → enrollment is created. An applicant **becomes a Student**.
   - **Reject** → with a reason.
   - **Return** → request missing info/documents; the applicant resubmits.

### Phase 3 — Tuition Assessment / Billing
1. On approval, the system **assesses fees**: it applies the level's fee
   structure and the chosen payment scheme.
2. It generates an **assessment / invoice** with a full line-item breakdown,
   total, and one or more **due dates**.
3. The bill appears in the **student's portal**.

### Phase 4 — Payment & Receipts
1. The student sees the **outstanding balance** and due schedule.
2. Pays one of two ways:
   - **Online** through the portal (payment gateway).
   - **Over-the-counter**, where the **cashier posts** the payment.
3. Payment is recorded → **balance recalculated** → **official receipt** issued
   (downloadable in the portal).
4. For installment/monthly schemes, the **schedule is tracked** and the next
   due amount/date is surfaced.

### Phase 5 — Monitoring, Reporting & Notifications
- **Student:** view their **ledger** (charges vs. payments), running balance,
  full **payment history**, and downloadable receipts.
- **Admin / Cashier:** **collection reports**, **outstanding balances**,
  enrollment counts and status breakdowns.
- **Notifications:** due-date reminders, payment confirmations, and enrollment
  status changes (email/in-app).

---

## 5. Record lifecycles (states)

**Applicant → Student**
```
Applicant (registered) ─► Application submitted ─► Approved ─► Student (enrolled)
                                              └─► Rejected ─► remains Applicant
```

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

| Capability | Applicant | Student | Cashier | Registrar / Admin |
|------------|:---------:|:-------:|:-------:|:-----------------:|
| Manage school year / levels / fees | — | — | — | ✅ |
| Submit application / re-enroll | ✅ (apply) | ✅ (re-enroll) | — | — |
| Approve / reject enrollment | — | — | — | ✅ |
| Generate assessment | — | — | ✅ | ✅ |
| Pay online | — | ✅ | — | — |
| Post over-the-counter payment | — | — | ✅ | ✅ |
| View own bills / receipts | own application | ✅ (own) | ✅ (all) | ✅ (all) |
| Reports | — | — | ✅ | ✅ |

> **Applicants** and **students** are scoped to their **own** data. Staff roles
> (cashier, registrar/admin) see across everyone.

---

## 7. Core data entities (high level)

`User` (role: `admin` / `cashier` / `student` / `applicant`) ·
`Student` profile (an applicant promoted on approval) · `SchoolYear` ·
`Level/Program` · `FeeStructure` (line items per Level) · `PaymentScheme` ·
`Enrollment` (Person × SchoolYear × Level — **unique active record per person ×
school year**) · `Assessment/Invoice` (from an Enrollment) · `InvoiceItem` ·
`Payment` · `Receipt`.

Every actor is a **single `User`** with a role; one shared login authenticates
all of them and the role decides their area. This maps cleanly onto the API
resources + role-based access the backend will expose, and the **staff workspace
+ student/applicant portal** screens the frontend renders.
