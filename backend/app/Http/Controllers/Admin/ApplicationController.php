<?php

namespace App\Http\Controllers\Admin;

use App\Actions\SendApplicationDecisionEmail;
use App\Http\Controllers\Controller;
use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ApplicationController extends Controller
{
    /**
     * Statuses an admin may still accept or reject from.
     */
    private const DECIDABLE_STATUSES = ['submitted', 'under_review', 'returned'];

    /**
     * All submitted applications across every applicant, newest first.
     * Restricted to admins by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $applications = Application::query()
            ->with('user')
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where('status', $request->string('status')),
            )
            ->latest()
            ->get();

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

        $application->update(['status' => $status]);
        $application->load('user');

        $sendEmail($application, $status);

        return new ApplicationResource($application->load(['user', 'documents']));
    }
}
