import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { FcmService } from '../../../core/services/fcm.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[#0f172a] p-6 font-['Outfit'] relative overflow-hidden">
      <!-- Decorative Background Elements -->
      <div class="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
      <div class="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full -translate-x-1/2 translate-y-1/2"></div>

      <div class="w-full max-w-[460px] relative z-10">
        <!-- Logo/Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/20 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="text-3xl font-bold tracking-tight text-white mb-2">RecrutiTN</div>
          <div class="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 inline-block text-blue-400 text-[10px] uppercase tracking-[0.2em] font-black">
            System Administration
          </div>
        </div>

        <!-- Login Card -->
        <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-10 shadow-2xl">
          <h2 class="text-xl font-bold text-white mb-8 text-center">Identity Verification</h2>
          
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-6">
            <div class="space-y-2">
              <label for="email" class="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Admin Identifier</label>
              <div class="relative">
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  placeholder="admin@recrutitn.tn"
                  class="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-12 text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/10"
                  [class.border-red-500/50]="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
                />
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <label for="password" class="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Security Key</label>
              <div class="relative">
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="••••••••••••"
                  class="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-12 text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/10"
                  [class.border-red-500/50]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
                />
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  <svg *ngIf="!showPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg *ngIf="showPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                </button>
              </div>
            </div>

            @if (errorMessage()) {
              <div class="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-3 animate-in fade-in zoom-in-95">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <button
              type="submit"
              class="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-3 relative overflow-hidden group disabled:opacity-50"
              [disabled]="loginForm.invalid || isLoading()"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
              <span *ngIf="isLoading()" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin z-10"></span>
              <span class="z-10">{{ isLoading() ? 'Decrypting...' : 'Authorize Access' }}</span>
            </button>
          </form>
        </div>

        <div class="mt-8 text-center">
          <p class="text-slate-500 text-xs">Security protected by RecrutiTN Guard™</p>
          <div class="mt-4 flex justify-center gap-6">
            <a routerLink="/" class="text-slate-400 hover:text-white text-xs transition-colors cursor-pointer">System Status</a>
            <a routerLink="/" class="text-slate-400 hover:text-white text-xs transition-colors cursor-pointer">Back to Gateway</a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminLoginComponent {
  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)])
  });

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);

  constructor(
    private authService: AuthService,
    private fcm: FcmService,
    private router: Router
  ) { }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.value;

    this.authService.login(email!, password!).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success) {
          setTimeout(() => this.fcm.initialize(), 3000);
          if (this.authService.hasRole('ADMIN')) {
            this.router.navigate(['/admin/dashboard']);
          } else {
            this.errorMessage.set('This account cannot access the admin portal.');
            this.authService.logout();
          }
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        const message = error.error?.message || 'Login failed. Please check your credentials.';
        this.errorMessage.set(message);
      }
    });
  }
}
