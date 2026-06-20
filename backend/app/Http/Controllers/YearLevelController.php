<?php

namespace App\Http\Controllers;

use App\Http\Resources\YearLevelResource;
use App\Models\YearLevel;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class YearLevelController extends Controller
{
    /**
     * The year level catalog, for selection in forms and label resolution.
     * Available to any authenticated user. Inactive levels are returned too so
     * historical codes still resolve; callers filter to active for selection.
     */
    public function index(): AnonymousResourceCollection
    {
        return YearLevelResource::collection(YearLevel::query()->ordered()->get());
    }
}
