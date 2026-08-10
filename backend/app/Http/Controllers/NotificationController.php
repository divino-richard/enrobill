<?php

namespace App\Http\Controllers;

use App\Http\Resources\StudentNotificationResource;
use App\Models\Student;
use App\Models\StudentNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class NotificationController extends Controller
{
    /**
     * The authenticated student's own notifications, newest first.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $student = $this->ownStudentOrAbort($request);

        return StudentNotificationResource::collection(
            $student->notifications()->latest()->get(),
        );
    }

    /**
     * Mark a single notification read.
     */
    public function markRead(Request $request, StudentNotification $notification): StudentNotificationResource
    {
        $student = $this->ownStudentOrAbort($request);

        abort_if($notification->student_id !== $student->id, 404);

        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return new StudentNotificationResource($notification);
    }

    /**
     * Mark every unread notification read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $student = $this->ownStudentOrAbort($request);

        $student->notifications()->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    private function ownStudentOrAbort(Request $request): Student
    {
        $student = $request->user()->student;

        abort_if($student === null, 404, 'No student record found.');

        return $student;
    }
}
