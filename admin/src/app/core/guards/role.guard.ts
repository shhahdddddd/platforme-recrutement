import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard to check if a user has the required role(s).
 * Strictly enforces roles. If an Admin tries to access a restricted section (like Company),
 * they are redirected back to their Admin Dashboard instead of an unauthorized page.
 */
export const roleGuard = (allowedRoles: string | string[]): CanActivateFn => {
    return () => {
        const authService = inject(AuthService);
        const router = inject(Router);

        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        const userRole = authService.getRole();

        // 1. Check if the user has any of the specific allowed roles
        if (roles.some(role => authService.hasRole(role))) {
            return true;
        }

        // 2. If user is an ADMIN trying to access something else (like Company Dashboard)
        // Redirect them back to their own dashboard
        if (userRole === 'ADMIN' || userRole?.toLowerCase() === 'admin') {
            console.warn(`Admin tried to access a restricted route. Redirecting to Admin Dashboard.`);
            router.navigate(['/admin/dashboard']);
            return false;
        }

        // 3. Redirect non-admin users to their valid area instead of a dead-end route
        if (authService.hasRole('RECRUITER')) {
            router.navigate(['/recruiter/dashboard']);
            return false;
        }

        if (authService.hasRole('COMPANY')) {
            router.navigate(['/company/dashboard']);
            return false;
        }

        // 4. Fallback for unknown roles/sessions
        console.warn(`Access denied: Required roles one of ${roles.join(', ')}`);
        router.navigate(['/auth/login']);
        return false;
    };
};
