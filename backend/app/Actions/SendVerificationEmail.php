<?php

namespace App\Actions;

use App\Mail\VerifyEmailMail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

use function Illuminate\Support\defer;

class SendVerificationEmail
{
    /**
     * Build a signed verification link and email it to the user — deferred
     * (after the response) and fault-tolerant so it never breaks the request.
     */
    public function __invoke(User $user): void
    {
        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addHours(48),
            [
                'id' => $user->getKey(),
                'hash' => sha1($user->getEmailForVerification()),
            ],
        );

        defer(function () use ($user, $verificationUrl) {
            try {
                Mail::to($user->email, $user->name)
                    ->send(new VerifyEmailMail($user, $verificationUrl));
            } catch (\Throwable $e) {
                Log::warning('Verification email failed to send.', [
                    'email' => $user->email,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }
}
