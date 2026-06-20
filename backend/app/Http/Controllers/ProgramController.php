<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProgramResource;
use App\Models\Program;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProgramController extends Controller
{
    /**
     * The program catalog, for selection in forms and label resolution.
     * Available to any authenticated user (applicants choose their program
     * here). Inactive programs are returned too so historical codes still
     * resolve to a name; callers filter to active for selection.
     */
    public function index(): AnonymousResourceCollection
    {
        return ProgramResource::collection(Program::query()->ordered()->get());
    }
}
