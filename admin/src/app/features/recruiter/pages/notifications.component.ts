import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  RealtimeNotificationItem,
  RealtimeUpdatesService
} from '../../../core/services/realtime-updates.service';

interface NotificationItem {
  id: number;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  status?: string | null;
  sent_at?: string | null;
  reference_id?: number | null;
  channel?: string | null;
  is_read?: boolean;
  data?: Record<string, any> | null;
}

interface NotificationPage {
  data?: NotificationItem[];
  current_page?: number;
  last_page?: number;
  total?: number;
}

@Component({
  selector: 'app-recruiter-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-5xl mx-auto py-10 px-4 font-['Outfit']">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-blue-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Activity Feed
          </div>
          <h1 class="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            My <span class="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Notifications</span>
          </h1>
          <p class="text-slate-500 font-semibold mt-3 max-w-xl text-sm leading-relaxed">
            Stay updated on new applications, interview assignments, and candidate activity in real time.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="markAllAsRead()"
            [disabled]="isLoading() || !hasUnreadNotifications()"
            class="h-12 px-6 rounded-2xl bg-blue-50 text-blue-600 font-black text-[11px] uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            Mark All Read
          </button>
          <button
            type="button"
            (click)="refresh()"
            [disabled]="isLoading()"
            class="h-12 px-6 rounded-2xl bg-white text-slate-700 font-black text-[11px] uppercase tracking-widest border border-slate-100 shadow-sm hover:shadow-xl transition-all flex items-center gap-3"
          >
            <svg *ngIf="!isLoading()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            <svg *ngIf="isLoading()" class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M22 12a10 10 0 0 1-10 10" stroke-linecap="round"/></svg>
            Refresh
          </button>
          <a
            routerLink="/recruiter/dashboard"
            class="h-12 px-6 rounded-2xl bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Dashboard
          </a>
        </div>
      </div>

      <div class="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 class="text-base font-black text-slate-900 uppercase tracking-tight">Latest Alerts</h2>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              Total: {{ total() }}
            </p>
          </div>
          <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            Page {{ currentPage() }} / {{ lastPage() }}
          </div>
        </div>

        <div *ngIf="isLoading()" class="py-20 text-center">
          <div class="w-10 h-10 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading notifications</p>
        </div>

        <div *ngIf="isEmpty()" class="py-24 text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <h3 class="text-lg font-black text-slate-900">No notifications yet</h3>
          <p class="text-slate-500 font-semibold text-sm mt-2">You'll see candidate applications and recruiter activity here.</p>
        </div>

        <div *ngIf="!isLoading() && notifications().length > 0" class="divide-y divide-slate-50">
          <div *ngFor="let item of notifications()" class="p-6 sm:p-8 hover:bg-slate-50/50 transition-colors group">
            <div class="flex flex-col sm:flex-row sm:items-center gap-5">
              <div [class]="'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ' + iconClass(item.type)">
                <svg *ngIf="item.type === 'NEW_APPLICATION'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11v6"/><path d="M19 14h6"/></svg>
                <svg *ngIf="item.type === 'JOB_POSTED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>
                <svg *ngIf="item.type === 'INTERVIEW_ASSIGNED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V3"/><path d="M16 7V3"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 11h18"/><path d="m9 16 2 2 4-4"/></svg>
                <svg *ngIf="item.type === 'INTERVIEW_SCHEDULED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
                <svg *ngIf="item.type === 'QUIZ_COMPLETED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11.5 11 13.5 15 9.5"/><path d="M20 12a8 8 0 1 1-4.7-7.3"/><path d="M20 4v6h-6"/></svg>
                <svg *ngIf="!item.type || !['NEW_APPLICATION','JOB_POSTED','INTERVIEW_ASSIGNED','INTERVIEW_SCHEDULED','QUIZ_COMPLETED'].includes(item.type)" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border" [class]="statusClass(item.status)">
                    {{ item.status || 'sent' }}
                  </span>
                  <span *ngIf="item.is_read !== true" class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100">
                    Unread
                  </span>
                  <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                    {{ typeLabel(item.type) }}
                  </span>
                </div>

                <ng-container *ngIf="item.type === 'NEW_APPLICATION'; else defaultView">
                  <div class="text-slate-900 font-black text-base leading-tight">
                    {{ item.title }}
                  </div>
                  <div class="text-sm font-semibold text-slate-500 mt-1.5 leading-relaxed" *ngIf="resolveApplication(item) as app; else simpleBody">
                    Candidate <span class="text-slate-900 font-bold">{{ candidateName(app) }}</span> applied for <span class="text-blue-600 font-bold">{{ app?.job_offer?.title }}</span>
                  </div>
                  <ng-template #simpleBody>
                    <div class="text-sm font-semibold text-slate-500 mt-1.5 leading-relaxed">
                      {{ item.body || item.message }}
                    </div>
                  </ng-template>
                </ng-container>

                <ng-template #defaultView>
                  <div class="text-slate-900 font-black text-base leading-tight">
                    {{ item.title || 'Notification' }}
                  </div>
                  <div class="text-sm font-semibold text-slate-500 mt-1.5 leading-relaxed">
                    {{ item.body || item.message || '' }}
                  </div>
                </ng-template>

                <div class="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                  {{ item.sent_at ? (item.sent_at | date:'MMM d, y - HH:mm') : 'Just now' }}
                </div>
              </div>

              <div class="flex items-center gap-3 shrink-0">
                <button
                  *ngIf="item.is_read !== true"
                  type="button"
                  (click)="markNotificationAsRead(item)"
                  class="h-12 px-5 rounded-2xl border border-slate-100 text-slate-500 hover:bg-slate-100 transition-all font-black text-[10px] uppercase tracking-widest"
                >
                  Mark Read
                </button>
                <a
                  *ngIf="item.type === 'INTERVIEW_ASSIGNED' && resolveApplication(item) as app"
                  [routerLink]="['/recruiter/schedule-interview']"
                  [state]="{ applicationId: app.id, jobId: app.job_offer_id }"
                  (click)="markNotificationAsRead(item)"
                  class="h-12 px-6 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest flex items-center shadow-sm"
                  title="Schedule interview"
                >
                  Schedule Interview
                </a>
                <a
                  *ngIf="item.type !== 'INTERVIEW_ASSIGNED' && resolveApplication(item) as app"
                  [routerLink]="getNotificationRoute(item, app)"
                  [queryParams]="getNotificationQueryParams(item, app)"
                  (click)="markNotificationAsRead(item)"
                  class="h-12 px-6 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest flex items-center shadow-sm"
                  [title]="'View applicants'"
                >
                  View Applicants
                </a>
                <button
                  (click)="deleteNotification(item)"
                  [disabled]="deletingId() === item.id"
                  class="h-12 w-12 rounded-2xl border border-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center group-hover:border-rose-100"
                  title="Delete notification"
                >
                  <svg *ngIf="deletingId() !== item.id" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  <svg *ngIf="deletingId() === item.id" class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M22 12a10 10 0 0 1-10 10" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="lastPage() > 1" class="px-6 py-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Showing page {{ currentPage() }} of {{ lastPage() }}
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="loadPage(currentPage() - 1)"
              [disabled]="currentPage() <= 1 || isLoading()"
              class="h-10 px-4 rounded-xl border border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              (click)="loadPage(currentPage() + 1)"
              [disabled]="currentPage() >= lastPage() || isLoading()"
              class="h-10 px-4 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RecruiterNotificationsComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private notificationsService = inject(NotificationService);
  private realtimeUpdates = inject(RealtimeUpdatesService);

  notifications = signal<NotificationItem[]>([]);
  applicationLookup = signal<Record<number, any>>({});
  isLoading = signal(false);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  deletingId = signal<number | null>(null);

  isEmpty = computed(() => !this.isLoading() && this.notifications().length === 0);
  private handledLiveNotificationId: number | null = null;
  private refreshHandle: ReturnType<typeof setInterval> | null = null;

  private liveEffect = effect(
    () => {
      const notification = this.realtimeUpdates.lastNotification();
      if (notification && notification.id !== this.handledLiveNotificationId) {
        this.handledLiveNotificationId = notification.id;
        this.prependLiveNotification(notification);
      }
    },
    { allowSignalWrites: true }
  );

  ngOnInit(): void {
    this.realtimeUpdates.ensureStarted();
    this.loadPage(1);
    this.refreshHandle = setInterval(() => {
      if (!this.isLoading()) {
        this.loadPage(this.currentPage());
      }
    }, 15000);
  }

  ngOnDestroy(): void {
    this.liveEffect.destroy();
    if (this.refreshHandle) {
      clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
  }

  refresh(): void {
    this.loadPage(this.currentPage());
  }

  loadPage(page: number): void {
    if (page < 1) return;

    this.isLoading.set(true);
    this.apiService.get<NotificationPage>(`notifications?page=${page}`).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (res) => {
        const items = Array.isArray(res?.data) ? res.data ?? [] : [];
        this.notifications.set(items);
        this.currentPage.set(res?.current_page ?? page);
        this.lastPage.set(res?.last_page ?? page);
        this.total.set(res?.total ?? items.length);
        this.loadApplicationsIfNeeded(items);
      },
      error: (err) => {
        this.notificationsService.error(err?.error?.message || 'Failed to load notifications.');
      }
    });
  }

  deleteNotification(item: NotificationItem): void {
    if (!item?.id || this.deletingId()) return;

    this.deletingId.set(item.id);
    this.apiService.delete<{ message?: string }>(`notifications/${item.id}`).pipe(
      finalize(() => this.deletingId.set(null))
    ).subscribe({
      next: (res) => {
        this.notifications.update((list) => list.filter((n) => n.id !== item.id));
        this.total.set(Math.max(0, this.total() - 1));
        this.realtimeUpdates.removeNotification(item.is_read !== true);
        this.notificationsService.success(res?.message || 'Notification removed.');
      },
      error: (err) => {
        this.notificationsService.error(err?.error?.message || 'Failed to delete notification.');
      }
    });
  }

  hasUnreadNotifications(): boolean {
    return this.notifications().some((item) => item.is_read !== true);
  }

  markNotificationAsRead(item: NotificationItem): void {
    if (!item?.id || item.is_read === true) {
      return;
    }

    this.apiService.post<any>(`notifications/${item.id}/read`, {}).subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry))
        );
        this.realtimeUpdates.markNotificationAsRead();
      }
    });
  }

  markAllAsRead(): void {
    if (!this.hasUnreadNotifications()) {
      return;
    }

    this.apiService.post<any>('notifications/mark-all-read', {}).subscribe({
      next: (res) => {
        this.notifications.update((list) => list.map((item) => ({ ...item, is_read: true })));
        this.realtimeUpdates.markAllNotificationsAsRead();
        this.notificationsService.success(res?.message || 'All notifications marked as read.');
      },
      error: (err) => {
        this.notificationsService.error(err?.error?.message || 'Failed to mark notifications as read.');
      }
    });
  }

  private loadApplicationsIfNeeded(items: NotificationItem[]): void {
    const ids = items
      .filter((item) =>
        (item.type === 'NEW_APPLICATION' || item.type === 'QUIZ_COMPLETED' || item.type === 'INTERVIEW_ASSIGNED') &&
        Number(item.reference_id) > 0
      )
      .map((item) => Number(item.reference_id));

    if (ids.length === 0) return;

    const lookup = this.applicationLookup();
    const missing = ids.filter((id) => !lookup[id]);
    if (missing.length === 0) return;

    this.apiService.get<any>('company/applicants').subscribe({
      next: (res) => {
        if (!res?.success || !Array.isArray(res?.data)) return;
        const map: Record<number, any> = { ...this.applicationLookup() };
        for (const app of res.data) {
          if (app?.id) {
            map[Number(app.id)] = app;
          }
        }
        this.applicationLookup.set(map);
      }
    });
  }

  resolveApplication(item: NotificationItem): any | null {
    if ((item?.type !== 'NEW_APPLICATION' && item?.type !== 'QUIZ_COMPLETED' && item?.type !== 'INTERVIEW_ASSIGNED') || !item?.reference_id) return null;
    return this.applicationLookup()[Number(item.reference_id)] || null;
  }

  getNotificationRoute(item: NotificationItem, app: any): any[] {
    if (item?.type === 'INTERVIEW_ASSIGNED' && app?.id) {
      return ['/recruiter/interviews'];
    }

    return ['/recruiter/applicants'];
  }

  getNotificationQueryParams(item: NotificationItem, app: any): Record<string, any> | null {
    if (item?.type === 'INTERVIEW_ASSIGNED') {
      return null;
    }

    return { jobId: app?.job_offer?.id };
  }

  candidateName(app: any): string {
    const first = app?.candidate?.first_name || '';
    const last = app?.candidate?.last_name || '';
    const full = `${first} ${last}`.trim();
    return full || app?.candidate?.user?.email || 'Candidate';
  }

  typeLabel(type?: string | null): string {
    switch (type) {
      case 'NEW_APPLICATION': return 'New application';
      case 'JOB_POSTED': return 'New job offer';
      case 'INTERVIEW_ASSIGNED': return 'Interview assigned';
      case 'INTERVIEW_SCHEDULED': return 'Interview';
      case 'QUIZ_COMPLETED': return 'Quiz completed';
      case 'CANDIDATE_PROFILE_UPDATED': return 'Profile updated';
      default: return 'Notification';
    }
  }

  iconClass(type?: string | null): string {
    switch (type) {
      case 'NEW_APPLICATION': return 'bg-blue-50 text-blue-600';
      case 'JOB_POSTED': return 'bg-violet-50 text-violet-600';
      case 'INTERVIEW_ASSIGNED': return 'bg-cyan-50 text-cyan-600';
      case 'INTERVIEW_SCHEDULED': return 'bg-amber-50 text-amber-600';
      case 'QUIZ_COMPLETED': return 'bg-emerald-50 text-emerald-600';
      case 'CANDIDATE_PROFILE_UPDATED': return 'bg-indigo-50 text-indigo-600';
      default: return 'bg-slate-100 text-slate-400';
    }
  }

  statusClass(status?: string | null): string {
    switch (status) {
      case 'sent': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'failed': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  }

  private prependLiveNotification(item: RealtimeNotificationItem): void {
    const normalized: NotificationItem = {
      ...item,
      message: item.message ?? item.body,
      is_read: item.is_read ?? false,
      data: item.data ?? {}
    };

    if (this.currentPage() === 1) {
      this.notifications.update((list) => {
        if (list.some((entry) => entry.id === normalized.id)) {
          return list;
        }

        return [normalized, ...list].slice(0, 20);
      });
      this.loadApplicationsIfNeeded([normalized]);
    }

    this.total.update((count) => count + 1);
  }
}
