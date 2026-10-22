<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminReferralResource;
use App\Models\Referral;
use App\Services\ReferralPeriod;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReferralController extends Controller
{
    /** Paginated referral attribution and lifecycle audit for administrators. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'schoolYearId' => ['nullable', 'integer', 'exists:school_years,id'],
            'status' => ['nullable', 'string', 'in:'.implode(',', [...Referral::STATUSES, 'expired'])],
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
                'referredEnrollment',
                'incentiveAwards',
            ])
            ->when(
                isset($validated['schoolYearId']),
                fn ($query) => $query->where('school_year_id', $validated['schoolYearId']),
            )
            ->when(
                isset($validated['status']),
                function ($query) use ($validated) {
                    $expiredYear = fn ($q) => $q->where('type', 'referral')->whereDate('ends_on', '<', now(ReferralPeriod::TIMEZONE)->toDateString());
                    if ($validated['status'] === 'expired') {
                        $query->whereIn('status', [Referral::STATUS_CLAIMED, Referral::STATUS_ACCEPTED])
                            ->whereHas('targetSchoolYear.freebies', $expiredYear);
                    } else {
                        $query->where('status', $validated['status']);
                        if (in_array($validated['status'], [Referral::STATUS_CLAIMED, Referral::STATUS_ACCEPTED], true)) {
                            $query->whereDoesntHave('targetSchoolYear.freebies', $expiredYear);
                        }
                    }
                },
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
