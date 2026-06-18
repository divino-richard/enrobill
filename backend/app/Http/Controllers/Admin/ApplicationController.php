<?php

namespace App\Http\Controllers\Admin;

use App\Actions\PromoteApplicantToStudent;
use App\Actions\SendApplicationDecisionEmail;
use App\Http\Controllers\Controller;
use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class ApplicationController extends Controller
{
    /**
     * Statuses an admin may still accept or reject from.
     */
    private const DECIDABLE_STATUSES = ['submitted', 'under_review', 'returned'];

    /**
     * Every status an application may hold (for filtering).
     */
    private const STATUSES = ['draft', 'submitted', 'under_review', 'returned', 'accepted', 'rejected'];

    /**
     * Sortable columns, mapped from API key to database column (allow-list).
     */
    private const SORTABLE = [
        'reference' => 'reference',
        'schoolYear' => 'school_year',
        'status' => 'status',
        'submittedAt' => 'submitted_at',
    ];

    /**
     * Paginated, searchable, filterable, sortable list of all applications.
     * Restricted to admins by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $sort = self::SORTABLE[$request->string('sort')->value()] ?? 'created_at';
        $direction = $request->string('dir')->lower()->value() === 'asc' ? 'asc' : 'desc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);

        $applications = Application::query()
            ->with('user')
            ->when(
                in_array($request->string('status')->value(), self::STATUSES, true),
                fn ($query) => $query->where('status', $request->string('status')->value()),
            )
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search')->value().'%';
                $query->where(function ($sub) use ($term) {
                    $sub->where('reference', 'like', $term)
                        ->orWhere('surname', 'like', $term)
                        ->orWhere('given_name', 'like', $term)
                        ->orWhere('email_address', 'like', $term)
                        ->orWhereHas('user', function ($user) use ($term) {
                            $user->where('name', 'like', $term)
                                ->orWhere('email', 'like', $term);
                        });
                });
            })
            ->orderBy($sort, $direction)
            ->orderBy('id', $direction)
            ->paginate($perPage)
            ->withQueryString();

        return ApplicationResource::collection($applications);
    }

    /**
     * A single application (admin can view any). Restricted to admins by route
     * middleware.
     */
    public function show(Application $application): ApplicationResource
    {
        return new ApplicationResource($application->load(['user', 'documents']));
    }

    /**
     * Accept an application and notify the applicant.
     */
    public function accept(Application $application, SendApplicationDecisionEmail $sendEmail): ApplicationResource
    {
        return $this->decide($application, 'accepted', $sendEmail);
    }

    /**
     * Reject an application and notify the applicant.
     */
    public function reject(Application $application, SendApplicationDecisionEmail $sendEmail): ApplicationResource
    {
        return $this->decide($application, 'rejected', $sendEmail);
    }

    /**
     * Move an application to a final decision and email the outcome.
     *
     * @param  'accepted'|'rejected'  $status
     */
    private function decide(Application $application, string $status, SendApplicationDecisionEmail $sendEmail): ApplicationResource
    {
        abort_unless(
            in_array($application->status, self::DECIDABLE_STATUSES, true),
            422,
            'This application has already been decided and cannot be changed.',
        );

        DB::transaction(function () use ($application, $status) {
            $application->update(['status' => $status]);

            // Once accepted, promote the applicant to a student (role flip +
            // canonical student record). Their existing token stays valid — the
            // role is read live from the database on every request.
            if ($status === 'accepted') {
                app(PromoteApplicantToStudent::class)($application);
            }
        });

        $application->load('user');
        $sendEmail($application, $status);

        return new ApplicationResource($application->load(['user', 'documents']));
    }
}
