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
test('available return offers a start action and keeps old and new payment requirements separate', () => {
  const html=journey({...base,state:'ready',canStart:true,offer:{schoolYearId:2,schoolYear:'2027-2028',feeTotal:10000,downpaymentType:'fixed',downpaymentValue:500}});
  assert.match(html,/type="submit"[^>]*>Start re-enrollment/);
  assert.match(html,/1,930\.00/); assert.match(html,/500\.00/);
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
