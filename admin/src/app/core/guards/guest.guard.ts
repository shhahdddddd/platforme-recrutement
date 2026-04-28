import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guest Guard: Prevent authenticated users from accessing auth pages.
 * Redirect each authenticated role to its own section only.
 */
export const guestGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) {
        const role = authService.getRole();
        if (role === 'ADMIN' || role?.toLowerCase() === 'admin' || authService.hasRole('ADMIN')) {
            router.navigate(['/admin/dashboard']);
        } else if (authService.hasRole('RECRUITER')) {
            router.navigate(['/recruiter/dashboard']);
        } else if (authService.hasRole('COMPANY')) {
            router.navigate(['/company/dashboard']);
        } else {
            router.navigate(['/auth/login']);
        }
        return false;
    }

    return true;
};
