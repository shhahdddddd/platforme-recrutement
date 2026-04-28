export type UserRole = 'ADMIN' | 'COMPANY' | 'CANDIDATE' | 'RECRUITER';

export interface User {
    id: number;
    email: string;
    role: UserRole;
    full_name: string;
    last_login?: string;
    created_at?: string;
}

export interface Admin extends User {
    role: 'ADMIN';
}

export interface LoginResponse {
    success: boolean;
    message: string;
    data: {
        token: string;
        refresh_token?: string;
        token_type: string;
        expires_in: number;
        admin: Admin;
    };
}

export interface AuthError {
    success: false;
    message: string;
    errors?: Record<string, string[]>;
}

