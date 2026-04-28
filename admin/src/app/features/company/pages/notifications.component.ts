import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RealtimeUpdatesService } from '../../../core/services/realtime-updates.service';
import { finalize } from 'rxjs';

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
}

interface NotificationPage {
  data?: NotificationItem[];
  current_page?: number;
  last_page?: number;
  total?: number;
}

@Component({
  selector: 'app-company-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-6xl mx-auto py-10 px-4 font-['Outfit']">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-slate-100">
            Activity Center
          </div>
          <h1 class="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Notifications <span class="text-blue-600">History</span>
          </h1>
          <p class="text-slate-500 font-semibold mt-3 max-w-2xl text-sm sm:text-base">
            Every candidate action and system update is logged here for your team.
          </p>
        </div>
        <div class="flex items-center gap-3">
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
            routerLink="/company/dashboard"
            class="h-12 px-6 rounded-2xl bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Dashboard
          </a>
          <button
            *ngIf="totalUnread() > 0"
            (click)="markAllRead()"
            class="h-12 px-6 rounded-2xl bg-emerald-50 text-emerald-600 font-black text-[11px] uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17 4 12"/></svg>
            Mark All Read
          </button>
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
          <p class="text-slate-500 font-semibold text-sm mt-2">We will list candidate activity as soon as it happens.</p>
        </div>

        <div *ngIf="!isLoading() && notifications().length > 0" class="divide-y divide-slate-50">
          <div 
            *ngFor="let item of notifications()" 
            (click)="onNotificationClick(item)"
            [class]="'p-6 sm:p-8 hover:bg-slate-50 transition-colors cursor-pointer relative group ' + (!item.is_read ? 'bg-slate-50/50' : 'bg-white')"
          >
            <div class="flex flex-col sm:flex-row sm:items-center gap-5">
              <div [class]="'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ' + iconClass(item.type)">
                <svg *ngIf="item.type === 'NEW_APPLICATION'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11v6"/><path d="M19 14h6"/></svg>
                <svg *ngIf="item.type === 'CANDIDATE_CV_UPLOADED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 13v6"/><path d="M9 16h6"/></svg>
                <svg *ngIf="item.type === 'JOB_LIKED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78"/></svg>
                <svg *ngIf="item.type === 'JOB_COMMENTED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <svg *ngIf="item.type === 'CANDIDATE_PROFILE_UPDATED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></svg>
                <svg *ngIf="item.type === 'JOB_POSTED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>
                <svg *ngIf="!item.type || (item.type !== 'NEW_APPLICATION' && item.type !== 'CANDIDATE_CV_UPLOADED' && item.type !== 'JOB_LIKED' && item.type !== 'JOB_COMMENTED' && item.type !== 'CANDIDATE_PROFILE_UPDATED' && item.type !== 'JOB_POSTED')" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>

              <div class="flex-1">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                        [class]="statusClass(item.status)">
                    {{ statusLabel(item.status) }}
                  </span>
                  <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                    {{ typeLabel(item.type) }}
                  </span>
                  <span *ngIf="!item.is_read" class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-900 text-white">
                    New
                  </span>
                </div>
                <ng-container *ngIf="item.type === 'NEW_APPLICATION'; else defaultMessage">
                  <ng-container *ngIf="resolveApplication(item) as app; else applicationFallback">
                    <div class="text-slate-900 font-black text-base leading-tight">
                      New application received
                    </div>
                    <div class="text-sm font-bold text-slate-500 mt-2">
                      Candidate: <span class="text-slate-800">{{ candidateName(app) }}</span>
                    </div>
                    <div class="text-sm font-bold text-slate-500">
                      Offer: <span class="text-slate-800">{{ app?.job_offer?.title || 'Job offer' }}</span>
                    </div>
                  </ng-container>
                  <ng-template #applicationFallback>
                    <div class="text-slate-900 font-black text-base leading-tight">
                      {{ item.message || 'New application received.' }}
                    </div>
                  </ng-template>
                </ng-container>
                <ng-template #defaultMessage>
                  <div class="text-slate-900 font-black text-base leading-tight">
                    {{ item.title || 'System Notification' }}
                  </div>
                  <div class="text-sm font-semibold text-slate-500 mt-1.5 leading-relaxed">
                    {{ item.body || item.message || 'Details for this activity were not provided.' }}
                  </div>
                </ng-template>
                <div class="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                  {{ item.sent_at ? (item.sent_at | date:'MMM d, y • HH:mm') : 'Just now' }}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <a
                  *ngIf="resolveApplication(item) as app"
                  [routerLink]="getNotificationRoute(item, app)"
                  [queryParams]="getNotificationQueryParams(item, app)"
                  class="h-12 px-4 rounded-2xl border border-slate-100 text-slate-500 hover:bg-slate-100 transition-all font-black text-[10px] uppercase tracking-widest flex items-center"
                  title="View applicants"
                >
                  View
                </a>
                <button
                  (click)="markAsRead(item); $event.stopPropagation()"
                  *ngIf="!item.is_read"
                  class="h-12 px-4 rounded-2xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 transition-all font-black text-[10px] uppercase tracking-widest flex items-center"
                  title="Mark as read"
                >
                  Mark as Read
                </button>
                <button
                  (click)="deleteNotification(item)"
                  [disabled]="deletingId() === item.id"
                  class="h-12 w-12 rounded-2xl border border-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center"
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
export class CompanyNotificationsComponent implements OnInit {
  private apiService = inject(ApiService);
  private notificationsService = inject(NotificationService);
  private realtimeService = inject(RealtimeUpdatesService);

  notifications = signal<NotificationItem[]>([]);
  applicationLookup = signal<Record<number, any>>({});
  isLoading = signal(false);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  deletingId = signal<number | null>(null);

  totalUnread = computed(() => this.notifications().filter(n => !n.is_read).length);

  isEmpty = computed(() => !this.isLoading() && this.notifications().length === 0);

  ngOnInit(): void {
    this.loadPage(1);
  }

  refresh(): void {
    this.loadPage(this.currentPage());
  }

  loadPage(page: number): void {
    if (page < 1) {
      return;
    }

    this.isLoading.set(true);
    this.apiService.get<NotificationPage>(`notifications?page=${page}`).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (res) => {
        const rawItems = Array.isArray(res?.data) ? res?.data ?? [] : [];
        this.notifications.set(rawItems);
        this.currentPage.set(res?.current_page ?? page);
        this.lastPage.set(res?.last_page ?? page);
        this.total.set(rawItems.length);
        this.loadApplicationsIfNeeded(rawItems);
      },
      error: (err) => {
        this.notificationsService.error(err?.error?.message || 'Failed to load notifications.');
      }
    });
  }

  deleteNotification(item: NotificationItem): void {
    if (!item?.id || this.deletingId()) {
      return;
    }

    this.deletingId.set(item.id);
    this.apiService.delete<{ message?: string }>(`notifications/${item.id}`).pipe(
      finalize(() => this.deletingId.set(null))
    ).subscribe({
      next: (res) => {
        if (!item.is_read) {
          this.realtimeService.markNotificationAsRead();
        }
        this.notifications.update(list => list.filter(n => n.id !== item.id));
        this.total.set(Math.max(0, this.total() - 1));
        this.notificationsService.success(res?.message || 'Notification removed.');
      },
      error: (err) => {
        this.notificationsService.error(err?.error?.message || 'Failed to delete notification.');
      }
    });
  }

  onNotificationClick(item: NotificationItem): void {
    if (!item.is_read) {
      this.markAsRead(item);
    }
  }

  markAsRead(item: NotificationItem): void {
    if (item.is_read) return;

    this.apiService.post(`notifications/${item.id}/read`, {}).subscribe({
      next: () => {
        this.notifications.update(list => 
          list.map(n => n.id === item.id ? { ...n, is_read: true } : n)
        );
        this.realtimeService.markNotificationAsRead();
      },
      error: (err) => {
        console.error('Failed to mark notification as read:', err);
      }
    });
  }

  markAllRead(): void {
    this.apiService.post('notifications/mark-all-read', {}).subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => ({ ...n, is_read: true })));
        this.realtimeService.markAllNotificationsAsRead();
        this.notificationsService.success('All notifications marked as read.');
      },
      error: (err) => {
        this.notificationsService.error('Failed to mark all as read.');
      }
    });
  }

  private loadApplicationsIfNeeded(items: NotificationItem[]): void {
    const ids = items
      .filter(item =>
        (item.type === 'NEW_APPLICATION' || item.type === 'QUIZ_DRAFT_READY') &&
        Number(item.reference_id) > 0
      )
      .map(item => Number(item.reference_id));

    if (ids.length === 0) {
      return;
    }

    const lookup = this.applicationLookup();
    const missing = ids.filter(id => !lookup[id]);
    if (missing.length === 0) {
      return;
    }

    this.apiService.get<any>('company/applicants').subscribe({
      next: (res) => {
        if (!res?.success || !Array.isArray(res?.data)) {
          return;
        }
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
    if ((item?.type !== 'NEW_APPLICATION' && item?.type !== 'QUIZ_DRAFT_READY') || !item?.reference_id) {
      return null;
    }
    return this.applicationLookup()[Number(item.reference_id)] || null;
  }

  getNotificationRoute(item: NotificationItem, app: any): any[] {
    if (item?.type === 'QUIZ_DRAFT_READY' && app?.id) {
      return ['/company/applications', app.id, 'assessment'];
    }
    return ['/company/applicants'];
  }

  getNotificationQueryParams(item: NotificationItem, app: any): Record<string, any> | null {
    if (item?.type === 'QUIZ_DRAFT_READY') {
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
      case 'NEW_APPLICATION':
        return 'New application';
      case 'CANDIDATE_CV_UPLOADED':
        return 'CV uploaded';
      case 'JOB_LIKED':
        return 'Job liked';
      case 'JOB_COMMENTED':
        return 'Job comment';
      case 'CANDIDATE_PROFILE_UPDATED':
        return 'Profile updated';
      case 'JOB_POSTED':
        return 'Job posted';
      case 'QUIZ_DRAFT_READY':
        return 'Quiz draft ready';
      default:
        return 'Notification';
    }
  }

  iconClass(type?: string | null): string {
    switch (type) {
      case 'NEW_APPLICATION':
        return 'bg-blue-50 text-blue-600';
      case 'CANDIDATE_CV_UPLOADED':
        return 'bg-emerald-50 text-emerald-600';
      case 'JOB_LIKED':
        return 'bg-rose-50 text-rose-600';
      case 'JOB_COMMENTED':
        return 'bg-amber-50 text-amber-600';
      case 'CANDIDATE_PROFILE_UPDATED':
        return 'bg-indigo-50 text-indigo-600';
      case 'JOB_POSTED':
        return 'bg-slate-100 text-slate-500';
      default:
        return 'bg-slate-100 text-slate-400';
    }
  }

  statusClass(status?: string | null): string {
    switch (status) {
      case 'sent':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'pending':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'failed':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  }

  statusLabel(status?: string | null): string {
    switch (status) {
      case 'sent':
        return 'sent';
      case 'pending':
        return 'pending';
      case 'failed':
        return 'push failed';
      default:
        return status || 'sent';
    }
  }

  private isFailedNotification(item: NotificationItem): boolean {
    return String(item?.status ?? '').trim().toLowerCase() === 'failed';
  }
}
