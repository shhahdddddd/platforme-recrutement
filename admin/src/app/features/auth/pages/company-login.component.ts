import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { FcmService } from '../../../core/services/fcm.service';

@Component({
  selector: 'app-company-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="min-h-screen flex bg-slate-50 font-['Outfit'] overflow-hidden">
      <!-- Left Branding/Visual side -->
      <div class="hidden lg:flex w-5/12 relative bg-blue-600 items-center justify-center p-16">
        <!-- Abstract Background Pattern -->
        <div class="absolute inset-0 z-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-pulse"></div>
        <div class="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-700 to-indigo-800 z-10"></div>
        
        <div class="relative z-20 text-white max-w-sm text-center">
          <div class="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/></svg>
          </div>
          <h2 class="text-4xl font-black mb-6 tracking-tight">RecrutiTN <span class="text-blue-200">Enterprise</span></h2>
          <p class="text-blue-100/80 text-lg leading-relaxed mb-10 font-medium">
            Join the elite network of companies hiring top-tier talent in Tunisia.
          </p>
          
          <div class="space-y-4">
            <div class="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm text-left">
              <div class="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-300"><path d="M12 2v20M2 12h20"/></svg>
              </div>
              <div>
                <div class="font-bold text-sm">Targeted Reach</div>
                <div class="text-xs text-blue-200/70">Connect with specific talent pools</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Subtle branding footer -->
        <div class="absolute bottom-10 left-0 w-full text-center z-20">
          <p class="text-blue-200/40 text-[10px] uppercase tracking-[0.3em] font-black">Trusted by 200+ Enterprises</p>
        </div>
      </div>

      <!-- Right Form side -->
      <div class="w-full lg:w-7/12 flex items-center justify-center p-6 md:p-12 relative">
        <div class="w-full max-w-[440px]">
          <!-- Mobile Branding -->
          <div class="lg:hidden text-center mb-10">
            <div class="text-4xl font-black text-blue-600 italic tracking-tighter mb-2">RecrutiTN</div>
            <div class="text-xs font-bold uppercase tracking-widest text-slate-400">Company Portal</div>
          </div>

          <div class="mb-12 text-center">
            <h1 class="text-3xl font-black text-slate-900 mb-2">Welcome Back</h1>
            <p class="text-slate-500 font-medium">Sign in to your corporate dashboard</p>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-6">
            <div class="space-y-2">
              <label for="email" class="block text-sm font-bold text-slate-700 ml-1">Work Email</label>
              <div class="relative group">
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  placeholder="hr@enterprise.tn"
                  class="w-full h-14 px-12 bg-white border-2 border-slate-100 rounded-2xl text-slate-900 transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 group-hover:border-slate-200 shadow-sm"
                  [class.border-red-500]="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
                />
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex justify-between items-center px-1">
                <label for="password" class="text-sm font-bold text-slate-700">Password</label>
                <a class="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer">Forgot?</a>
              </div>
              <div class="relative group">
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="••••••••••••"
                  class="w-full h-14 px-12 bg-white border-2 border-slate-100 rounded-2xl text-slate-900 transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 group-hover:border-slate-200 shadow-sm"
                  [class.border-red-500]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
                />
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                >
                  @if (showPassword()) {
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.133 12.852c.307.201.624.398.948.59l1.63 1.05a3 3 0 0 0 3.23.003l1.848-1.155a3 3 0 0 1 3.167 0l1.848 1.155a3 3 0 0 0 3.167 0l1.848-1.155a3 3 0 0 1 3.167 0l.965.603"/><path d="M12 21c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9-4.03 9-9 9z"/></svg>
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            @if (errorMessage()) {
              <div class="p-4 rounded-2xl bg-red-50 border border-red-100 flex gap-3 text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <button
              type="submit"
              class="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
              [disabled]="loginForm.invalid || isLoading()"
            >
              @if (isLoading()) {
                <span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Verifying...
              } @else {
                Access Dashboard
              }
            </button>
          </form>
          
          <div class="mt-10 text-center">
            <p class="text-slate-500 text-sm">Don't have an enterprise account?</p>
            <a class="mt-2 inline-block font-black text-blue-600 text-sm uppercase tracking-widest hover:text-blue-700 cursor-pointer">Register Your Company</a>
          </div>

          <!-- Bottom Links -->
          <div class="mt-16 flex justify-center gap-8 border-t border-slate-100 pt-8">
            <a routerLink="/company" class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Website</a>
            <a routerLink="/auth" class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Admin Gateway</a>
            <a class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Support</a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CompanyLoginComponent {
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

    const email = this.loginForm.get('email')?.value?.trim().toLowerCase();
    const password = this.loginForm.get('password')?.value ?? '';

    console.log('🚀 Login attempt:', { email });

    this.authService.userLogin(email!, password!).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success) {
          setTimeout(() => this.fcm.initialize(), 3000);
          if (this.authService.hasRole('COMPANY')) {
            this.router.navigate(['/company/dashboard']);
          } else if (this.authService.hasRole('RECRUITER')) {
            this.router.navigate(['/recruiter/dashboard']);
          } else {
            this.errorMessage.set('This account cannot access the company portal. Please use the correct portal for your role.');
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
