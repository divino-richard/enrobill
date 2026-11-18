# Email configuration

Enrobill defaults to **SMTP** for the Z.com/cPanel deployment. Laravel selects the
mailer through `MAIL_MAILER`. **Amazon SES** remains available as an explicit
alternative using `MAIL_MAILER=ses`; it is not an automatic fallback.

Email content is rendered from Blade templates, including
`resources/views/emails/verify-email.blade.php`. Verification and application
decision emails use the configured default mailer, so switching providers does
not require changing application code or templates.

## How it's wired

| Where | Setting |
|-------|---------|
| `config/mail.php` | Default `smtp`; SMTP and SES transports remain available |
| `.env` | `MAIL_MAILER`, connection settings, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` |
| `config/services.php` | Optional SES credentials and region from `AWS_*` |

## Z.com/cPanel SMTP

Create the sending mailbox in cPanel and use its **Connect Devices** settings.
The checked-in environment example selects SMTP with implicit TLS on port 465.
Replace the example values with the actual mailbox details:

```dotenv
MAIL_MAILER=smtp
MAIL_SCHEME=smtps
MAIL_HOST=mail.example.com
MAIL_PORT=465
MAIL_USERNAME=no-reply@example.com
MAIL_PASSWORD="YOUR_MAILBOX_PASSWORD"
MAIL_FROM_ADDRESS=no-reply@example.com
MAIL_FROM_NAME="${APP_NAME}"
```

Use the hostname, port, and security mode supplied by the provider. The sender
must be authorized for that mailbox/domain. Publish its MX, SPF, and DKIM records
at the authoritative DNS provider, configure DMARC, and check the account's
sending limits. The complete deployment steps are in the
[Z.com launch checklist](zcom-launch-checklist.md).

After changing production settings, rebuild Laravel's configuration cache:

```bash
php artisan config:cache
```

Verify both inbox delivery and the emailed verification link, then check an
application decision email. Sending errors are logged without failing the main
request, so a successful registration response alone does not prove delivery.
These messages are sent after the response and do not require a queue worker.
The scheduled installment reminders are in-app notifications, not emails.

S3 continues to use the `AWS_*` settings independently of SMTP. Keep those
credentials configured for document storage.

## Email verification (on registration)

When a student aspirant registers, the API:

1. Creates the applicant + issues their token (registration returns `201`).
2. Builds a **signed, 48-hour** verification URL to
   `GET /api/email/verify/{id}/{hash}` (route `verification.verify`).
3. Sends `App\Mail\VerifyEmailMail` — subject **"Verify Your Email Address –
   Enrobill"** — rendered from `emails/verify-email.blade.php`, **deferred**
   after the response and wrapped in try/catch so mail issues never break
   registration.

Opening the link validates the signature, sets `email_verified_at`, and
redirects to `FRONTEND_URL/login?verified=1`.

## Optional AWS SES configuration

To select SES, set `MAIL_MAILER=ses` and configure the following. SMTP settings are
unused while SES is selected; keep them available for switching back.

1. **AWS account** with access to SES.
2. **IAM credentials** for an IAM user/role allowed to send:
   - policy with `ses:SendRawEmail` (and `ses:SendEmail`)
   - → `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
3. **SES region** where you verify your identity and send:
   - → `AWS_DEFAULT_REGION` (e.g. `us-east-1`, `ap-southeast-1`)
4. **A verified sender identity** in that region:
   - a verified **domain** (recommended — add the DKIM CNAME records, plus SPF /
     DMARC), or a verified **single email address**.
   - `MAIL_FROM_ADDRESS` must be on / equal to that verified identity.
5. **Production access** — by default SES is in **sandbox** mode and can only
   send to *verified* recipients. Request production access in the SES console
   to send to any applicant. (Free; AWS reviews it.)

## Local development

For local testing without sending email, set `MAIL_MAILER=log`. The rendered email
and verification link are written to the configured Laravel log channel (with the
default local logging settings, `storage/logs/laravel.log`). Run
`php artisan config:clear` if local configuration was cached.

Use `MAIL_MAILER=smtp` with the real cPanel mailbox settings for the Z.com launch.
Use `MAIL_MAILER=ses` only when intentionally selecting the retained SES setup.
