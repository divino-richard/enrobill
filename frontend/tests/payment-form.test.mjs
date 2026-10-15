import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { paymentToday, paymentProofError, validatePaymentDraft, MAX_PAYMENT_PROOF_BYTES } = await server.ssrLoadModule('/src/features/bills/payment-form.ts');
const { PaymentChannelState, PaymentAccountDetails, PaymentMethodsGuide, PaymentMethodPicker } = await server.ssrLoadModule('/src/features/bills/components/payment-methods-dialog.tsx');
const { default: BillDetailPage } = await server.ssrLoadModule('/src/pages/portal/bill-detail-page.tsx');
const { myBillQueryKey, myBillsQueryKey } = await server.ssrLoadModule('/src/features/bills/hooks.ts');
const options = { minimum: 0.01, balance: 1930, channels: [{ code: 'gcash' }, { code: 'maya' }], today: '2026-10-13' };
const draft = { amount: '500.25', method: 'gcash', paidAt: '2026-10-13', reference: 'GC-001234', note: '', file: { type: 'image/png', size: 1024 } };

test('payment day uses Manila at the UTC date boundary', () => {
  assert.equal(paymentToday(new Date('2026-10-12T16:01:00Z')), '2026-10-13');
  assert.equal(paymentToday(new Date('2026-10-12T15:59:00Z')), '2026-10-12');
});
test('partial and full dropping payments are accepted with complete payment details', () => {
  for (const amount of ['0.01', '.50', '500.25', '1930.00']) assert.deepEqual(validatePaymentDraft({ ...draft, amount }, options), {});
});
test('submission revalidates all required fields if the balance or available methods change', () => {
  assert.deepEqual(validatePaymentDraft(draft, options), {});
  const errors = validatePaymentDraft({ ...draft, file: null, paidAt: '' }, { ...options, balance: 100, channels: [] });
  for (const field of ['amount', 'method', 'file', 'paidAt']) assert.ok(errors[field], field);
});
test('amount validation rejects malformed, nonfinite, excessive precision and over-balance values', () => {
  for (const amount of ['', '0', '-1', '1e3', 'Infinity', 'NaN', '1.001', '1930.01', '1,930']) {
    assert.ok(validatePaymentDraft({ ...draft, amount }, options).amount, amount);
  }
});
test('standard bills still enforce the existing minimum amount due', () => {
  assert.ok(validatePaymentDraft(draft, { ...options, minimum: 600 }).amount);
  assert.deepEqual(validatePaymentDraft({ ...draft, amount: '600' }, { ...options, minimum: 600 }), {});
});
test('a payment method must be explicitly chosen and still available', () => {
  for (const method of ['', 'removed-channel']) assert.match(validatePaymentDraft({ ...draft, method }, options).method, /Choose/);
  assert.ok(validatePaymentDraft(draft, { ...options, channels: [] }).method);
});
test('receipt constraints catch unsupported, empty and oversized files before upload', () => {
  assert.match(paymentProofError(null), /Choose a receipt/);
  assert.match(paymentProofError({ type: 'application/pdf', size: 100 }), /JPG or PNG/);
  assert.match(paymentProofError({ type: 'image/png', size: 0 }), /empty/);
  assert.match(paymentProofError({ type: 'image/jpeg', size: MAX_PAYMENT_PROOF_BYTES + 1 }), /5 MB/);
  assert.equal(paymentProofError({ type: 'image/jpeg', size: MAX_PAYMENT_PROOF_BYTES }), undefined);
});
test('missing, invalid and future payment dates are rejected', () => {
  for (const paidAt of ['', '2026-02-30', '2026-10-14', '10/13/2026', '2026-1-01']) assert.ok(validatePaymentDraft({ ...draft, paidAt }, options).paidAt, paidAt);
  assert.deepEqual(validatePaymentDraft({ ...draft, paidAt: '2024-02-29' }, options), {});
});
test('reference and note lengths match the server limits', () => {
  assert.deepEqual(validatePaymentDraft({ ...draft, reference: 'r'.repeat(100), note: 'n'.repeat(255) }, options), {});
  const errors = validatePaymentDraft({ ...draft, reference: 'r'.repeat(101), note: 'n'.repeat(256) }, options);
  assert.ok(errors.reference); assert.ok(errors.note);
});
test('receipt references are optional and leading zeroes are accepted when provided', () => {
  for (const reference of ['', ' ', '\t\n']) {
    assert.deepEqual(validatePaymentDraft({ ...draft, reference }, options), {});
  }
  assert.deepEqual(validatePaymentDraft({ ...draft, reference: '001234567890' }, options), {});
});
test('channel loading, failure, and genuine empty configuration have distinct recovery guidance', () => {
  const render = props => renderToStaticMarkup(createElement(PaymentChannelState, { loading: false, failed: false, empty: false, retrying: false, onRetry() {}, ...props }));
  const loading = render({ loading: true, empty: true });
  assert.match(loading, /Loading payment methods/); assert.doesNotMatch(loading, /cashier/);
  const failed = render({ failed: true, empty: true });
  assert.match(failed, /role="alert"/); assert.match(failed, />Retry</); assert.doesNotMatch(failed, /No online payment methods/);
  assert.match(render({ empty: true }), /Contact the cashier/);
  assert.equal(render({}), '');
});
test('account guidance retains recipient values, copy controls, and QR download without repeated instructions', () => {
  const html = renderToStaticMarkup(createElement(PaymentAccountDetails, { channel: { id: 1, code: 'gcash', label: 'GCash', accountName: 'School Finance Office', accountNumber: '09123456789', qrUrl: '/qr.png' }, disabled: false, onRetry() {} }));
  assert.match(html, /School Finance Office/); assert.match(html, /09123456789/);
  assert.match(html, /Copy account name/); assert.match(html, /Copy mobile number/);
  assert.match(html, /Save QR/); assert.doesNotMatch(html, /import it in your payment app|Check the recipient/);
  assert.doesNotMatch(html, /role="dialog"/);
});

