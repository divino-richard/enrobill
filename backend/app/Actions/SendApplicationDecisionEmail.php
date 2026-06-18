<?php

namespace App\Actions;

use App\Mail\ApplicationDecisionMail;
use App\Models\Application;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

use function Illuminate\Support\defer;

class SendApplicationDecisionEmail
{
    /**
     * Email the applicant the outcome of their application — deferred (after the
     * response) and fault-tolerant so it never breaks the admin's request.
     *
     * @param  'accepted'|'rejected'  $decision
     */
    public function __invoke(Application $application, string $decision): void
    {
        $applicant = $application->user;

        if ($applicant === null) {
            return;
        }

        $applicationsUrl = rtrim((string) config('app.frontend_url'), '/').'/portal/application';

        defer(function () use ($application, $decision, $applicant, $applicationsUrl) {
            try {
                Mail::to($applicant->email, $applicant->name)
                    ->send(new ApplicationDecisionMail($application, $decision, $applicationsUrl));
            } catch (\Throwable $e) {
                Log::warning('Application decision email failed to send.', [
                    'application_id' => $application->id,
                    'email' => $applicant->email,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }
}
