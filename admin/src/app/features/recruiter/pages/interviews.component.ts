import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

type RecruiterInterviewRow = {
  id: number;
  applicationId: number | null;
  candidateName: string;
  candidateEmail: string;
  jobOfferId: number | null;
  jobTitle: string;
  interviewTypeRaw: string;
  interviewModeRaw: string;
  statusRaw: string;
  durationMinutes: number | null;
  scheduledAt: string | null;
  notes: string | null;
};

@Component({
  selector: 'app-recruiter-interviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#f8fafc] pb-20 font-['Outfit']">
      <div class="max-w-[1400px] mx-auto px-6 py-12">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-10">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-blue-100">
              Recruiter Interview Desk
            </div>
            <h1 class="text-4xl font-black text-slate-900 tracking-tight leading-none">
              Assigned <span class="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Interviews</span>
            </h1>
            <p class="text-slate-500 font-semibold mt-3 max-w-2xl text-sm sm:text-base">
              Every candidate interview that currently belongs to your recruiter account.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <a
              routerLink="/recruiter/dashboard"
              class="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xs shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-3 border border-slate-100 uppercase tracking-widest"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Dashboard
            </a>
            <button
              (click)="loadInterviews()"
              [disabled]="loading()"
              class="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg [class.animate-spin]="loading()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div class="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</p>
            <p class="text-3xl font-black text-slate-900 mt-2">{{ totalInterviews() }}</p>
          </div>
          <div class="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Upcoming</p>
            <p class="text-3xl font-black text-blue-600 mt-2">{{ upcomingInterviews() }}</p>
          </div>
          <div class="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending Date</p>
            <p class="text-3xl font-black text-amber-600 mt-2">{{ pendingScheduleCount() }}</p>
          </div>
        </div>

        <div class="bg-white rounded-[2.5rem] p-4 shadow-xl shadow-slate-200/40 border border-slate-100 mb-8 flex flex-col xl:flex-row items-center gap-4">
          <div class="flex-1 relative w-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event || '')"
              type="text"
              placeholder="Search by candidate, job title, status, or interview type..."
              class="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] pl-16 pr-6 py-4 font-bold text-slate-800 focus:bg-white focus:border-blue-500/20 text-sm transition-all outline-none"
            />
          </div>

          <div class="w-full xl:w-auto flex flex-col sm:flex-row gap-2">
            <select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)" class="h-12 rounded-2xl bg-slate-50 border border-slate-100 px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 min-w-[190px]">
              <option value="all">All Types</option>
              <option value="test_technique">Technical</option>
              <option value="test_rh_telephonique">HR Phone</option>
              <option value="test_rh_video">HR Video</option>
              <option value="test_psychotechnique">Psychometric</option>
            </select>

            <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" class="h-12 rounded-2xl bg-slate-50 border border-slate-100 px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 min-w-[170px]">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div class="bg-white rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
          <div *ngIf="loading()" class="py-20 flex items-center justify-center">
            <div class="w-8 h-8 border-[3px] border-slate-100 border-t-blue-600 animate-spin rounded-full"></div>
          </div>

          <div *ngIf="!loading()" class="overflow-x-auto custom-scrollbar">
            <table *ngIf="filteredInterviews().length > 0; else emptyState" class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50/60">
                  <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Candidate</th>
                  <th class="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Type</th>
                  <th class="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Mode</th>
                  <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Schedule</th>
                  <th class="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-center">Status</th>
                  <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-right">Coordination</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-50">
                <tr *ngFor="let row of filteredInterviews()" class="hover:bg-slate-50/80 transition-all">
                  <td class="px-8 py-6">
                    <div class="flex items-center gap-3">
                      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex items-center justify-center font-black text-sm shadow-lg shrink-0">
                        {{ getInitials(row.candidateName) }}
                      </div>
                      <div>
                        <p class="text-sm font-black text-slate-900 leading-tight">{{ row.candidateName }}</p>
                        <p class="text-[11px] text-slate-400 font-bold">{{ row.candidateEmail || 'No email' }}</p>
                      </div>
                    </div>
                  </td>

                  <td class="px-6 py-6">
                    <span [class]="getInterviewTypeClass(row.interviewTypeRaw)">
                      {{ formatInterviewType(row.interviewTypeRaw) }}
                    </span>
                  </td>

                  <td class="px-6 py-6">
                    <span [class]="getInterviewModeClass(row.interviewModeRaw)">
                      {{ formatInterviewMode(row.interviewModeRaw) }}
                    </span>
                  </td>

                  <td class="px-8 py-6">
                    <p *ngIf="row.scheduledAt" class="text-sm font-black text-slate-900 leading-tight">{{ row.scheduledAt | date:'MMM d, y':'UTC' }}</p>
                    <p *ngIf="row.scheduledAt" class="text-[11px] text-slate-400 font-bold">{{ row.scheduledAt | date:'HH:mm':'UTC' }} (UTC)</p>
                    <p *ngIf="!row.scheduledAt" class="text-xs font-black text-amber-600 uppercase tracking-widest">Not Scheduled</p>
                  </td>

                  <td class="px-6 py-6 text-center">
                    <span [class]="getStatusClass(row.statusRaw)">
                      {{ formatInterviewStatus(row.statusRaw) }}
                    </span>
                  </td>

                  <td class="px-8 py-6 text-right">
                    <span
                      class="inline-flex items-center justify-center h-11 px-5 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                      [class]="row.scheduledAt
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-amber-50 text-amber-600 border border-amber-100'"
                    >
                      {{ row.scheduledAt ? 'Confirmed' : 'Pending' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <ng-template #emptyState>
          <div class="py-24 text-center">
            <h3 class="text-2xl font-black text-slate-900 mb-2">No assigned interviews found</h3>
            <p class="text-slate-500 font-bold uppercase text-[10px] tracking-widest">When HR assigns you an interview, it will appear here instantly.</p>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 999px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
  `]
})
export class RecruiterInterviewsComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  private refreshHandle: ReturnType<typeof setInterval> | null = null;

  loading = signal(false);
  interviews = signal<RecruiterInterviewRow[]>([]);
  searchQuery = signal('');
  typeFilter = signal('all');
  statusFilter = signal('all');

  totalInterviews = computed(() => this.interviews().length);
  upcomingInterviews = computed(() => {
    const now = Date.now();
    return this.interviews().filter((item) => {
      if (!item.scheduledAt) return false;
      const when = new Date(item.scheduledAt).getTime();
      return Number.isFinite(when) && when >= now;
    }).length;
  });
  pendingScheduleCount = computed(() => this.interviews().filter((item) => !item.scheduledAt).length);

  filteredInterviews = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const type = this.typeFilter();
    const status = this.statusFilter();

    return this.interviews().filter((row) => {
      if (type !== 'all' && row.interviewTypeRaw !== type) return false;
      if (status !== 'all' && row.statusRaw !== status) return false;

      if (!q) return true;

      const haystack = [
        row.candidateName,
        row.candidateEmail,
        row.jobTitle,
        this.formatInterviewType(row.interviewTypeRaw),
        this.formatInterviewMode(row.interviewModeRaw),
        this.formatInterviewStatus(row.statusRaw),
      ].join(' ').toLowerCase();

      return haystack.includes(q);
    });
  });

  ngOnInit(): void {
    this.loadInterviews();
    this.refreshHandle = setInterval(() => {
      if (!this.loading()) {
        this.loadInterviews();
      }
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.refreshHandle) {
      clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
  }

  loadInterviews(): void {
    this.loading.set(true);

    this.apiService.get<any>('company/interviews').subscribe({
      next: (res) => {
        if (!res?.success) {
          this.notificationService.error(res?.message || 'Could not load interviews.');
          this.interviews.set([]);
          this.loading.set(false);
          return;
        }

        const rows: RecruiterInterviewRow[] = Array.isArray(res?.data)
          ? res.data.map((item: any) => this.mapRow(item))
          : [];
        rows.sort((left, right) => this.compareRows(left, right));
        this.interviews.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Could not load interviews.');
        this.interviews.set([]);
        this.loading.set(false);
      }
    });
  }

  getInitials(name: string): string {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'NA';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  formatInterviewType(typeRaw: string): string {
    switch (typeRaw) {
      case 'test_technique':
        return 'Technical';
      case 'test_rh_telephonique':
        return 'HR Phone';
      case 'test_rh_video':
        return 'HR Video';
      case 'test_psychotechnique':
        return 'Psychometric';
      default:
        return this.titleize(typeRaw.replace(/_/g, ' ')) || 'Interview';
    }
  }

  formatInterviewMode(modeRaw: string): string {
    switch (modeRaw) {
      case 'online':
        return 'Online';
      case 'presentiel':
      case 'in_person':
      case 'onsite':
        return 'In Person';
      default:
        return this.titleize(modeRaw.replace(/_/g, ' ')) || 'Unknown';
    }
  }

  formatInterviewStatus(statusRaw: string): string {
    switch (statusRaw) {
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Pending';
    }
  }

  getInterviewTypeClass(typeRaw: string): string {
    const base = 'inline-flex items-center h-8 px-3 rounded-full text-[10px] font-black uppercase tracking-widest';
    if (typeRaw === 'test_technique') return `${base} bg-violet-50 text-violet-700 border border-violet-100`;
    if (typeRaw === 'test_psychotechnique') return `${base} bg-amber-50 text-amber-700 border border-amber-100`;
    return `${base} bg-blue-50 text-blue-700 border border-blue-100`;
  }

  getInterviewModeClass(modeRaw: string): string {
    const base = 'inline-flex items-center h-8 px-3 rounded-full text-[10px] font-black uppercase tracking-widest';
    if (modeRaw === 'online') return `${base} bg-cyan-50 text-cyan-700 border border-cyan-100`;
    return `${base} bg-slate-100 text-slate-700 border border-slate-200`;
  }

  getStatusClass(statusRaw: string): string {
    const base = 'inline-flex items-center h-8 px-3 rounded-full text-[10px] font-black uppercase tracking-widest';
    if (statusRaw === 'completed') return `${base} bg-emerald-50 text-emerald-700 border border-emerald-100`;
    if (statusRaw === 'cancelled') return `${base} bg-rose-50 text-rose-700 border border-rose-100`;
    return `${base} bg-amber-50 text-amber-700 border border-amber-100`;
  }

  private mapRow(item: any): RecruiterInterviewRow {
    return {
      id: this.toPositiveNumber(item?.id) || 0,
      applicationId: this.toPositiveNumber(item?.application_id),
      candidateName: String(item?.candidate?.name || 'Candidate').trim(),
      candidateEmail: String(item?.candidate?.email || '').trim(),
      jobOfferId: this.toPositiveNumber(item?.job_offer?.id),
      jobTitle: String(item?.job_offer?.title || 'Untitled job').trim(),
      interviewTypeRaw: this.normalize(item?.interview_type, 'unknown'),
      interviewModeRaw: this.normalize(item?.interview_mode, 'unknown'),
      statusRaw: this.normalize(item?.status, 'pending'),
      durationMinutes: this.toPositiveNumber(item?.duration_minutes),
      scheduledAt: this.toDateStringOrNull(item?.scheduled_at),
      notes: item?.notes ? String(item.notes).trim() : null,
    };
  }

  private compareRows(a: RecruiterInterviewRow, b: RecruiterInterviewRow): number {
    const now = Date.now();
    const aTime = this.toTimestamp(a.scheduledAt);
    const bTime = this.toTimestamp(b.scheduledAt);

    const aUpcoming = aTime !== null && aTime >= now;
    const bUpcoming = bTime !== null && bTime >= now;

    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    if (aUpcoming && bUpcoming && aTime !== null && bTime !== null) return aTime - bTime;
    if (!aUpcoming && !bUpcoming && aTime !== null && bTime !== null) return bTime - aTime;
    if (a.scheduledAt !== b.scheduledAt) return a.scheduledAt ? -1 : 1;
    return b.id - a.id;
  }

  private normalize(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || fallback;
  }

  private titleize(value: string): string {
    return String(value || '')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private toPositiveNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private toTimestamp(value: string | null): number | null {
    if (!value) return null;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toDateStringOrNull(value: unknown): string | null {
    if (!value) return null;
    const raw = String(value);
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : raw;
  }
}
