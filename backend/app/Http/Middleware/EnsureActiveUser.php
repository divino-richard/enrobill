<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()->is_active) {
            return response()->json([
                'message' => 'Your account has been deactivated. Contact the school administrator for assistance.',
                'code' => 'account_deactivated',
            ], 403);
        }

        return $next($request);
    }
}
