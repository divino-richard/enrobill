<?php

namespace App\Http\Controllers;

use App\Http\Resources\StudentResource;
use Illuminate\Http\Request;

class StudentProfileController extends Controller
{
    /**
     * The authenticated user's own student record. 404 if they aren't a student
     * yet (e.g. still an applicant).
     */
    public function show(Request $request): StudentResource
    {
        $student = $request->user()->student;

        abort_if($student === null, 404, 'No student record found.');

        return new StudentResource($student);
    }
}
