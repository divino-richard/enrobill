<!DOCTYPE html>
<html lang="en">
<body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
    <h2 style="color: #1d4ed8;">Verify your email address</h2>

    <p>Hi {{ $name }},</p>

    <p>
        Thanks for registering with {{ $appName }}. Please confirm that
        {{ $email }} is your email address by clicking the button below.
    </p>

    <p>
        <a href="{{ $verificationUrl }}"
           style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
            Verify Email Address
        </a>
    </p>

    <p style="color:#6b7280;font-size:13px;">
        If you didn't create this account, no further action is required.
    </p>

    <p style="color:#6b7280;font-size:13px;">— {{ $appName }} · Northlink Technological College</p>
</body>
</html>
