import { Injectable, signal, inject } from '@angular/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { UserRole, Admin, LoginResponse, AuthError } from '../models/user-role.model';
import { TokenService } from './token.service';
import { ApiService } from './api.service';
import { RealtimeUpdatesService } from './realtime-updates.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userRole = signal<UserRole | null>(null);
    private currentUser = signal<Admin | null>(null);

    private tokenService = inject(TokenService);
    private apiService = inject(ApiService);
    private router = inject(Router);
    private realtimeUpdates = inject(RealtimeUpdatesService);

    constructor() {
        this.initializeAuth();
    }

    /**
     * Initialize authentication from stored token
     */
    private initializeAuth(): void {
        const userData = this.tokenService.getUserData();
        const hasToken = this.tokenService.hasToken();
        if (userData && hasToken && !this.isTokenExpired()) {
            this.userRole.set(userData.role);
            this.currentUser.set(userData);
        } else if (hasToken && this.tokenService.getRefreshToken()) {
            // Token might be expired, but we have a refresh token.
            // Still hydrate the UI state so layout doesn't flicker or boot user.
            // The Interceptor will handle the refresh on the first API call.
            if (userData) {
                this.userRole.set(userData.role);
                this.currentUser.set(userData);
            }
        } else if (hasToken && this.isTokenExpired()) {
            // No refresh token and expired? Clean up.
            this.tokenService.removeToken();
        }
    }

    /**
     * Admin login
     */
    login(email: string, password: string): Observable<LoginResponse> {
        return this.apiService.post<LoginResponse>('admin/auth/login', { email, password }, false)
            .pipe(
                tap(response => {
                    if (response.success) {
                        this.tokenService.setToken(response.data.token);
                        if (response.data.refresh_token) {
                            this.tokenService.setRefreshToken(response.data.refresh_token);
                        }
                        this.tokenService.setUserData(response.data.admin);
                        this.userRole.set(response.data.admin.role);
                        this.currentUser.set(response.data.admin);
                    }
                }),
                catchError((error) => {
                    console.error('Login error:', error);
                    return throwError(() => error);
                })
            );
    }

    /**
     * Company/Candidate login
     */
    userLogin(email: string, password: string): Observable<any> {
        return this.apiService.post<any>('auth/login', { email, password }, false)
            .pipe(
                tap(response => {
                    if (response.success) {
                        this.tokenService.setToken(response.data.access_token);
                        this.tokenService.setRefreshToken(response.data.refresh_token);
                        this.tokenService.setUserData(response.data.user);
                        this.userRole.set(response.data.user.role);
                        this.currentUser.set(response.data.user);
                    }
                })
            );
    }

    /**
     * Get current authenticated user
     */
    me(): Observable<any> {
        return this.apiService.get('admin/auth/me')
            .pipe(
                tap((response: any) => {
                    if (response.success) {
                        this.tokenService.setUserData(response.data);
                        this.userRole.set(response.data.role);
                        this.currentUser.set(response.data);
                    }
                })
            );
    }

    /**
     * Logout
     */
    logout(): void {
        const role = this.userRole() ?? this.tokenService.getUserData()?.role ?? null;
        const refreshToken = this.tokenService.getRefreshToken();
        const hasToken = this.tokenService.hasToken();

        // If tokens are already missing/invalid locally, skip backend logout and clear state.
        if (!hasToken || !refreshToken) {
            this.handleLogoutRedirect(role);
            return;
        }

        const isAdmin = this.roleMatches(role, 'ADMIN');
        const logoutEndpoint = isAdmin ? 'admin/auth/logout' : 'auth/logout';

        this.apiService.post(logoutEndpoint, { refresh_token: refreshToken }, true).subscribe({
            next: () => {
                this.handleLogoutRedirect(role);
            },
            error: () => {
                this.handleLogoutRedirect(role);
            }
        });
    }

    private handleLogoutRedirect(role: UserRole | null) {
        this.clearAuth();
        if (role === 'ADMIN' || role?.toLowerCase() === 'admin') {
            this.router.navigate(['/auth']);
        } else if (
            this.roleMatches(role, 'COMPANY') ||
            this.roleMatches(role, 'RECRUITER') ||
            this.roleMatches(role, 'CANDIDATE')
        ) {
            this.router.navigate(['/auth/login']);
        } else {
            this.router.navigate(['/auth/login']);
        }
    }

    /**
     * Clear authentication data
     */
    private clearAuth(): void {
        this.realtimeUpdates.reset();
        this.tokenService.removeToken();
        this.userRole.set(null);
        this.currentUser.set(null);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        const hasToken = this.tokenService.hasToken();
        if (!hasToken) return false;

        const isExpired = this.isTokenExpired();
        const hasRefreshToken = !!this.tokenService.getRefreshToken();

        if (isExpired && !hasRefreshToken) {
            this.tokenService.removeToken();
            return false;
        }

        // Re-hydrate role from storage if signal got reset (e.g. hot-reload edge case)
        if (this.userRole() === null) {
            const userData = this.tokenService.getUserData();
            if (userData?.role) {
                this.userRole.set(userData.role);
                this.currentUser.set(userData);
            }
        }
        return this.userRole() !== null;
    }

    /**
     * Decode JWT and check if it is expired
     */
    private isTokenExpired(): boolean {
        try {
            const token = this.tokenService.getToken();
            if (!token) return true;
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (!payload?.exp) return false; // no expiry claim → treat as valid
            return Date.now() >= payload.exp * 1000;
        } catch {
            return true; // malformed token → treat as expired
        }
    }

    /**
     * Check if user has specific role
     */
    hasRole(role: UserRole | string): boolean {
        const currentRole = this.userRole();
        return this.roleMatches(currentRole, role);
    }

    /**
     * Get current user role
     */
    getRole(): UserRole | null {
        return this.userRole();
    }

    /**
     * Get current user data
     */
    getCurrentUser(): Admin | null {
        return this.currentUser();
    }

    /**
     * Get auth token
     */
    getToken(): string | null {
        return this.tokenService.getToken();
    }

    private roleMatches(currentRole: string | null, requiredRole: string): boolean {
        if (!currentRole) {
            return false;
        }

        const current = currentRole.toLowerCase();
        const required = requiredRole.toLowerCase();

        const aliases: Record<string, string[]> = {
            admin: ['admin', 'superadmin'],
            company: ['company', 'company_admin'],
            candidate: ['candidate', 'candidat'],
            recruiter: ['recruiter', 'recruteur'],
            recruteur: ['recruiter', 'recruteur']
        };

        const accepted = aliases[required] ?? [required];
        return accepted.includes(current);
    }
}
