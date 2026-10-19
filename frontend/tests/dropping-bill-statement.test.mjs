import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createServer } from 'vite';
const server = await createServer({server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
after(() => server.close());
const { approvedChargeLines } = await server.ssrLoadModule('/src/features/bills/dropping-statement.ts');
const { BillStatement } = await server.ssrLoadModule('/src/features/bills/components/bill-ledger.tsx');
const { DroppingBillHistory } = await server.ssrLoadModule('/src/features/bills/components/dropping-statement.tsx');
const { BillActionPanel } = await server.ssrLoadModule('/src/features/bills/components/bill-action-panel.tsx');
const { default: BillDetailPage } = await server.ssrLoadModule('/src/pages/portal/bill-detail-page.tsx');
const { buildBillReceiptHtml } = await server.ssrLoadModule('/src/features/bills/receipt.ts');
const { BillCollectionNotice } = await server.ssrLoadModule('/src/features/dropping-finance/collection-notice.tsx');
const { StudentDroppingSummary } = await server.ssrLoadModule('/src/features/bills/components/student-dropping-summary.tsx');
const bill = {
  id:1,schoolYear:'2026-2027',status:'partial',collectionState:'deferred_until_reenrollment',
  total:18421.25,netTotal:2100,amountPaid:170,balance:1930,amountDue:0,creditApplied:0,
  items:[{id:1,name:'Tuition Fee',amount:12561.25,category:'tuition'},{id:2,name:'Registration',amount:500,category:'miscellaneous'},{id:3,name:'Laboratory Fee',amount:1600,category:'laboratory'}],
  adjustments:[], payments:[{id:1,amount:170,status:'verified',method:'gcash',paidAt:'2026-10-05'},{id:2,amount:500,status:'pending',method:'gcash'}],
  droppingAssessment:{period:'quarter_1',category:'paying',effectiveDate:'2026-10-07',policyVersion:26,finalCharge:2100,originalTotal:18421.25,feeBreakdown:{},feeCharges:[{feeId:3,billItemId:3,name:'Laboratory Fee',percent:100,originalAmount:1600},{feeId:2,billItemId:2,name:'Registration',percent:100,originalAmount:500}]},
};
const markup = (Component, input=bill) => renderToStaticMarkup(createElement(MemoryRouter,null,createElement(Component,{bill:input})));

test('approved statement shows the two charged fees and current reconciliation, excluding original tuition', () => {
  const html=markup(BillStatement);
  assert.match(html,/Laboratory Fee/); assert.match(html,/Registration/);
  assert.match(html,/First quarter · Paying/); assert.match(html,/100% of/);
  assert.match(html,/2,100\.00/); assert.match(html,/170\.00/); assert.match(html,/1,930\.00/);
  assert.doesNotMatch(html,/Tuition Fee|18,421\.25|12,561\.25/);
});
test('historical enrollment fees remain accessible separately', () => {
  const html=markup(DroppingBillHistory,{...bill,historicalInstallments:[{id:1,label:'First installment',amount:1000,dueDate:'2026-11-01'}],creditHistory:[{id:1,sourceBillId:1,kind:'returning_student',label:'Returning student credit',amount:2100,allocated:2100,remaining:0,allocations:[{id:1,billId:8,amount:2100,releasedAmount:0}]}]});
  assert.match(html,/View original fees/); assert.match(html,/Tuition Fee/);
  assert.match(html,/not additional dropping charges/);
  assert.match(html,/Past payment schedules/); assert.match(html,/First installment/);
  assert.doesNotMatch(html,/No active payment schedule|Payable upon re-enrollment/);
  assert.match(html,/Student credit history/); assert.match(html,/Returning student credit/);
  assert.match(html,/href="\/portal\/bills\/8"/);
});
test('receipt uses approved fees on its main statement and original fees only in history', () => {
  const html=buildBillReceiptHtml(bill,{name:'Student <One>'});
  const [statement,history]=html.split('<h2>Financial history</h2>');
  assert.match(statement,/Approved dropping charges/); assert.match(statement,/Laboratory Fee/);
  assert.doesNotMatch(statement,/Tuition Fee|12,561\.25/); assert.match(history,/Tuition Fee/);
  assert.match(statement,/Verified payments<\/span><span>₱170\.00/);
  assert.match(statement,/Student &lt;One&gt;/); assert.match(statement,/1,930\.00/);
});
test('fractional charge lines reconcile to the backend aggregate rounding', () => {
  const input={...bill,droppingAssessment:{...bill.droppingAssessment,finalCharge:0.01,feeCharges:[{name:'A',originalAmount:0.01,percent:50},{name:'B',originalAmount:0.01,percent:50}]}};
  assert.deepEqual(approvedChargeLines(input).map(row => row.amount),[0.01,0]);
});
test('historical category formulas use frozen component amounts', () => {
  const input={...bill,droppingAssessment:{...bill.droppingAssessment,feeCharges:[],finalCharge:750,formulas:{paying:{quarter_1:{miscellaneous:50}}},feeBreakdown:{miscellaneous:1500}}};
  assert.deepEqual(approvedChargeLines(input),[{name:'Miscellaneous fees',percent:50,base:1500,amount:750}]);
});
test('missing or inconsistent snapshot breakdown never substitutes original fees or a current policy', () => {
  for (const assessment of [null,{...bill.droppingAssessment,feeCharges:[],formulas:undefined},{...bill.droppingAssessment,finalCharge:100}]) {
    const input={...bill,droppingAssessment:assessment};
    assert.deepEqual(approvedChargeLines(input),[]);
    const html=markup(BillStatement,input); assert.doesNotMatch(html,/Tuition Fee|Laboratory Fee/);
    assert.match(html,/contact the school/i);
  }
});
test('credits are separate from verified payments, including a fully credit-covered bill', () => {
  const html=markup(BillStatement,{...bill,status:'paid',creditApplied:1930,balance:0});
  assert.match(html,/Applied student credit/); assert.match(html,/Remaining balance/); assert.match(html,/₱0\.00/);
  assert.match(markup(BillCollectionNotice,{...bill,balance:0}),/Dropping balance settled/);
});
test('student balance includes only verified payments and disables another payment during verification', () => {
  const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
  const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(MemoryRouter,null,createElement(BillActionPanel,{bill}))));
  assert.match(html,/Partially paid/); assert.match(html,/500\.00 awaiting verification/);
  assert.match(html,/1,930\.00/);
  assert.match(html,/<button[^>]*disabled=""[^>]*>[\s\S]*?Awaiting verification/);
  assert.match(html,/Verified payments/);
  assert.doesNotMatch(html,/Balance recorded|Net total/);
  client.clear();
});
test('student summary uses frozen approved charges and keeps return eligibility issues visible', () => {
  const html=markup(StudentDroppingSummary,{...bill,returnRequirements:{eligible:false,returnDeadline:'2028-10-07',blockers:['The two-year return window has expired.']}});
  assert.match(html,/Laboratory Fee/); assert.match(html,/Registration/);
  assert.doesNotMatch(html,/Tuition Fee|12,561\.25|1,930\.00/);
  assert.match(html,/The two-year return window has expired/);
  assert.match(html,/Oct 7, 2028/);
  assert.match(html,/Payment is optional/);
  assert.match(html,/portal\/programs\?reenroll=1/);
});
test('normal bills retain their enrollment fee breakdown and receipt', () => {
  const normal={...bill,droppingAssessment:null,collectionState:'standard',netTotal:18421.25,balance:18251.25};
  assert.match(markup(BillStatement,normal),/Tuition Fee/);
  const html=buildBillReceiptHtml(normal,{name:'Student'});
  assert.match(html,/Tuition Fee/); assert.doesNotMatch(html,/<h2>Financial history/);
});

