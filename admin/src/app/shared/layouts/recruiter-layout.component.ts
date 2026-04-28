import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeUpdatesService } from '../../core/services/realtime-updates.service';
import { FcmService } from '../../core/services/fcm.service';

@Component({
  selector: 'app-recruiter-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="min-h-screen bg-slate-50 font-['Outfit']">
      <!-- Top Horizontal Navbar -->
      <nav class="sticky top-0 w-full z-50 bg-white border-b border-slate-200 shadow-sm px-8 py-3 flex items-center justify-between">
        <div class="flex items-center gap-5 lg:gap-6">
          <div class="text-2xl font-bold tracking-tight text-slate-800">
            Recruti<span class="text-blue-600">TN</span>
          </div>
          
          <div class="hidden md:flex items-center gap-4 flex-nowrap">
            <a routerLink="/recruiter/dashboard" routerLinkActive="bg-blue-50 text-blue-600" class="px-3 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
              Dashboard
            </a>

            <a routerLink="/recruiter/applicants" routerLinkActive="bg-blue-50 text-blue-600" [routerLinkActiveOptions]="{exact: true}" class="px-3 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Applicants
            </a>
            <a routerLink="/recruiter/intern-candidates" routerLinkActive="bg-blue-50 text-blue-600" class="px-3 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Candidates Internship
            </a>
            <a routerLink="/recruiter/interviews" routerLinkActive="bg-blue-50 text-blue-600" class="px-3 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V3"/><path d="M16 7V3"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 11h18"/><path d="m9 16 2 2 4-4"/></svg>
              Interviews
            </a>
            <a routerLink="/recruiter/chat" routerLinkActive="bg-blue-50 text-blue-600" class="px-3 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2 relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h8"/><path d="M8 8h5"/></svg>
              Chat
              <span
                *ngIf="chatUnreadCount() > 0"
                class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center"
              >
                {{ chatUnreadCountLabel() }}
              </span>
            </a>
            <a routerLink="/recruiter/profile" routerLinkActive="bg-blue-50 text-blue-600" class="px-3 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Profile
            </a>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- Notification Bell -->
          <a
            routerLink="/recruiter/notifications"
            routerLinkActive="bg-blue-50 text-blue-600"
            class="relative p-2 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
            title="Notifications"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span
              *ngIf="notificationCount() > 0"
              class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center"
            >
              {{ notificationCountLabel() }}
            </span>
          </a>

          <!-- Right side info -->
          <div class="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div class="text-right hidden xl:block">
              <p class="text-[13px] font-bold text-slate-800 leading-none">{{ currentUser()?.full_name || 'Recruiter' }}</p>
            </div>
            <div class="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-slate-900/20 uppercase">
              {{ (currentUser()?.full_name || 'R')[0] }}
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
              <p class="text-sm text-slate-500">Get notified about new applications and chat messages</p>
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
  `
})
export class RecruiterLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private realtimeUpdates = inject(RealtimeUpdatesService);
  private fcm = inject(FcmService);

  protected notificationPermissionDismissed = signal(false);

  isAuthenticated = computed(() => this.authService.isAuthenticated() && this.authService.hasRole('RECRUITER'));
  currentUser = computed(() => this.authService.getCurrentUser() as any);
  notificationCount = computed(() => this.realtimeUpdates.notificationUnreadCount());
  chatUnreadCount = computed(() => this.realtimeUpdates.chatUnreadCount());

  showNotificationBanner = computed(() => {
    return this.isAuthenticated() &&
           !this.notificationPermissionDismissed() &&
           this.fcm.getPermissionState() === 'default';
  });

  ngOnInit(): void {
    this.realtimeUpdates.ensureStarted();
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

  chatUnreadCountLabel(): string {
    const count = this.chatUnreadCount();
    return count > 99 ? '99+' : String(count);
  }
}
