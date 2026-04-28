<?php

namespace App\Http\Middleware;

use App\Services\KeycloakService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class KeycloakAuthenticate
{
    public function __construct(
        private readonly KeycloakService $keycloakService
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'No token provided',
            ], 401);
        }

        $tokenPayload = $this->keycloakService->validateAccessToken($token);
        if (!$tokenPayload) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid token',
            ], 401);
        }

        $user = $this->keycloakService->resolveUserFromTokenPayload($tokenPayload);
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $request->attributes->set('keycloak_access_token', $token);
        $request->attributes->set('keycloak_token_payload', $tokenPayload);
        $request->setUserResolver(static fn() => $user);

        Auth::shouldUse('web');
        Auth::setUser($user);

        return $next($request);
    }
}