const enrollmentBill = {
  ...bill, id:4, schoolYear:'2027-2028', status:'unpaid', collectionState:'standard', droppingAssessment:null,
  netTotal:18421.25, balance:18421.25, amountPaid:0, amountDue:120, discountTotal:0, payments:[],
  createdAt:'2026-10-15', installments:[{id:1,sequence:1,label:'Down payment',amount:120,amountPaid:0,balance:120,status:'unpaid',dueDate:'2030-10-06'}],
};
function paymentHeader(input) {
  const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
  const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(MemoryRouter,null,createElement(BillActionPanel,{bill:input}))));
  client.clear();
  return html;
}
test('enrollment bill distinguishes the installment due from the full remaining balance', () => {
  const html=paymentHeader(enrollmentBill);
  assert.match(html,/Amount due now<\/dt><dd[^>]*>₱120\.00/);
  assert.match(html,/Remaining balance <span[^>]*>₱18,421\.25/);
  assert.match(html,/Due Oct 6, 2030/); assert.match(html,/>Pay now</);
  assert.doesNotMatch(html,/Net total|paid of|% complete|Current bill|Past bill|>Actions</);
  const fullDue=paymentHeader({...enrollmentBill,amountDue:18421.25});
  assert.equal((fullDue.match(/18,421\.25/g) ?? []).length,1);
});
test('a pending enrollment payment leaves the balance intact and blocks another submission', () => {
  const html=paymentHeader({...enrollmentBill,payments:[{id:1,status:'pending',amount:120}]});
  assert.match(html,/₱120\.00 awaiting verification/);
  assert.match(html,/Remaining balance <span[^>]*>₱18,421\.25/);
  assert.match(html,/<button[^>]*disabled=""[^>]*>[\s\S]*?Awaiting verification/);
  assert.doesNotMatch(html,/18,301\.25/);
});
test('the header distinguishes optional advance payments from overdue installments', () => {
  const advance=paymentHeader({...enrollmentBill,amountDue:0});
  assert.match(advance,/Remaining balance<\/dt><dd[^>]*>₱18,421\.25/);
  assert.match(advance,/Next installment ₱120\.00 on Oct 6, 2030/);
  assert.match(advance,/>Pay in advance</);
  assert.doesNotMatch(advance,/Amount due now|Overdue since/);
  const overdue=paymentHeader({...enrollmentBill,installments:[{...enrollmentBill.installments[0],dueDate:'2000-10-06'}]});
  assert.match(overdue,/Overdue since Oct 6, 2000/); assert.match(overdue,/>Pay now</);
});
test('settled bills have no payment action and receipts remain available for verified cash payments', () => {
  for (const amountPaid of [0,18421.25]) {
    const html=paymentHeader({...enrollmentBill,status:'paid',balance:0,amountDue:0,amountPaid,creditApplied:18421.25-amountPaid});
    assert.match(html,/Bill settled/); assert.match(html,/No remaining balance/);
    assert.doesNotMatch(html,/Pay now|Pay in advance|Amount due now|Next installment/);
    if (amountPaid > 0) assert.match(html,/>Receipt</); else assert.doesNotMatch(html,/>Receipt</);
  }
});
test('the student bill page omits re-enrollment requirements while retaining billing details', () => {
  const input={...enrollmentBill,returnRequirements:{eligible:true,previousBalance:0,newEnrollmentPayment:120,returnDeadline:'2028-10-07',blockers:['Meet the enrollment payment requirement.']}};
  const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
  client.setQueryData(['me','bill'],input); client.setQueryData(['me','bills'],[input]);
  const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(MemoryRouter,{initialEntries:['/portal/bills/4']},createElement(Routes,null,createElement(Route,{path:'/portal/bills/:id',element:createElement(BillDetailPage)})))));
  assert.doesNotMatch(html,/Re-enrollment payment requirements|Complete re-enrollment|View re-enrollment options|What is needed for re-enrollment/);
  assert.match(html,/Enrollment bill/); assert.match(html,/Tuition Fee/); assert.match(html,/>Schedule</); assert.match(html,/>Payments</);
  assert.match(html,/Net total/); assert.match(html,/Outstanding balance/);
  client.clear();
});
