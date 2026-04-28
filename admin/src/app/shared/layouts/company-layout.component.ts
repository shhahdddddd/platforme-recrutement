import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { RealtimeUpdatesService } from '../../core/services/realtime-updates.service';
import { FcmService } from '../../core/services/fcm.service';

@Component({
  selector: 'app-company-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="min-h-screen bg-slate-50 font-['Outfit']">
      <!-- Top Horizontal Navbar -->
      <nav class="sticky top-0 w-full z-50 bg-white border-b border-slate-200 shadow-sm px-8 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3 lg:gap-4">
          <div class="text-2xl font-bold tracking-tight text-slate-800">
            Recruti<span class="text-blue-600">TN</span>
          </div>
          
          <div class="hidden md:flex items-center gap-1 flex-wrap">
            <a routerLink="/company" routerLinkActive="bg-blue-50 text-blue-600" [routerLinkActiveOptions]="{exact: true}" title="Overview" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span class="hidden 2xl:inline">Overview</span>
            </a>

            <ng-container *ngIf="canAccessCompanyArea()">
                <a *ngIf="canManageCompany()" routerLink="/company/dashboard" routerLinkActive="bg-blue-50 text-blue-600" title="Dashboard" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                  <span class="hidden 2xl:inline">Dashboard</span>
                </a>
                <a *ngIf="canManageCompany()" routerLink="/company/post-job" routerLinkActive="bg-blue-50 text-blue-600" title="Post Job" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2 whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  <span class="hidden 2xl:inline">Post Job</span>
                </a>
                <a *ngIf="canManageCompany()" routerLink="/company/interviews" routerLinkActive="bg-blue-50 text-blue-600" title="Interviews" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2 whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V3"/><path d="M16 7V3"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 11h18"/><path d="m9 16 2 2 4-4"/></svg>
                  <span class="hidden 2xl:inline">Interviews</span>
                </a>
                <a *ngIf="canManageCompany()" routerLink="/company/candidates" routerLinkActive="bg-blue-50 text-blue-600" title="Candidates" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M17 11h4"/><path d="M19 9v4"/></svg>
                  <span class="hidden 2xl:inline">Candidates</span>
                </a>
                <a *ngIf="canManageCompany()" routerLink="/company/recruiters" routerLinkActive="bg-blue-50 text-blue-600" title="Recruiters" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span class="hidden 2xl:inline">Recruiters</span>
                </a>
                <a *ngIf="canManageDepartments()" routerLink="/company/departments" routerLinkActive="bg-blue-50 text-blue-600" title="Departments" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2 relative group">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18"></path><path d="M3 12h18"></path><path d="M3 17h12"></path></svg>
                  <span class="hidden 2xl:inline">Departments</span>
                  <!-- Restriction Badge for Startups -->
                  <div *ngIf="resolvedCompanyType() === 'startup'" class="absolute -top-1 -right-1 flex items-center justify-center">
                    <div class="w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow-sm" title="Restricted for Startup"></div>
                  </div>
                </a>
                <a *ngIf="canManageCompany()" routerLink="/company/profile" routerLinkActive="bg-blue-50 text-blue-600" title="Profile" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  <span class="hidden 2xl:inline">Profile</span>
                </a>
                <a *ngIf="canManageCompany()" routerLink="/company/knowledge-base" routerLinkActive="bg-blue-50 text-blue-600" title="Knowledge Base" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  <span class="hidden 2xl:inline">Knowledge Base</span>
                </a>
                <a *ngIf="canManageCompany()" routerLink="/company/contact" routerLinkActive="bg-blue-50 text-blue-600" title="Help & Contact" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2 whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  <span class="hidden 2xl:inline">Help & Contact</span>
                </a>
                <a routerLink="/company/pricing" routerLinkActive="bg-blue-50 text-blue-600" title="Pricing" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path></svg>
                  <span class="hidden 2xl:inline">Pricing</span>
                </a>
            </ng-container>
            <ng-container *ngIf="!canAccessCompanyArea()">
              <a routerLink="/company/contact" routerLinkActive="bg-blue-50 text-blue-600" title="Help & Contact" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2 whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span class="hidden 2xl:inline">Help & Contact</span>
              </a>
              <a routerLink="/company/pricing" routerLinkActive="bg-blue-50 text-blue-600" title="Pricing" class="px-2 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path></svg>
                <span class="hidden 2xl:inline">Pricing</span>
              </a>
            </ng-container>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- Unauthenticated: Show Login only -->
          <div *ngIf="!canAccessCompanyArea()" class="flex items-center gap-3">
            <a routerLink="/auth/login" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold transition-all shadow-lg shadow-blue-500/25">Log in</a>
          </div>

          <!-- Authenticated: Show Profile & Logout -->
          <div *ngIf="canAccessCompanyArea()" class="flex items-center gap-2 pl-4 border-l border-slate-200">
            <a
              routerLink="/company/notifications"
              routerLinkActive="bg-blue-50 text-blue-600"
              class="relative p-2 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Notifications"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span
                *ngIf="notificationCount() > 0"
                class="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center"
              >
                {{ notificationCountLabel() }}
              </span>
            </a>
            <div class="text-right hidden xl:block">
              <p class="text-[13px] font-bold text-slate-800 leading-none">{{ accountLabel() }}</p>
              <p class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">{{ accountSubLabel() }}</p>
            </div>
            <button (click)="logout()" class="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Logout">
              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </nav>

      <!-- Notification Permission Banner -->
      <div *ngIf="showNotificationBanner()" class="max-w-[1400px] mx-auto mt-4 px-8">
        <div class="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div>
              <p class="font-bold text-slate-800">Enable Notifications</p>
              <p class="text-sm text-slate-500">Get notified when candidates apply to your job offers</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button (click)="requestNotificationPermission()" class="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-colors">
              Enable
            </button>
            <button (click)="dismissNotificationBanner()" class="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <main class="max-w-[1400px] mx-auto p-8">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styleUrl: '../../app.css'

})
export class CompanyLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private realtimeUpdates = inject(RealtimeUpdatesService);
  private fcm = inject(FcmService);

  protected resolvedCompanyType = signal<'company' | 'startup' | ''>('');
  protected notificationPermissionDismissed = signal(false);
  notificationCount = computed(() => this.realtimeUpdates.notificationUnreadCount());

  showNotificationBanner = computed(() => {
    return this.canAccessCompanyArea() &&
           !this.notificationPermissionDismissed() &&
           this.fcm.getPermissionState() === 'default';
  });

  canAccessCompanyArea = computed(() =>
    this.authService.isAuthenticated() &&
    this.authService.hasRole('COMPANY')
  );
  canManageCompany = computed(() => this.authService.isAuthenticated() && this.authService.hasRole('COMPANY'));
  currentUser = computed(() => this.authService.getCurrentUser() as any);
  canManageDepartments = computed(() =>
    this.canManageCompany() &&
    (this.resolvedCompanyType() === 'company' || this.resolvedCompanyType() === 'startup')
  );

  ngOnInit(): void {
    this.hydrateCompanyTypeFromCurrentUser();

    if (!this.resolvedCompanyType() && this.canManageCompany()) {
      this.apiService.get<any>('company/profile').subscribe({
        next: (res) => {
          const companyType = String(res?.data?.company_type || '').toLowerCase();
          if (companyType === 'company' || companyType === 'startup') {
            this.resolvedCompanyType.set(companyType);
          }
        }
      });
    }

    if (this.canAccessCompanyArea()) {
      this.realtimeUpdates.ensureStarted();
    }
  }

  private hydrateCompanyTypeFromCurrentUser(): void {
    const profile = this.currentUser()?.profile;
    const companyType = String(profile?.company_type || profile?.company?.company_type || '').toLowerCase();
    if (companyType === 'company' || companyType === 'startup') {
      this.resolvedCompanyType.set(companyType);
    }
  }

  logout(): void {
    this.authService.logout();
  }

  requestNotificationPermission(): void {
    this.fcm.requestPermission();
  }

  dismissNotificationBanner(): void {
    this.notificationPermissionDismissed.set(true);
  }

  notificationCountLabel(): string {
    const count = this.notificationCount();
    return count > 99 ? '99+' : String(count);
  }

  accountLabel(): string {
    return this.currentUser()?.profile?.full_name || 'HR Manager';
  }

  accountSubLabel(): string {
    return 'Company Account';
  }

}
