<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ApplicationController extends Controller
{
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
}
