import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { StudentDashboard } = await server.ssrLoadModule('/src/features/students/components/student-dashboard.tsx');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const { ReturnJourney } = await server.ssrLoadModule('/src/features/re-enrollment/return-journey.tsx');
const { default: ProgramsPage } = await server.ssrLoadModule('/src/pages/portal/programs-page.tsx');
const { default: BillsPage } = await server.ssrLoadModule('/src/pages/portal/bills-page.tsx');
const source = { id: 1, schoolYear: '2026-2027', program: 'stem', programName: 'STEM', yearLevel: 'grade_11', droppingRequestId: 4, billId: 5 };
const base = { state: 'unavailable', canStart: false, source, effectiveDroppingDate: '2026-10-07', returnDeadline: '2028-10-07', offer: null, enrollment: null, requirements: null, previousBills: [{id:5, schoolYear:'2026-2027', balance:1930, pendingPayment:0}], availableCredit:0, blockers: ['Re-enrollment is not yet open for a later school year.'] };
function render(summary, Component = StudentDashboard) {
  const user = {id: 12, role: 'student'};
  useAuthStore.setState({user}); Object.assign(useAuthStore.getInitialState(), {user});
  const client = new QueryClient({ defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
  client.setQueryData(['me','student'], {id:8, firstName:'Returning', studentNumber:'2026-001', status:'dropped', trackOrStrand:'stem', yearLevel:'grade_11'});
  client.setQueryData(['me','re-enrollment',12], summary);
  client.setQueryData(['me','bill'], null);
  client.setQueryData(['me','documents'], []);
  client.setQueryData(['me','class-schedule',12,undefined], {entries:[],status:'no_section'});
  client.setQueryData(['programs'], []);
  const result = renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(MemoryRouter,null,createElement(Component))));
  client.clear(); return result;
}
test('a dropped student has a return entry and no current class, referral or clearance prompts', () => {
  const html=render(base);
  assert.match(html,/href="\/portal\/programs\?reenroll=1"/);
  assert.match(html,/Re-enrollment is not yet open/);
  assert.doesNotMatch(html,/Your schedule is on its way|Upload your clearance|Next payment|Referral details/);
});
test('pending return directs to completion rather than another enrollment', () => {
  const html=render({...base,state:'pending',enrollment:{id:2,status:'pending',schoolYear:'2027-2028',billId:6},requirements:{eligible:true,blockers:[],previousBalance:1930,newEnrollmentPayment:500}});
  assert.match(html,/Continue re-enrollment/);
  assert.doesNotMatch(html,/>Re-enroll</);
});

test('My Program keeps its normal content and a compact re-enrollment action without a new tab', () => {
  const html=render(base, ProgramsPage);
  assert.match(html,/My Program/);
  assert.match(html,/Enrollment details/);
  assert.match(html,/aria-label="View details for re-enrollment"/);
  assert.doesNotMatch(html,/Your payments|Previous balance|Start re-enrollment/);
  assert.doesNotMatch(html,/<button[^>]*role="tab"[^>]*>Re-enrollment/);
});

test('re-enrollment button names match the visible action in ready and pending states', () => {
  const ready=render({...base,state:'ready',canStart:true}, ProgramsPage);
  const pending=render({...base,state:'pending'}, ProgramsPage);
  assert.match(ready,/aria-label="Review &amp; re-enroll"/);
  assert.match(pending,/aria-label="Continue re-enrollment"/);
});

