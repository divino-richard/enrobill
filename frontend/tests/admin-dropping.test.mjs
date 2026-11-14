import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { StudentEnrollmentsCard } = await server.ssrLoadModule('/src/features/students/components/student-enrollments-card.tsx');
const { DroppingSubmissionForm } = await server.ssrLoadModule('/src/features/dropping/dropping-submission-form.tsx');
const { AdminDroppingForm } = await server.ssrLoadModule('/src/features/dropping/admin-dropping-action.tsx');
const { AssessmentCalculationDetails } = await server.ssrLoadModule('/src/features/dropping-finance/assessment-summary.tsx');
const { philippinesToday } = await server.ssrLoadModule('/src/features/dropping-finance/api.ts');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const record = { id: 1, program: 'gas', yearLevel: 'grade_11', schoolYear: '2026-2027', status: 'enrolled', isCurrent: true, openDroppingRequestId: null };

function renderCard(enrollments, role = 'admin') {
  const user = { id: 20, role };
  useAuthStore.setState({ user });
  Object.assign(useAuthStore.getInitialState(), { user });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['programs'], []);
  client.setQueryData(['admin', 'students', 'enrollments', 1], enrollments);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null,
    createElement(StudentEnrollmentsCard, { studentId: 1, studentName: 'Test Student' }))));
  client.clear();
  return html;
}

test('admin starts the official dropping workflow only for an active enrolled year', () => {
  const html = renderCard([record, { ...record, id: 2, isCurrent: false }]);
  assert.equal((html.match(/Drop student/g) ?? []).length, 1);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /Mark as withdrawn|Reset to pending|Enroll again/);
});

test('pending and historical enrollment states cannot start a drop', () => {
  for (const status of ['pending', 'dropped', 'withdrawn', 'completed']) {
    assert.doesNotMatch(renderCard([{ ...record, status }]), /Drop student/);
  }
  assert.doesNotMatch(renderCard([{ ...record, isCurrent: false }]), /Drop student/);
});

test('an existing request opens directly instead of offering a duplicate', () => {
  const html = renderCard([{ ...record, openDroppingRequestId: 42 }]);
  assert.match(html, /href="\/admin\/dropping-requests\/42"/);
  assert.match(html, /View dropping request/);
  assert.doesNotMatch(html, /Drop student/);
});

test('cashiers and other roles have no admin dropping controls', () => {
  for (const role of ['cashier', 'teacher', 'student', 'applicant']) {
    assert.doesNotMatch(renderCard([record, { ...record, id: 2, openDroppingRequestId: 42 }], role), /Drop student|View dropping request/);
  }
});

function renderAdminForm(assessment) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['programs'], []);
  client.setQueryData(['admin-dropping-assessment', 1, 1, philippinesToday()], { assessment, billId: 10 });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null,
    createElement(AdminDroppingForm, { studentId: 1, studentName: 'Test Student', enrollment: record, onCancel: () => {}, onBusyChange: () => {} }))));
  client.clear();
  return html;
}
const assessment = { ready: true, issues: [], fingerprint: 'current', policyVersion: 1, period: 'quarter_2', category: 'paying', effectiveDate: philippinesToday(), originalTotal: 1000, finalCharge: 500, verifiedPayments: 100, balance: 400, credit: 0, feeBreakdown: {} };

test('admin form uses today as a fixed effective date and opens calculation details in a dialog', () => {
  const html = renderAdminForm(assessment);
  assert.match(html, /Reason for dropping/);
  assert.match(html, /Effective date/);
  assert.ok(html.includes(`<time dateTime="${philippinesToday()}">`));
  assert.doesNotMatch(html, /admin-drop-date|Determines the dropping charge|Choose an effective date|Automatic/);
  assert.match(html, /<button[^>]*type="button"[^>]*aria-haspopup="dialog"[^>]*>Calculation details/);
  assert.equal((html.match(/>Calculation details/g) ?? []).length, 1);
  assert.ok(html.indexOf('>Charges</h3>') < html.indexOf('>Calculation details'));
  assert.ok(html.indexOf('>Calculation details') < html.indexOf('Effective date'));
  assert.doesNotMatch(html, /<summary[^>]*>.*Calculation details/);
  assert.match(html, /<textarea[^>]*required=""/);
  assert.match(html, /Balance after dropping/);
  assert.match(html, /400\.00/);
  // A ready calculation alone cannot advance an empty reason to confirmation.
  assert.match(html, /type="submit" disabled="">Drop now/);
  assert.doesNotMatch(html, /type="file"|Signed form and attachments|complete, signed documents|>Submit request</);
});

