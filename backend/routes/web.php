<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| This application is API-only. The React (Vite) SPA is served separately,
| so the web root simply points clients at the API instead of rendering a
| Blade view.
|
*/

Route::get('/', function () {
    return response()->json([
        'service' => config('app.name'),
        'message' => 'API is running. See /api for endpoints.',
    ]);
});
