<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckRole
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $role)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $userRole = strtolower((string) $user->role);
        $requiredRole = strtolower($role);

        $aliases = [
            'candidate' => ['candidate', 'candidat'],
            'company' => ['company', 'company_admin'],
            'company_admin' => ['company', 'company_admin'],
            'admin' => ['admin', 'superadmin'],
            'superadmin' => ['admin', 'superadmin'],
            'recruiter' => ['recruiter', 'recruteur'],
            'recruteur' => ['recruiter', 'recruteur'],
        ];

        $acceptedRoles = $aliases[$requiredRole] ?? [$requiredRole];

        if (!in_array($userRole, $acceptedRoles, true)) {
            return response()->json([
                'success' => false,
                'message' => "Access denied. Required role: {$role}."
            ], 403);
        }

        return $next($request);
    }
}
