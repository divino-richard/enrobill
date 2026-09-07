<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminReferralResource;
use App\Models\Referral;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReferralController extends Controller
{
    /** Paginated referral attribution and lifecycle audit for administrators. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'schoolYearId' => ['nullable', 'integer', 'exists:school_years,id'],
            'status' => ['nullable', 'string', 'in:'.implode(',', Referral::STATUSES)],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $perPage = (int) ($validated['per_page'] ?? 15);

        $referrals = Referral::query()
            ->with([
                'targetSchoolYear',
                'referralCode',
                'referrerStudent',
                'referredApplication',
                'referredStudent',
                'claimant',
                'updater',
                'accepter',
                'canceller',
            ])
            ->when(
                isset($validated['schoolYearId']),
                fn ($query) => $query->where('school_year_id', $validated['schoolYearId']),
            )
            ->when(
                isset($validated['status']),
                fn ($query) => $query->where('status', $validated['status']),
            )
            ->when(isset($validated['search']), function ($query) use ($validated) {
                $needle = '%'.trim($validated['search']).'%';
                $query->where(function ($nested) use ($needle) {
                    $nested->whereHas('referralCode', fn ($code) => $code->where('code', 'like', $needle))
                        ->orWhereHas('referrerStudent', function ($student) use ($needle) {
                            $student->where('first_name', 'like', $needle)
                                ->orWhere('last_name', 'like', $needle)
                                ->orWhere('student_number', 'like', $needle);
                        })
                        ->orWhereHas('referredApplication', function ($application) use ($needle) {
                            $application->where('given_name', 'like', $needle)
                                ->orWhere('surname', 'like', $needle)
                                ->orWhere('reference', 'like', $needle);
                        })
                        ->orWhereHas('referredStudent', function ($student) use ($needle) {
                            $student->where('first_name', 'like', $needle)
                                ->orWhere('last_name', 'like', $needle)
                                ->orWhere('student_number', 'like', $needle);
                        });
                });
            })
            ->orderByDesc('claimed_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return AdminReferralResource::collection($referrals);
    }
}
