<!DOCTYPE html>
<html lang="en">
<body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
    @if ($decision === 'accepted')
        <h2 style="color: #047857;">Your application has been accepted</h2>

        <p>Hi {{ $name }},</p>

        <p>
            Great news — your enrollment application
            <strong>{{ $reference }}</strong>@if ($schoolYear) for school year {{ $schoolYear }}@endif
            has been <strong>accepted</strong> by {{ $appName }}.
        </p>

        <p>
            You can view your application and the next steps for enrollment on
            your applications page.
        </p>

        <p>
            <a href="{{ $applicationsUrl }}"
               style="display:inline-block;background:#047857;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
                View your applications
            </a>
        </p>
    @else
        <h2 style="color: #b91c1c;">Update on your application</h2>

        <p>Hi {{ $name }},</p>

        <p>
            We've reviewed your enrollment application
            <strong>{{ $reference }}</strong>@if ($schoolYear) for school year {{ $schoolYear }}@endif,
            and unfortunately it was <strong>not approved</strong> at this time.
        </p>

        @if (!empty($note))
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Note from the registrar:</p>
            <blockquote style="margin:0 0 16px;padding:10px 14px;background:#fef2f2;border-left:3px solid #b91c1c;color:#7f1d1d;">
                {{ $note }}
            </blockquote>
        @endif

        <p>
            You can review the details and, if applicable, edit and resubmit your
            application from your applications page.
        </p>

        <p>
            <a href="{{ $applicationsUrl }}"
               style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
                View your applications
            </a>
        </p>
    @endif

    <p style="color:#6b7280;font-size:13px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="{{ $applicationsUrl }}" style="color:#1d4ed8;">{{ $applicationsUrl }}</a>
    </p>

    <p style="color:#6b7280;font-size:13px;">— {{ $appName }} · Northlink Technological College</p>
</body>
</html>