test('the guide opens the requested accordion with payment names as expandable headings', () => {
  const channels = [
    { id: 1, code: 'gcash', label: 'GCash', accountName: 'GCash recipient', accountNumber: '09123456789', qrUrl: '/gcash-qr.png' },
    { id: 2, code: 'maya', label: 'Maya', accountName: 'Maya recipient', accountNumber: '09987654321', qrUrl: '/maya-qr.png' },
  ];
  const render = initialMethod => renderToStaticMarkup(createElement(PaymentMethodsGuide, { channels, initialMethod, onRetry() {} }));
  const maya = render('maya');
  assert.match(maya, /<h3[^>]*><button[^>]*aria-expanded="false"[^>]*>GCash/);
  assert.match(maya, /<h3[^>]*><button[^>]*aria-expanded="true"[^>]*>Maya/);
  assert.doesNotMatch(maya, /role="tablist"/);
  assert.match(maya, /Maya recipient/);
  assert.doesNotMatch(maya, /GCash recipient/);
  assert.doesNotMatch(maya, /<form|role="radio"|type="radio"|type="submit"|required=""/);
  const unavailable = render('removed-method');
  assert.match(unavailable, /GCash recipient/);
  assert.doesNotMatch(unavailable, /Maya recipient/);
});

test('the payment field opens a dialog, exposes the current choice and retains validation focus semantics', () => {
  const channels = [
    { id: 1, code: 'gcash', label: 'GCash', accountName: 'GCash recipient', accountNumber: '09123456789', qrUrl: '/gcash-qr.png' },
    { id: 2, code: 'maya', label: 'Maya', accountName: 'Maya recipient', accountNumber: '09987654321', qrUrl: '/maya-qr.png' },
  ];
  const render = (initialMethod, disabled = false) => renderToStaticMarkup(createElement(PaymentMethodPicker, { id: 'payment-method', channels, initialMethod, disabled, invalid: true, describedBy: 'payment-method-error', loading: false, failed: false, retrying: false, onRetry() {}, onChange() {} }));
  assert.match(render('maya'), /aria-label="Payment method \(required\), Maya"/);
  assert.match(render('gcash'), /aria-label="Payment method \(required\), GCash"/);
  assert.match(render('maya'), /type="button"/);
  assert.match(render('maya'), /aria-haspopup="dialog"/);
  assert.match(render('maya'), /id="payment-method"/);
  assert.match(render('maya'), /data-payment-field="method"/);
  assert.match(render('maya'), /aria-invalid="true"/);
  assert.match(render('maya'), /aria-describedby="payment-method-error"/);
  assert.doesNotMatch(render('maya'), /type="submit"|role="combobox"|<select/);
  assert.match(render('maya', true), /disabled=""/);
  assert.match(render(''), /choose a method/);
  assert.match(render('removed-method'), /choose a method/);
});

