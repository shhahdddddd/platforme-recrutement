import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
//the api service is the one who talk to the backend and have the basic url method 
@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private readonly baseUrl = environment.apiUrl;
    private http = inject(HttpClient);
    private tokenService = inject(TokenService);
    private readonly unauthenticatedAuthEndpoints = new Set([
        'auth/login',
        'auth/refresh',
        'admin/auth/login',
        'admin/auth/refresh'
    ]);

    private shouldAttachAuth(endpoint: string, includeAuth: boolean): boolean {
        if (!includeAuth) {
            return false;
        }

        const normalizedEndpoint = endpoint.replace(/^\/+/, '').toLowerCase();
        return !this.unauthenticatedAuthEndpoints.has(normalizedEndpoint);
    }

    private getHeaders(includeAuth: boolean = true): HttpHeaders {
        let headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        });

        if (includeAuth && this.tokenService.hasToken()) {
            const token = this.tokenService.getToken();
            if (token) {
                headers = headers.set('Authorization', `Bearer ${token}`);
            }
        }

        return headers;
    }

    get<T>(endpoint: string, includeAuth: boolean = true): Observable<T> {
        return this.http.get<T>(`${this.baseUrl}/${endpoint}`, {
            headers: this.getHeaders(this.shouldAttachAuth(endpoint, includeAuth))
        });
    }

    getBlob(endpoint: string, includeAuth: boolean = true): Observable<Blob> {
        const headers = this.getHeaders(this.shouldAttachAuth(endpoint, includeAuth))
            .delete('Content-Type')
            .set('Accept', 'application/pdf, application/octet-stream');

        return this.http.get(`${this.baseUrl}/${endpoint}`, {
            headers,
            responseType: 'blob'
        });
    }

    post<T>(endpoint: string, data: any, includeAuth: boolean = true): Observable<T> {
        let headers = this.getHeaders(this.shouldAttachAuth(endpoint, includeAuth));
        if (data instanceof FormData) {
            headers = headers.delete('Content-Type');
        }
        return this.http.post<T>(`${this.baseUrl}/${endpoint}`, data, {
            headers
        });
    }

    put<T>(endpoint: string, data: any, includeAuth: boolean = true): Observable<T> {
        let headers = this.getHeaders(this.shouldAttachAuth(endpoint, includeAuth));
        if (data instanceof FormData) {
            headers = headers.delete('Content-Type');
        }
        return this.http.put<T>(`${this.baseUrl}/${endpoint}`, data, {
            headers
        });
    }

    patch<T>(endpoint: string, data: any, includeAuth: boolean = true): Observable<T> {
        let headers = this.getHeaders(this.shouldAttachAuth(endpoint, includeAuth));
        if (data instanceof FormData) {
            headers = headers.delete('Content-Type');
        }
        return this.http.patch<T>(`${this.baseUrl}/${endpoint}`, data, {
            headers
        });
    }

    delete<T>(endpoint: string, includeAuth: boolean = true): Observable<T> {
        return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, {
            headers: this.getHeaders(this.shouldAttachAuth(endpoint, includeAuth))
        });
    }
}
