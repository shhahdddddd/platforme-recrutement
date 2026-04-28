import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { TokenService } from '../services/token.service';
import { environment } from '../../../environments/environment';

let isRefreshing = false;
let isRedirecting = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const tokenService = inject(TokenService);
    const router = inject(Router);
    const http = inject(HttpClient);
    const token = tokenService.getToken();

    // Clone request and add authorization header if token exists
    let authReq = req;
    if (token) {
        authReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
    }

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            const isLoginRequest = req.url.includes('/auth/login');
            const isRefreshRequest = req.url.includes('/auth/refresh');
            const isLogoutRequest = req.url.includes('/auth/logout');
            const isAuthEndpoint = isLoginRequest || isRefreshRequest || isLogoutRequest;
            const refreshToken = tokenService.getRefreshToken();

            if (error.status === 401 && !isAuthEndpoint && refreshToken) {
                if (isRefreshing) {
                    return refreshTokenSubject.pipe(
                        filter((newToken): newToken is string => !!newToken),
                        take(1),
                        switchMap((newToken: string) => next(req.clone({
                            setHeaders: { Authorization: `Bearer ${newToken}` }
                        })))
                    );
                }

                isRefreshing = true;
                refreshTokenSubject.next(null);

                const role = String(tokenService.getUserData()?.role || '').toLowerCase();
                const refreshEndpoint = role === 'admin' || role === 'superadmin'
                    ? 'admin/auth/refresh'
                    : 'auth/refresh';

                return http.post<any>(`${environment.apiUrl}/${refreshEndpoint}`, { refresh_token: refreshToken }).pipe(
                    switchMap((res) => {
                        isRefreshing = false;
                        // Handle both admin (token) and user (access_token) response formats
                        const newAccessToken = res?.data?.access_token || res?.data?.token || res?.access_token || res?.token;
                        const newRefreshToken = res?.data?.refresh_token || res?.refresh_token;

                        if (!newAccessToken) {
                            tokenService.removeToken();
                            redirectToLogin(router);
                            return throwError(() => error);
                        }

                        tokenService.setToken(newAccessToken);
                        if (newRefreshToken) {
                            tokenService.setRefreshToken(newRefreshToken);
                        }

                        refreshTokenSubject.next(newAccessToken);
                        return next(req.clone({
                            setHeaders: { Authorization: `Bearer ${newAccessToken}` }
                        }));
                    }),
                    catchError((refreshError) => {
                        isRefreshing = false;
                        tokenService.removeToken();
                        redirectToLogin(router);
                        return throwError(() => refreshError);
                    })
                );
            }

            if (error.status === 401 && isLogoutRequest) {
                // Ignore logout 401s (stale/expired token) and let caller finish cleanup.
                tokenService.removeToken();
                return throwError(() => error);
            }

            if (error.status === 401 && !isLoginRequest) {
                tokenService.removeToken();
                redirectToLogin(router);
            }

            return throwError(() => error);
        })
    );
};

/**
 * Safely redirect to login page, preventing duplicate redirects
 * and the malformed https:/https:// URL issue.
 */
function redirectToLogin(router: Router): void {
    if (isRedirecting) return;
    isRedirecting = true;
    // Use navigate instead of navigateByUrl to prevent URL malformation
    router.navigate(['/auth', 'login']).finally(() => {
        // Reset the flag after a short delay to allow future redirects
        setTimeout(() => { isRedirecting = false; }, 1000);
    });
}
