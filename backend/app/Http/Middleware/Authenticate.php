<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return string|null
     */
    protected function redirectTo($request): ?string
    {
        // API and JSON requests must never try to redirect to a web login route.
        // Returning null makes Laravel respond with 401 JSON instead.
        if ($request->is('api/*') || $request->expectsJson()) {
            return null;
        }

        if (\Illuminate\Support\Facades\Route::has('login')) {
            return route('login');
        }

        return null;
    }
}