test('the picker has labeled header radios separate from accordion controls and no per-method Select buttons', () => {
  const channels = [
    { id: 1, code: 'gcash', label: 'GCash', accountName: 'GCash recipient', accountNumber: '09123456789', qrUrl: '/gcash-qr.png' },
    { id: 2, code: 'maya', label: 'Maya', accountName: 'Maya recipient', accountNumber: '09987654321', qrUrl: '/maya-qr.png' },
  ];
  let selections = 0;
  const render = (initialMethod, disabled = false) => renderToStaticMarkup(createElement(PaymentMethodsGuide, { channels, initialMethod, disabled, onRetry() {}, onSelect() { selections++; } }));
  const radios = html => html.match(/<button\b[^>]*role="radio"[^>]*>/g) ?? [];
  const initial = render('');
  assert.match(initial, /aria-expanded="true"[^>]*>GCash/);
  assert.match(initial, /role="radiogroup"/);
  assert.equal(radios(initial).length, 2);
  assert.ok(radios(initial).every(radio => radio.includes('aria-checked="false"')));
  assert.doesNotMatch(initial, /Select GCash|Select Maya|type="submit"/);
  assert.ok(initial.indexOf('role="radio"') < initial.indexOf('<h3'));
  for (const trigger of initial.match(/<button\b(?=[^>]*data-slot="accordion-trigger")[^>]*>[\s\S]*?<\/button>/g) ?? []) {
    assert.doesNotMatch(trigger, /role="radio"/);
  }
  const selected = render('maya');
  assert.match(selected, /aria-expanded="true"[^>]*>Maya/);
  assert.match(radios(selected).find(radio => radio.includes('aria-label="Maya"')), /aria-checked="true"/);
  assert.match(radios(selected).find(radio => radio.includes('aria-label="GCash"')), /aria-checked="false"/);
  assert.doesNotMatch(selected, /GCash recipient/);
  assert.ok(radios(render('maya', true)).every(radio => radio.includes('disabled=""')));
  assert.equal(selections, 0);
});

test('bank details retain the existing bank-name meaning instead of inventing a recipient name', () => {
  const html = renderToStaticMarkup(createElement(PaymentAccountDetails, { channel: { id: 3, code: 'bank', label: 'Bank transfer', accountName: 'School bank', accountNumber: '123456789', qrUrl: null }, disabled: false, onRetry() {} }));
  assert.match(html, /Bank name/); assert.match(html, /Account number/); assert.doesNotMatch(html, /Save QR|Mobile number|Copy these details into|Check the recipient/);
});

test('the confirmation destination opens Payments while invalid tabs fall back to Summary', () => {
  const bill = { id: 1, schoolYear: '2026-2027', status: 'unpaid', total: 1930, netTotal: 1930, amountPaid: 0, balance: 1930, amountDue: 0, items: [], adjustments: [], installments: [], payments: [], createdAt: '2026-10-13' };
  const render = tab => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(myBillQueryKey, bill);
    client.setQueryData(myBillsQueryKey, [bill]);
    client.setQueryData(['payment-channels'], []);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [`/portal/bills/1?tab=${tab}`] }, createElement(Routes, null, createElement(Route, { path: '/portal/bills/:id', element: createElement(BillDetailPage) })))));
    client.clear();
    return html;
  };
  assert.match(render('payments'), /Payment history/);
  assert.doesNotMatch(render('payments'), />Bill summary</);
  assert.match(render('unknown'), />Bill summary</);
});
