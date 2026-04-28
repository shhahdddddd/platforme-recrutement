import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class TokenService {
    private readonly TOKEN_KEY = 'admin_auth_token';
    private readonly REFRESH_TOKEN_KEY = 'admin_refresh_token';
    private readonly USER_KEY = 'admin_user_data';
    // STAFF FIX: Key is now read from environment.ts (not hardcoded in source).
    // Set TOKEN_ENCRYPTION_KEY in environment.ts and environment.prod.ts.
    private readonly ENCRYPTION_KEY = environment.tokenEncryptionKey;

    private get storage(): Storage {
        return sessionStorage;
    }

    private encrypt(data: string): string {
        return CryptoJS.AES.encrypt(data, this.ENCRYPTION_KEY).toString();
    }

    private decrypt(data: string): string {
        try {
            const bytes = CryptoJS.AES.decrypt(data, this.ENCRYPTION_KEY);
            const decoded = bytes.toString(CryptoJS.enc.Utf8);
            if (!decoded) {
                return data;
            }
            return decoded;
        } catch {
            return data;
        }
    }

    setToken(token: string): void {
        const encryptedToken = this.encrypt(token);
        this.storage.setItem(this.TOKEN_KEY, encryptedToken);
    }

    getToken(): string | null {
        try {
            const encryptedToken = this.storage.getItem(this.TOKEN_KEY);
            if (!encryptedToken) return null;
            return this.decrypt(encryptedToken);
        } catch {
            const raw = this.storage.getItem(this.TOKEN_KEY);
            return raw || null;
        }
    }

    setRefreshToken(token: string): void {
        const encryptedToken = this.encrypt(token);
        this.storage.setItem(this.REFRESH_TOKEN_KEY, encryptedToken);
    }

    getRefreshToken(): string | null {
        try {
            const encryptedToken = this.storage.getItem(this.REFRESH_TOKEN_KEY);
            if (!encryptedToken) return null;
            return this.decrypt(encryptedToken);
        } catch {
            const raw = this.storage.getItem(this.REFRESH_TOKEN_KEY);
            return raw || null;
        }
    }

    removeToken(): void {
        this.storage.removeItem(this.TOKEN_KEY);
        this.storage.removeItem(this.REFRESH_TOKEN_KEY);
        this.storage.removeItem(this.USER_KEY);

        // Clear legacy persistent auth that may still exist from older builds.
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    }

    setUserData(user: any): void {
        const encryptedUser = this.encrypt(JSON.stringify(user));
        this.storage.setItem(this.USER_KEY, encryptedUser);
    }

    getUserData(): any | null {
        try {
            const encryptedUser = this.storage.getItem(this.USER_KEY);
            if (!encryptedUser) {
                console.log('TokenService - No user data found in sessionStorage');
                return null;
            }
            const decryptedUser = this.decrypt(encryptedUser);
            const userData = decryptedUser ? JSON.parse(decryptedUser) : null;
            return userData;
        } catch (e) {
            console.error('TokenService - Error retrieving user data:', e);
            return null;
        }
    }

    hasToken(): boolean {
        const token = this.getToken();
        const hasToken = token !== null && token !== '';
        console.log('TokenService - hasToken:', hasToken);
        return hasToken;
    }
}