test('admin form explains financial blockers and offers recovery before confirmation', () => {
  const html = renderAdminForm({ ...assessment, ready: false, fingerprint: null, issues: ['Pending payments'], blockingIssues: [{ category: 'payments', messages: ['Pending payments'] }] });
  assert.match(html, /Review pending payments/);
  assert.match(html, /href="\/admin\/billing\/10"/);
  assert.match(html, /type="submit" disabled="">Drop now/);
  assert.doesNotMatch(html, /Automatic/);
});

test('calculation details show fee charges and deductions directly without explanatory copy', () => {
  const html = renderToStaticMarkup(createElement(AssessmentCalculationDetails, {
    estimated: true,
    assessment: { ...assessment, originalTotal: 18421.25, finalCharge: 2100, verifiedPayments: 1690.93, balance: 409.07,
      feeCharges: [{ billItemId: 1, name: 'Laboratory', originalAmount: 1600, percent: 100 }, { billItemId: 2, name: 'Registration', originalAmount: 1000, percent: 50 }] },
  }));
  assert.match(html, /aria-label="Fee breakdown"/);
  for (const value of ['Laboratory', 'Registration', '50% of ₱1,000.00', '₱500.00', '₱18,421.25', '₱2,100.00', '-₱1,690.93', '₱409.07']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /<details|<summary|No voucher|Automatic|Estimate as of|determines the final charge/);
});

test('calculation details retain current payments and credits separately from the estimate', () => {
  const html = renderToStaticMarkup(createElement(AssessmentCalculationDetails, {
    assessment,
    current: { verifiedPayments: 600, creditApplied: 100, balance: 0, creditIssued: 200, availableCredit: 20 },
  }));
  for (const value of ['-₱600.00', 'Applied credit', '-₱100.00', '₱0.00', 'Student credit', '₱200.00', 'Available credit', '₱20.00']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /₱400\.00|Fee breakdown/);
});

test('shared form retains student submission wording and blocks dismissal while uploading', () => {
  const html = renderToStaticMarkup(createElement(DroppingSubmissionForm, { busy: true, onSubmit: () => {}, onCancel: () => {} }));
  assert.match(html, /I reviewed my complete, signed documents/);
  assert.match(html, /Your enrollment stays active until approval/);
  assert.match(html, /disabled="">Cancel/);
  assert.match(html, /disabled="">Uploading documents/);
  assert.doesNotMatch(html, /Continue to review/);
});

function submissionErrorAlert(error, request) {
  const html = renderToStaticMarkup(createElement(DroppingSubmissionForm, {
    busy: false, onSubmit: () => {}, error, request,
  }));
  const alerts = [...html.matchAll(/<p\b[^>]*role="alert"[^>]*>(.*?)<\/p>/gs)];
  assert.equal(alerts.length, 1, 'Submission failures should appear in one accessible alert.');
  return alerts[0][1];
}

function submissionFailure(data, status = 422) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data },
  };
}

