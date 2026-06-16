# Email — AWS SES

Enrobill sends transactional email through **Amazon SES**, using Laravel's
built-in `ses` mail transport (backed by `aws/aws-sdk-php`). Email content is
rendered from **Blade templates** in the app (e.g.
`resources/views/emails/verify-email.blade.php`) and sent through SES.

## How it's wired

| Where | Setting |
|-------|---------|
| `config/mail.php` | `mailers.ses` → `transport: ses` |
| `config/services.php` | `services.ses` → key / secret / region from env |
| `.env` | `MAIL_MAILER=ses`, `AWS_*`, `MAIL_FROM_ADDRESS` |

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

## What you need to provide (AWS side)

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

SES sandbox can only send to verified recipients. For day-to-day local testing
without AWS, set `MAIL_MAILER=log` (the rendered email + verify link is written
to `storage/logs/laravel.log`), then switch back to `ses` for staging/prod.