function journey(summary) { return renderToStaticMarkup(createElement(MemoryRouter,null,createElement(ReturnJourney,{data:summary,onStart:()=>{}}))); }
test('settled return creates a pending enrollment and explains cashier billing', () => {
  const html=journey({...base,state:'ready',canStart:true,previousBills:[{...base.previousBills[0],balance:0}],offer:{schoolYearId:2,schoolYear:'2027-2028',feeTotal:10000,downpaymentType:'fixed',downpaymentValue:500}});
  assert.match(html,/type="submit"[^>]*>Start re-enrollment/);
  assert.match(html,/Requirement met/); assert.match(html,/500\.00/);
  assert.match(html,/Starting creates a pending enrollment/);
  assert.doesNotMatch(html,/Starting creates your new bill/);
  assert.match(html,/href="\/portal\/bills\/5"/);
  assert.doesNotMatch(html,/<select|role="combobox"/); // student cannot choose a privileged voucher or grade
});
test('pending return links each debt to its own bill and exposes verification blockers', () => {
  const html=journey({...base,state:'pending',enrollment:{id:2,status:'pending',schoolYear:'2027-2028',billId:6},requirements:{newEnrollmentPayment:500},blockers:['A payment is awaiting verification.'],previousBills:[{...base.previousBills[0],pendingPayment:100}]});
  assert.match(html,/href="\/portal\/bills\/5"/); assert.match(html,/href="\/portal\/bills\/6"/);
  assert.match(html,/100\.00 awaiting verification/); assert.match(html,/A payment is awaiting verification/);
  assert.doesNotMatch(html,/type="submit"/);
});
test('expired return preserves bill access without offering another start or promising activation', () => {
  const html=journey({...base,state:'blocked',blockers:['The re-enrollment deadline was 2028-10-07. Contact the school.']});
  assert.match(html,/deadline was 2028-10-07/); assert.match(html,/href="\/portal\/bills\/5"/);
  assert.doesNotMatch(html,/type="submit"|View bill &amp; pay/);
  assert.doesNotMatch(html,/settle when you return/);
  assert.match(html,/Payments do not resolve the eligibility issue/);
});
test('completed activation shows the new program and bill without an obsolete deadline', () => {
  const html=journey({...base,state:'enrolled',source:null,returnDeadline:null,enrollment:{id:2,status:'enrolled',schoolYear:'2027-2028',billId:6}});
  assert.match(html,/href="\/portal\/programs"/); assert.match(html,/href="\/portal\/bills\/6"/);
  assert.doesNotMatch(html,/Oct 7, 2028|type="submit"|Your payments/);
});

test('a staff-approved return displays its target program and grade instead of the dropped enrollment', () => {
  const html=journey({...base,state:'pending',enrollment:{id:2,status:'pending',schoolYear:'2027-2028',billId:6,program:'abm',programName:'ABM',yearLevel:'grade_12'},requirements:{newEnrollmentPayment:500}});
  assert.match(html,/>ABM</); assert.match(html,/>grade 12</);
  assert.doesNotMatch(html,/>STEM<|>grade 11</);
});

test('activated students can still open historical documents from My Program history', () => {
  const user = {id:12,role:'student'};
  useAuthStore.setState({user}); Object.assign(useAuthStore.getInitialState(),{user});
  const client = new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
  client.setQueryData(['me','student'],{id:8,status:'enrolled',studentNumber:'2026-001',trackOrStrand:'stem',yearLevel:'grade_11'});
  client.setQueryData(['me','re-enrollment',12],{...base,state:'enrolled',source:null,returnDeadline:null});
  client.setQueryData(['me','enrollments',12],[{id:2,isCurrent:true,status:'enrolled',schoolYear:'2027-2028',program:'stem',yearLevel:'grade_11'}, {id:1,isCurrent:false,status:'dropped',schoolYear:'2026-2027',program:'stem',yearLevel:'grade_11'}]);
  client.setQueryData(['me','documents'],[]);
  client.setQueryData(['me','documents','history'],[{id:3,fileName:'previous-grades.pdf',schoolYear:'2026-2027',semester:'first',type:'grades'}]);
  client.setQueryData(['programs'],[]);
  const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(MemoryRouter,{initialEntries:['/portal/programs?section=history']},createElement(ProgramsPage))));
  assert.match(html,/Enrollment history/); assert.match(html,/previous-grades.pdf/); assert.match(html,/SY 2026-2027/);
  client.clear();
});

function billsMarkup(bills) {
  const user = {id:12,role:'student'};
  useAuthStore.setState({user}); Object.assign(useAuthStore.getInitialState(),{user});
  const client = new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
  client.setQueryData(['me','bill'], bills[0]);
  client.setQueryData(['me','bills'], bills);
  client.setQueryData(['me','re-enrollment',12], base);
  const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(MemoryRouter,null,createElement(BillsPage))));
  client.clear();
  return html;
}