for (const [mode, request] of [
  ['new request', undefined],
  ['correction', { status: 'needs_correction', reason: 'Family circumstances' }],
]) {
  test(`${mode} keeps a useful server validation message`, () => {
    const message = 'The documents must be 7 MB or less in total.';
    assert.equal(submissionErrorAlert(submissionFailure({ message }), request), message);
  });

  test(`${mode} explains field validation when the response has no summary`, () => {
    const alert = submissionErrorAlert(submissionFailure({ errors: {
      reason: ['Please explain your reason for dropping.'],
      'files.0': ['The files.0 field is required.'],
    } }), request);
    assert.match(alert, /Please explain your reason for dropping/);
    assert.match(alert, /document|attachment|file 1/i);
    assert.match(alert, /required/i);
    assert.doesNotMatch(alert, /files\.0|Request failed with status code/);
  });

  test(`${mode} gives recovery instructions for failed document uploads`, () => {
    const alert = submissionErrorAlert(submissionFailure({
      message: 'The files.0 failed to upload.',
      errors: { 'files.0': ['The files.0 failed to upload.'] },
    }), request);
    assert.match(alert, /upload/i);
    assert.match(alert, /try again|retry/i);
    assert.match(alert, /contact.*school/i);
    assert.doesNotMatch(alert, /files\.0|Request failed with status code/);
  });

  test(`${mode} labels document metadata errors in readable language`, () => {
    const alert = submissionErrorAlert(submissionFailure({ errors: {
      'files.0.size': ['The files.0.size field must be at least 1.'],
      'files.0.mime': ['The selected files.0.mime is invalid.'],
      'files.0.name': ['The files.0.name field is required.'],
    } }), request);
    assert.match(alert, /Document 1 size must be at least 1/);
    assert.match(alert, /Document 1 type is invalid/);
    assert.match(alert, /Document 1 name is required/);
    assert.doesNotMatch(alert, /files\.0|\.size|\.mime|\.name/);
  });

  test(`${mode} provides clear guidance for unreadable or malformed validation responses`, () => {
    const responses = [
      undefined,
      null,
      '',
      {},
      42,
      { message: '   ' },
      { message: 'The given data was invalid.' },
      { message: 'Request failed with status code 422' },
      { message: 'PHP Warning: unable to create a temporary file in /server/private/path.php on line 0' },
      { message: { error: 'Validation failed' } },
      { errors: { 'files.0': [null, 42, {}] } },
      '<html><body>Upload error</body></html>',
      'PHP Warning: unable to create a temporary file in /server/private/path.php on line 0',
      '<br />PHP Warning: unable to create a temporary file<br />{"message":"The files.0 failed to upload."}',
    ];
    for (const data of responses) {
      const alert = submissionErrorAlert(submissionFailure(data), request);
      assert.match(alert, /reason/i);
      assert.match(alert, /documents|attachments/i);
      assert.match(alert, /try again|retry/i);
      assert.match(alert, /contact.*school/i);
      assert.doesNotMatch(alert, /Request failed with status code|PHP Warning|temporary file|private\/path|&lt;html|files\.0/);
    }
  });

  test(`${mode} explains when a connection failure leaves submission unconfirmed`, () => {
    const alert = submissionErrorAlert({ isAxiosError: true, message: 'Network Error', code: 'ERR_NETWORK' }, request);
    assert.match(alert, /confirm/i);
    assert.match(alert, /request/i);
    assert.match(alert, /connection|internet/i);
    assert.doesNotMatch(alert, /Network Error|Request failed with status code/);
  });

  test(`${mode} explains file limits when the server rejects the upload size`, () => {
    const alert = submissionErrorAlert(submissionFailure('<html>Payload Too Large</html>', 413), request);
    assert.match(alert, /2 MB/i);
    assert.match(alert, /7 MB/i);
    assert.match(alert, /document|file|attachment/i);
    assert.doesNotMatch(alert, /Request failed with status code|&lt;html/);
  });

  test(`${mode} gives recovery steps when the server fails during submission`, () => {
    const alert = submissionErrorAlert(submissionFailure({ message: 'SQLSTATE connection failed at /server/private/path.php' }, 500), request);
    assert.match(alert, /check.*dropping requests/i);
    assert.match(alert, /trying again|retry/i);
    assert.match(alert, /contact.*school/i);
    assert.doesNotMatch(alert, /SQLSTATE|private\/path|Request failed with status code/);
  });
}
