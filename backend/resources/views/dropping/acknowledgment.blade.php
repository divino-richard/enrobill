<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{{ $dropping->reference() }} — Dropping request approval</title>
<style>body{font:16px/1.6 Arial,sans-serif;max-width:760px;margin:48px auto;padding:24px;color:#18232d}h1{font-size:25px}dt{font-weight:bold;margin-top:12px}dd{margin:0}footer{border-top:1px solid #ccc;margin-top:32px;padding-top:16px;font-size:13px}@media print{body{margin:0}}</style></head>
<body><h1>Dropping request approval</h1><p>Northlink Technological College, Inc.</p>
<dl><dt>Reference</dt><dd>{{ $dropping->reference() }}</dd><dt>Student</dt><dd>{{ $dropping->snapshot['studentName'] }} · {{ $dropping->snapshot['studentNumber'] }}</dd><dt>Enrollment</dt><dd>{{ $dropping->snapshot['program'] }} · {{ str_replace('_', ' ', $dropping->snapshot['yearLevel']) }} · SY {{ $dropping->snapshot['schoolYear'] }}</dd><dt>Effective dropping date</dt><dd>{{ $dropping->effective_date->format('F j, Y') }}</dd><dt>Approved</dt><dd>{{ $dropping->confirmed_at->format('F j, Y H:i') }} ({{ config('app.timezone') }})</dd><dt>Remarks</dt><dd>{{ $dropping->final_remarks }}</dd></dl>
<p>The above enrollment has been officially marked Dropped following approval of this request.</p>
@if($assessment = $dropping->enrollment->bill?->droppingAssessment?->snapshot)
<h2>Dropping charges at approval</h2>
<dl>
<dt>Final charge</dt><dd>₱{{ number_format($assessment['finalCharge'], 2) }}</dd>
<dt>Verified payments</dt><dd>₱{{ number_format($assessment['verifiedPayments'], 2) }}</dd>
<dt>Balance at approval</dt><dd>₱{{ number_format($assessment['balance'], 2) }}</dd>
@if($assessment['credit'] > 0)<dt>Credit for a future enrollment</dt><dd>₱{{ number_format($assessment['credit'], 2) }}</dd>@endif
</dl><p>View your bill in the student portal for payments made after approval and your current balance.</p>
@endif
<footer>This approval does not cancel unpaid bills. The signed official form is retained with the request. Returning in a future school year requires a new enrollment under the same student record. Use your browser’s Print command to print or save this approval as PDF.</footer></body></html>
