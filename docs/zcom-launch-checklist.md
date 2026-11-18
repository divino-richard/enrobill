# Z.com Starter launch checklist

This checklist covers Enrobill's first production launch on Z.com Starter using
Laravel, a static React frontend, an empty MySQL database, cPanel SMTP, and private
S3 document storage. There is no historical database or file migration to perform.

Replace `example.com`, `USER`, and credential placeholders with your actual values.
Run hosting commands over SSH unless a step explicitly says to run them locally.
Keep real credentials out of this file and Git.

1. **Prepare Z.com hosting.**

   Enable SSH and select PHP **8.3** for the API domain. Confirm that Composer,
   terminal commands, and cron also run under PHP 8.3. Check `php -v` in the terminal;
   the command examples below assume `php` and Composer use that version.

   Enable `pdo_mysql` and the extensions required by Laravel and Composer. Confirm
   that every-minute cron, outbound S3 HTTPS access, and the API document root in
   step 2 are supported on your account. Z.com advertises PHP 8.3 and SSH for Starter.
   [Z.com hosting](https://web.z.com/ph/hosting/)

2. **Configure domains, HTTPS, and document roots.**

   Use this layout, replacing the example names and account path:

   | Purpose | Address or path |
   | --- | --- |
   | Frontend | `https://example.com` |
   | Backend | `https://api.example.com` |
   | Frontend document root | `/home/USER/public_html` |
   | Backend application | `/home/USER/enrobill/backend` |
   | API document root | `/home/USER/enrobill/backend/public` |

   Point DNS to Z.com, enable SSL on both domains, force HTTPS, and redirect `www`
   to your chosen frontend hostname. Use that same frontend origin throughout the
   backend environment, S3 CORS, and frontend build configuration.

   Keep the backend application outside `public_html`. Only its `public` directory
   should be exposed by the API domain. Confirm this document root with Z.com if
   cPanel restricts its location; do not expose the backend root as a workaround.
   [Laravel deployment guidance](https://laravel.com/docs/13.x/deployment)

3. **Create an empty production database.**

   Create a MySQL database and a dedicated database user in cPanel. Assign that
   user permissions on this database. Record the full cPanel-prefixed database
   name, username, password, and database host.

   Do not import your local database or run the demo seeder. The production seeder
   guard blocks the creation of demo accounts.

4. **Finish S3 configuration.**

   The official form has already been uploaded. Confirm it uses this exact key in
   the bucket selected for production:

   ```text
   forms/official-dropping-form.pdf
   ```

   Keep the bucket private with Block Public Access enabled. Give backend
   credentials `s3:ListBucket` access for the relevant prefixes, and
   `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` access for application
   documents under `applications/`, `students/`, `payment-proofs/`,
   `payment-channels/`, and `dropping/`. Reading the official form requires
   `s3:GetObject` access to its key. Store AWS credentials only in the backend
   environment, never in frontend `VITE_*` variables.

   Configure bucket CORS for your frontend origin:

   ```json
   [
     {
       "AllowedOrigins": ["https://example.com"],
       "AllowedMethods": ["GET", "HEAD", "PUT"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": [
         "ETag",
         "Accept-Ranges",
         "Content-Range",
         "Content-Length"
       ],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   These settings support direct uploads and document previews.
   [AWS CORS configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html)

5. **Configure your email account and DNS.**

   The application and `backend/.env.example` already default to SMTP. SES remains
   selectable through `MAIL_MAILER=ses` if needed later; there is no automatic
   switch to SES when SMTP fails.

   Create the sending mailbox in cPanel. Copy its SMTP hostname, port, and security
   settings from **Connect Devices**. Check the account's sending limits before
   opening admissions.

   Publish the mailbox's required MX, SPF, and DKIM records at your authoritative
   DNS provider, and configure DMARC. Avoid creating duplicate SPF records.

   The environment example below uses implicit TLS on port `465`. Use the actual
   settings supplied by Z.com and an authorized sender address. See the
   [email guide](email.md) for provider configuration and delivery checks.

6. **Upload the backend and create its production `.env`.**

   Upload the backend application, including its hidden `public/.htaccess`. Exclude
   your local `.env`, SQLite database, logs, cached configuration, `.git`, and
   development dependencies. Preserve Laravel's empty runtime directories.

   Create `.env` from `backend/.env.example`, then set these production values:

   ```dotenv
   APP_NAME=Enrobill
   APP_ENV=production
   APP_KEY=
   APP_DEBUG=false
   APP_URL=https://api.example.com
   FRONTEND_URL=https://example.com

   DB_CONNECTION=mysql
   DB_HOST=YOUR_DATABASE_HOST
   DB_PORT=3306
   DB_DATABASE=YOUR_DATABASE_NAME
   DB_USERNAME=YOUR_DATABASE_USER
   DB_PASSWORD="YOUR_DATABASE_PASSWORD"

   FILESYSTEM_DISK=s3
   AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
   AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
   AWS_DEFAULT_REGION=YOUR_BUCKET_REGION
   AWS_BUCKET=YOUR_BUCKET_NAME
   AWS_USE_PATH_STYLE_ENDPOINT=false

   SESSION_DRIVER=database
   CACHE_STORE=database
   QUEUE_CONNECTION=database

   MAIL_MAILER=smtp
   MAIL_SCHEME=smtps
   MAIL_HOST=YOUR_SMTP_HOST
   MAIL_PORT=465
   MAIL_USERNAME=no-reply@example.com
   MAIL_PASSWORD="YOUR_MAILBOX_PASSWORD"
   MAIL_FROM_ADDRESS=no-reply@example.com
   MAIL_FROM_NAME="${APP_NAME}"

   LOG_CHANNEL=daily
   LOG_LEVEL=info
   LOG_DAILY_DAYS=14
   ```

   `APP_URL` must not include `/api`. Use the exact `FRONTEND_URL` origin without a
   trailing slash. Leave `APP_KEY` empty until the first initialization in step 7.

7. **Install and initialize the backend.**

   Ensure PHP can write `storage/` and `bootstrap/cache/`. Keep Laravel's runtime
   directories for logs, sessions, and compiled views even though documents use S3.
   Use account-appropriate ownership and permissions; do not make them world-writable.

   From the backend directory, using PHP 8.3:

   ```bash
   cd /home/USER/enrobill/backend
   composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
   composer check-platform-reqs --no-dev

   php artisan config:clear
   php artisan route:clear
   php artisan view:clear
   php artisan key:generate --force
   php artisan migrate --force

   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   php artisan migrate:status
   ```

   Generate the application key **once**, then preserve it for future deployments
   and backups. Do not run `db:seed`, `storage:link`, or `composer update` on
   production. Keep the initialization order above: database-backed cache clearing
   can fail before migrations create the cache table.

   If hosting lacks Composer, install production dependencies from the checked-in
   lock file using PHP 8.3 elsewhere and upload the resulting `vendor` directory.
   Verify the hosting runtime requirements before continuing.

   Rebuild Laravel's configuration cache after later `.env` changes.

8. **Build and upload the frontend.**

   On your computer, use Node 22.12 or newer in the Node 22 release line:

   ```bash
   cd /Users/richarddivino/Capstones/enrobill/frontend
   npm ci
   VITE_API_URL=https://api.example.com/api npm run build
   ```

   Upload the **contents** of `frontend/dist` into the frontend document root,
   including its hidden `.htaccess` and all asset directories.

   The API address is baked into the build. Changing it requires rebuilding and
   uploading again. Node is needed for this local build, not to serve the deployed
   static frontend.

9. **Enable scheduled reminders.**

   Add this every-minute cPanel cron, replacing `PHP83_PATH` with the verified
   absolute PHP 8.3 executable path:

   ```cron
   * * * * * cd /home/USER/enrobill/backend && PHP83_PATH artisan schedule:run >> /dev/null 2>&1
   ```

   Check the schedule from the backend directory:

   ```bash
   php artisan schedule:list
   ```

   The existing reminder runs at **07:00 UTC, or 3:00 PM Manila**. Setting
   `APP_TIMEZONE` currently does not change this because the application timezone
   is configured as UTC in code.

   The current application does not require a persistent queue worker. Confirm
   cron execution and inspect application logs after the scheduled run.

10. **Create your real administrator and cashier.**

    Register your real account through the application and verify its email.
    From the backend directory, run:

    ```bash
    php artisan tinker
    ```

    Inside Tinker, promote only your verified account:

    ```php
    \App\Models\User::where('email', 'YOUR_REAL_EMAIL')
        ->whereNotNull('email_verified_at')
        ->firstOrFail()
        ->update(['role' => \App\Enums\Role::Admin]);
    ```

    Sign in again. Use **Users** to create the cashier and other staff accounts.
    A cashier account is required for billing, payment verification, and
    payment-channel configuration.

11. **Complete school configuration before opening admissions.**

    Review programs, create the school year, and configure its dates, downpayment,
    and installments. Review the automatically copied historical fee amounts and
    publish the applicable Grade 11 and Grade 12 fee schedules.

    Configure discounts and dropping policies as needed. Have the cashier enter
    real payment account details and upload QR codes, or disable unused channels.
    The initial GCash, Maya, and bank-transfer channels have blank account details.

    Activate the correct school year. Complete the launch checks below before
    opening admissions to real applicants.

12. **Verify the live installation and backups.**

    Check API `/api/health`, refreshing nested frontend pages, registration and
    email verification, admin/cashier access, application approval, billing, and
    payment verification. Check inbox delivery for verification and application
    decision emails; the API can succeed even when mail delivery fails. Inspect
    Laravel's logs for delivery errors.

    Exercise every document workflow: upload, preview, download, deletion, and
    the official dropping-form download. Cover application documents, student and
    grade documents, payment proofs, payment QR codes, and dropping submissions.
    Confirm `.env` and backend source files cannot be accessed through the website.

    Configure database backups, securely retain `.env` and `APP_KEY`, and enable
    suitable S3 versioning or backup retention. Hosting backups do not cover the
    external S3 bucket. Verify that you can restore both database records and
    documents before accepting real submissions.

Existing Docker, nginx, and SES configuration remains available for development
or alternative hosting. This deployment uses cPanel for the API, database, SMTP,
and cron, with S3 as the only application document store.
