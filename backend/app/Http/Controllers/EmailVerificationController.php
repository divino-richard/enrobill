<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    /**
     * Verify a user's email from a signed link, then redirect back to the SPA.
     * The route uses the "signed" middleware, so the URL signature is validated
     * before this runs.
     */
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::findOrFail($id);

        // The hash ties the link to the user's current email address.
        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            abort(403, 'Invalid or expired verification link.');
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        $frontend = rtrim((string) config('app.frontend_url'), '/');

        return redirect()->away("{$frontend}/login?verified=1");
    }
}