test('returning students see distinct school-year charges and actual payment statuses', () => {
  const html=billsMarkup([
    {id:6,schoolYear:'2027-2028',status:'unpaid',netTotal:18421.25,amountPaid:0,balance:18421.25,collectionState:'standard'},
    {id:5,schoolYear:'2026-2027',status:'partial',netTotal:2100,amountPaid:170,balance:1930,collectionState:'required_for_reenrollment'},
  ]);
  assert.match(html,/SY 2027-2028/); assert.match(html,/SY 2026-2027/);
  assert.match(html,/Enrollment charges/); assert.match(html,/Dropping charges/);
  assert.match(html,/18,421\.25/); assert.match(html,/1,930\.00/);
  assert.match(html,/>Payment status</);
  assert.match(html,/>Unpaid</); assert.match(html,/>Partially paid</);
  assert.doesNotMatch(html,/Settle before completing re-enrollment/);
  assert.doesNotMatch(html,/aria-label="Re-enrollment"|Bills by school year|Dropping charges stay on their original bill/);
});

test('deferring a dropping balance does not replace its payment status with a collection instruction', () => {
  const html=billsMarkup([{id:5,schoolYear:'2026-2027',status:'unpaid',netTotal:2100,amountPaid:0,balance:2100,collectionState:'deferred_until_reenrollment'}]);
  assert.match(html,/>Unpaid</); assert.match(html,/Dropping charges/);
  assert.doesNotMatch(html,/Overdue|Payable upon re-enrollment/);
});

test('a dropping bill covered by applicable credits keeps its settled payment status', () => {
  const html=billsMarkup([{id:5,schoolYear:'2026-2027',status:'paid',netTotal:2100,amountPaid:0,balance:0,creditApplied:2100,collectionState:'deferred_until_reenrollment'}]);
  assert.match(html,/>Paid</);
  assert.doesNotMatch(html,/>Unpaid<|>Partially paid<|Payable upon re-enrollment/);
});


test('settlement comes before the start action and exposes pending verification', () => {
  const html=journey({...base,state:'settlement_required',blockers:['Settle the previous dropping balance before starting re-enrollment.'],previousBills:[{...base.previousBills[0],pendingPayment:1930}]});
  assert.match(html,/Payment verification pending/);
  assert.match(html,/1,930\.00 awaiting verification/);
  assert.match(html,/href="\/portal\/bills\/5"/);
  assert.doesNotMatch(html,/type="submit"|New enrollment payment|Payments do not resolve/);
  const banner=render({...base,state:'settlement_required'});
  assert.match(banner,/before a pending enrollment can be created/);
});

test('pending return without a bill directs the student to cashier billing without payment demands', () => {
  const data={...base,state:'pending',previousBills:[{...base.previousBills[0],balance:0}],enrollment:{id:2,status:'pending',schoolYear:'2027-2028',billId:null},requirements:{previousBalance:0,newEnrollmentPayment:null}};
  const html=journey(data);
  assert.match(html,/cashier will generate your new school-year bill/);
  assert.doesNotMatch(html,/Pay each bill separately|New enrollment payment|type="submit"/);
  assert.match(render(data),/Waiting for cashier billing/);
});


test('legacy pending return with unpaid debt never promises cashier billing readiness', () => {
  const data={...base,state:'pending',enrollment:{id:2,status:'pending',schoolYear:'2027-2028',billId:null},requirements:{eligible:true,previousBalance:1930,newEnrollmentPayment:null},blockers:['Settle previous dropping balances.']};
  for (const html of [journey(data),render(data)]) {
    assert.match(html,/Settle your dropping balance to return/);
    assert.match(html,/Cashier billing remains blocked/);
    assert.doesNotMatch(html,/Waiting for cashier billing|ready for billing|cashier will generate/);
  }
  assert.match(journey(data),/Settle previous dropping balances/);
});
test('expiry takes precedence over verification and billing readiness', () => {
  const data={...base,state:'pending',enrollment:{id:2,status:'pending',schoolYear:'2027-2028',billId:null},requirements:{eligible:false,previousBalance:0,newEnrollmentPayment:null},previousBills:[],blockers:['The re-enrollment deadline was 2028-10-07.']};
  for (const html of [journey(data),render(data)]) {
    assert.match(html,/Re-enrollment needs attention/);
    assert.doesNotMatch(html,/Waiting for cashier billing|ready for billing|cashier will generate/);
  }
  assert.match(journey(data),/deadline was 2028-10-07/);
});
test('a pending payment covering old debt asks for verification instead of another payment', () => {
  const data={...base,state:'pending',enrollment:{id:2,status:'pending',billId:null},requirements:{eligible:true,previousBalance:1930},previousBills:[{...base.previousBills[0],pendingPayment:1930}]};
  assert.match(journey(data),/Payment verification pending/);
  assert.doesNotMatch(journey(data),/Waiting for cashier billing|ready for billing|type="submit"/);
});
