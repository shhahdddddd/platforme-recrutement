import { Component, OnInit, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

type InterviewRow = {
  key: string;
  interviewId: number | null;
  applicationId: number;
  jobOfferId: number | null;
  candidateName: string;
  candidateEmail: string;
  candidatePicture: string | null;
  jobTitle: string;
  interviewTypeRaw: string;
  interviewTypeLabel: string;
  interviewModeRaw: string;
  interviewModeLabel: string;
  responsibleName: string;
  responsibleEmail: string;
  scheduledAt: string | null;
  createdAt: string | null;
  statusRaw: string;
  statusLabel: string;
  notes: string;
};

type FilterOption = {
  value: string;
  label: string;
};

@Component({
  selector: 'app-company-interviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#f8fafc] pb-20 font-['Outfit']">
      <div class="max-w-[1400px] mx-auto px-6 py-12">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-10">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-blue-100">
              Interview Oversight
            </div>
            <h1 class="text-4xl font-black text-slate-900 tracking-tight leading-none">
              Interview <span class="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">List</span>
            </h1>
            <p class="text-slate-500 font-semibold mt-3 max-w-2xl text-sm sm:text-base italic">
              Centralized view of every scheduled interview, assigned responsible recruiter, and timing details.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <a routerLink="/company/dashboard" class="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xs shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-3 border border-slate-100 uppercase tracking-widest">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Dashboard
            </a>
            <button (click)="loadInterviews()" [disabled]="loading()" class="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              <svg [class.animate-spin]="loading()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div class="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Interviews</p>
            <p class="text-3xl font-black text-slate-900 mt-2">{{ totalInterviews() }}</p>
          </div>
          <div class="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Upcoming</p>
            <p class="text-3xl font-black text-blue-600 mt-2">{{ upcomingInterviews() }}</p>
          </div>
          <div class="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Online Interviews</p>
            <p class="text-3xl font-black text-cyan-600 mt-2">{{ onlineInterviews() }}</p>
          </div>
        </div>

        <div class="bg-white rounded-[2.5rem] p-4 shadow-xl shadow-slate-200/40 border border-slate-100 mb-8 flex flex-col xl:flex-row items-center gap-4">
          <div class="flex-1 relative w-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event || '')"
              type="text"
              placeholder="Search by candidate, recruiter, job, or interview type..."
              class="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] pl-16 pr-6 py-4 font-bold text-slate-800 focus:bg-white focus:border-blue-500/20 text-sm transition-all outline-none"
            />
          </div>

          <div class="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
            <!-- Type Filter -->
            <div class="relative" id="interview-type-filter-dropdown">
              <button
                type="button"
                (click)="toggleTypeFilter($event)"
                class="h-10 min-w-[220px] pl-3 pr-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-700 transition-all flex items-center justify-between gap-2 w-full sm:w-auto"
                [class.border-blue-500]="isTypeFilterOpen()"
                [class.bg-white]="isTypeFilterOpen()"
              >
                <span class="truncate">{{ getTypeFilterLabel() }}</span>
                <svg [class.rotate-180]="isTypeFilterOpen()" class="transition-transform duration-300 text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>

              <div *ngIf="isTypeFilterOpen()" class="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200/70 rounded-2xl shadow-2xl shadow-slate-900/10 p-2 max-h-64 overflow-y-auto custom-scroll animate-in">
                <button
                  type="button"
                  *ngFor="let option of typeFilterOptions; let first = first"
                  (click)="selectTypeFilter(option.value)"
                  class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-bold text-slate-700 text-sm flex items-center justify-between group"
                  [class.mt-1]="!first"
                >
                  <span>{{ option.label }}</span>
                  <svg *ngIf="typeFilter() === option.value" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Mode Filter -->
            <div class="relative" id="interview-mode-filter-dropdown">
              <button
                type="button"
                (click)="toggleModeFilter($event)"
                class="h-10 min-w-[200px] pl-3 pr-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-700 transition-all flex items-center justify-between gap-2 w-full sm:w-auto"
                [class.border-blue-500]="isModeFilterOpen()"
                [class.bg-white]="isModeFilterOpen()"
              >
                <span class="truncate">{{ getModeFilterLabel() }}</span>
                <svg [class.rotate-180]="isModeFilterOpen()" class="transition-transform duration-300 text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>

              <div *ngIf="isModeFilterOpen()" class="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200/70 rounded-2xl shadow-2xl shadow-slate-900/10 p-2 max-h-64 overflow-y-auto custom-scroll animate-in">
                <button
                  type="button"
                  *ngFor="let option of modeFilterOptions; let first = first"
                  (click)="selectModeFilter(option.value)"
                  class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-bold text-slate-700 text-sm flex items-center justify-between group"
                  [class.mt-1]="!first"
                >
                  <span>{{ option.label }}</span>
                  <svg *ngIf="modeFilter() === option.value" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Status Filter -->
            <div class="relative" id="interview-status-filter-dropdown">
              <button
                type="button"
                (click)="toggleStatusFilter($event)"
                class="h-10 min-w-[190px] pl-3 pr-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-700 transition-all flex items-center justify-between gap-2 w-full sm:w-auto"
                [class.border-blue-500]="isStatusFilterOpen()"
                [class.bg-white]="isStatusFilterOpen()"
              >
                <span class="truncate">{{ getStatusFilterLabel() }}</span>
                <svg [class.rotate-180]="isStatusFilterOpen()" class="transition-transform duration-300 text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>

              <div *ngIf="isStatusFilterOpen()" class="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200/70 rounded-2xl shadow-2xl shadow-slate-900/10 p-2 max-h-64 overflow-y-auto custom-scroll animate-in">
                <button
                  type="button"
                  *ngFor="let option of statusFilterOptions; let first = first"
                  (click)="selectStatusFilter(option.value)"
                  class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-bold text-slate-700 text-sm flex items-center justify-between group"
                  [class.mt-1]="!first"
                >
                  <span>{{ option.label }}</span>
                  <svg *ngIf="statusFilter() === option.value" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            </div>
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
                  <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Job</th>
                  <th class="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Type</th>
                  <th class="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Mode</th>
                  <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Responsible</th>
                  <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Schedule</th>
                  <th class="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-center">Status</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-50">
                <tr *ngFor="let row of filteredInterviews()" class="hover:bg-slate-50/80 transition-all">
                  <td class="px-8 py-6">
                    <div class="flex items-center gap-3">
                      <div *ngIf="!row.candidatePicture" class="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex items-center justify-center font-black text-sm shadow-lg shrink-0">
                        {{ getInitials(row.candidateName) }}
                      </div>
                      <img *ngIf="row.candidatePicture" [src]="row.candidatePicture" class="w-11 h-11 rounded-2xl object-cover shadow-lg shrink-0" alt="Candidate picture" />
                      <div>
                        <p class="text-sm font-black text-slate-900 leading-tight">{{ row.candidateName }}</p>
                        <p class="text-[11px] text-slate-400 font-bold">{{ row.candidateEmail || 'No email' }}</p>
                      </div>
                    </div>
                  </td>

                  <td class="px-8 py-6">
                    <p class="text-sm font-black text-slate-900 leading-tight">{{ row.jobTitle }}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Application #{{ row.applicationId }}</p>
                  </td>

                  <td class="px-6 py-6">
                    <span [class]="getInterviewTypeClass(row.interviewTypeRaw)">
                      {{ row.interviewTypeLabel }}
                    </span>
                  </td>

                  <td class="px-6 py-6">
                    <span [class]="getInterviewModeClass(row.interviewModeRaw)">
                      {{ row.interviewModeLabel }}
                    </span>
                  </td>

                  <td class="px-8 py-6">
                    <p class="text-sm font-black text-slate-800 leading-tight">{{ row.responsibleName }}</p>
                    <p class="text-[11px] text-slate-400 font-bold">{{ row.responsibleEmail || 'No email' }}</p>
                  </td>

                  <td class="px-8 py-6">
                    <p *ngIf="row.scheduledAt" class="text-sm font-black text-slate-900 leading-tight">{{ row.scheduledAt | date:'MMM d, y' }}</p>
                    <p *ngIf="row.scheduledAt" class="text-[11px] text-slate-400 font-bold">{{ row.scheduledAt | date:'shortTime' }}</p>
                    <p *ngIf="!row.scheduledAt" class="text-xs font-black text-amber-600 uppercase tracking-widest">Not Scheduled</p>
                  </td>

                  <td class="px-6 py-6 text-center">
                    <span [class]="getStatusClass(row.statusRaw)">
                      {{ row.statusLabel }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <ng-template #emptyState>
          <div class="py-24 text-center">
            <h3 class="text-2xl font-black text-slate-900 mb-2">No interviews found</h3>
            <p class="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Try adjusting filters or schedule a new interview</p>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 999px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
    .custom-scroll::-webkit-scrollbar { width: 4px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    @keyframes fadeInSlide {
      from { opacity: 0; transform: translateY(-10px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .animate-in { animation: fadeInSlide 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
  `]
})
export class CompanyInterviewsComponent implements OnInit {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);

  loading = signal(false);
  interviews = signal<InterviewRow[]>([]);
  searchQuery = signal('');
  typeFilter = signal('all');
  modeFilter = signal('all');
  statusFilter = signal('all');
  isTypeFilterOpen = signal(false);
  isModeFilterOpen = signal(false);
  isStatusFilterOpen = signal(false);

  readonly typeFilterOptions: FilterOption[] = [
    { value: 'all', label: 'All Types' },
    { value: 'test_technique', label: 'Technical Test' },
    { value: 'test_rh_telephonique', label: 'HR Phone Screen' },
    { value: 'test_rh_video', label: 'HR Video Interview' },
    { value: 'test_psychotechnique', label: 'Psychometric Test' },
  ];

  readonly modeFilterOptions: FilterOption[] = [
    { value: 'all', label: 'All Modes' },
    { value: 'online', label: 'Online (Remote)' },
    { value: 'presentiel', label: 'In-Person' },
  ];

  readonly statusFilterOptions: FilterOption[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  totalInterviews = computed(() => this.interviews().length);
  upcomingInterviews = computed(() => {
    const now = Date.now();
    return this.interviews().filter((item) => {
      if (!item.scheduledAt) return false;
      const when = new Date(item.scheduledAt).getTime();
      return Number.isFinite(when) && when >= now;
    }).length;
  });
  onlineInterviews = computed(() => this.interviews().filter((item) => item.interviewModeRaw === 'online').length);

  filteredInterviews = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const type = this.typeFilter();
    const mode = this.modeFilter();
    const status = this.statusFilter();

    return this.interviews().filter((row) => {
      if (type !== 'all' && row.interviewTypeRaw !== type) return false;
      if (mode !== 'all') {
        if (mode === 'presentiel') {
          if (!['presentiel', 'in_person', 'onsite'].includes(row.interviewModeRaw)) return false;
        } else if (row.interviewModeRaw !== mode) {
          return false;
        }
      }
      if (status !== 'all' && row.statusRaw !== status) return false;

      if (!q) return true;

      const haystack = [
        row.candidateName,
        row.candidateEmail,
        row.jobTitle,
        row.interviewTypeLabel,
        row.interviewModeLabel,
        row.responsibleName,
        row.responsibleEmail,
        row.statusLabel,
      ].join(' ').toLowerCase();

      return haystack.includes(q);
    });
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('#interview-type-filter-dropdown')) {
      this.isTypeFilterOpen.set(false);
    }
    if (!target?.closest('#interview-mode-filter-dropdown')) {
      this.isModeFilterOpen.set(false);
    }
    if (!target?.closest('#interview-status-filter-dropdown')) {
      this.isStatusFilterOpen.set(false);
    }
  }

  toggleTypeFilter(event: Event): void {
    event.stopPropagation();
    this.isModeFilterOpen.set(false);
    this.isStatusFilterOpen.set(false);
    this.isTypeFilterOpen.update((value) => !value);
  }

  toggleModeFilter(event: Event): void {
    event.stopPropagation();
    this.isTypeFilterOpen.set(false);
    this.isStatusFilterOpen.set(false);
    this.isModeFilterOpen.update((value) => !value);
  }

  toggleStatusFilter(event: Event): void {
    event.stopPropagation();
    this.isTypeFilterOpen.set(false);
    this.isModeFilterOpen.set(false);
    this.isStatusFilterOpen.update((value) => !value);
  }

  selectTypeFilter(value: string): void {
    this.typeFilter.set(value);
    this.isTypeFilterOpen.set(false);
  }

  selectModeFilter(value: string): void {
    this.modeFilter.set(value);
    this.isModeFilterOpen.set(false);
  }

  selectStatusFilter(value: string): void {
    this.statusFilter.set(value);
    this.isStatusFilterOpen.set(false);
  }

  getTypeFilterLabel(): string {
    return this.getFilterLabel(this.typeFilterOptions, this.typeFilter(), 'All Types');
  }

  getModeFilterLabel(): string {
    return this.getFilterLabel(this.modeFilterOptions, this.modeFilter(), 'All Modes');
  }

  getStatusFilterLabel(): string {
    return this.getFilterLabel(this.statusFilterOptions, this.statusFilter(), 'All Statuses');
  }

  ngOnInit(): void {
    this.loadInterviews();
  }

  loadInterviews(): void {
    this.loading.set(true);
    this.apiService.get<any>('company/applicants').subscribe({
      next: (res) => {
        if (!res?.success) {
          this.notificationService.error(res?.message || 'Could not load interviews.');
          this.interviews.set([]);
          return;
        }

        const rows = this.buildRows(Array.isArray(res?.data) ? res.data : []);
        this.interviews.set(rows);
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Could not load interviews.');
        this.interviews.set([]);
        this.loading.set(false);
      },
      complete: () => {
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
    return `${base} bg-blue-50 text-blue-700 border border-blue-100`;
  }

  private buildRows(applications: any[]): InterviewRow[] {
    const rows: InterviewRow[] = [];
    const seen = new Set<string>();

    for (const app of applications || []) {
      const interviews = this.collectInterviews(app);
      if (!interviews.length) continue;

      const recruiters = this.collectRecruiters(app);
      const candidateName = `${app?.candidate?.first_name || ''} ${app?.candidate?.last_name || ''}`.trim() || 'Unknown Candidate';
      const candidateEmail = String(app?.candidate?.user?.email || '').trim();
      const candidatePicture = app?.candidate?.picture ? String(app.candidate.picture) : null;
      const jobTitle = String(app?.job_offer?.title || app?.jobOffer?.title || 'Untitled Job').trim();
      const jobOfferId = this.toPositiveNumber(app?.job_offer_id ?? app?.jobOffer?.id);
      const applicationId = this.toPositiveNumber(app?.id) || 0;

      for (const interview of interviews) {
        const interviewId = this.toPositiveNumber(interview?.id);
        const typeRaw = this.normalizeInterviewType(interview?.interview_type ?? interview?.type);
        const modeRaw = this.normalizeInterviewMode(interview?.interview_mode ?? interview?.mode);
        const statusRaw = this.normalizeInterviewStatus(interview?.status);
        const scheduledAt = this.toDateStringOrNull(interview?.scheduled_at ?? interview?.scheduledAt);
        const createdAt = this.toDateStringOrNull(interview?.created_at ?? interview?.createdAt);
        const recruiterId = this.toPositiveNumber(interview?.recruiter_id ?? interview?.interview_recruiter_id);
        const responsible = this.resolveResponsible(interview, recruiters, recruiterId, typeRaw);
        const key = interviewId
          ? `interview:${interviewId}`
          : `app:${applicationId}|type:${typeRaw}|mode:${modeRaw}|at:${scheduledAt || createdAt || 'na'}|rid:${recruiterId || 'na'}`;

        if (seen.has(key)) continue;
        seen.add(key);

        rows.push({
          key,
          interviewId,
          applicationId,
          jobOfferId,
          candidateName,
          candidateEmail,
          candidatePicture,
          jobTitle,
          interviewTypeRaw: typeRaw,
          interviewTypeLabel: this.formatInterviewType(typeRaw),
          interviewModeRaw: modeRaw,
          interviewModeLabel: this.formatInterviewMode(modeRaw),
          responsibleName: responsible.name,
          responsibleEmail: responsible.email,
          scheduledAt,
          createdAt,
          statusRaw,
          statusLabel: this.formatInterviewStatus(statusRaw),
          notes: String(interview?.notes || '').trim(),
        });
      }
    }

    return rows.sort((a, b) => this.compareRows(a, b));
  }

  private collectInterviews(app: any): any[] {
    const list: any[] = [];
    if (Array.isArray(app?.interviews)) list.push(...app.interviews.filter(Boolean));
    if (Array.isArray(app?.interview_list)) list.push(...app.interview_list.filter(Boolean));
    if (app?.interview) list.push(app.interview);
    if (app?.current_interview) list.push(app.current_interview);
    return list;
  }

  private collectRecruiters(app: any): any[] {
    const recruiters = app?.job_offer?.recruiters ?? app?.jobOffer?.recruiters ?? [];
    return Array.isArray(recruiters) ? recruiters.filter(Boolean) : [];
  }

  private resolveResponsible(interview: any, recruiters: any[], recruiterId: number | null, typeRaw: string): { name: string; email: string } {
    const interviewRecruiter = interview?.recruiter;
    if (interviewRecruiter?.full_name) {
      return {
        name: String(interviewRecruiter.full_name).trim(),
        email: String(interviewRecruiter?.user?.email || '').trim(),
      };
    }

    if (recruiterId) {
      const assigned = recruiters.find((r: any) => this.toPositiveNumber(r?.id) === recruiterId);
      if (assigned) {
        return {
          name: String(assigned?.full_name || `Recruiter #${recruiterId}`).trim(),
          email: String(assigned?.user?.email || '').trim(),
        };
      }
      return {
        name: `Recruiter #${recruiterId}`,
        email: '',
      };
    }

    if (['test_rh_telephonique', 'test_rh_video', 'test_psychotechnique'].includes(typeRaw)) {
      return { name: 'Company HR Team', email: '' };
    }

    return { name: 'Unassigned', email: '' };
  }

  private compareRows(a: InterviewRow, b: InterviewRow): number {
    const now = Date.now();
    const aTime = this.toTimestamp(a.scheduledAt ?? a.createdAt);
    const bTime = this.toTimestamp(b.scheduledAt ?? b.createdAt);

    const aUpcoming = aTime !== null && aTime >= now;
    const bUpcoming = bTime !== null && bTime >= now;

    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    if (aUpcoming && bUpcoming && aTime !== null && bTime !== null) return aTime - bTime;
    if (!aUpcoming && !bUpcoming && aTime !== null && bTime !== null) return bTime - aTime;

    return b.applicationId - a.applicationId;
  }

  private normalizeInterviewType(value: unknown): string {
    return String(value || '').trim().toLowerCase() || 'unknown';
  }

  private normalizeInterviewMode(value: unknown): string {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'in_person' || raw === 'onsite') return 'presentiel';
    return raw || 'unknown';
  }

  private normalizeInterviewStatus(value: unknown): string {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'canceled') return 'cancelled';
    return raw || 'pending';
  }

  private formatInterviewType(typeRaw: string): string {
    switch (typeRaw) {
      case 'test_technique':
        return 'Technical';
      case 'test_rh_telephonique':
        return 'HR Phone';
      case 'test_rh_video':
        return 'HR Video';
      case 'test_psychotechnique':
        return 'Psychometric';
      case 'unknown':
        return 'Interview';
      default:
        return this.titleize(typeRaw.replace(/_/g, ' '));
    }
  }

  private formatInterviewMode(modeRaw: string): string {
    switch (modeRaw) {
      case 'online':
        return 'Online';
      case 'presentiel':
        return 'In Person';
      case 'unknown':
        return 'Unknown';
      default:
        return this.titleize(modeRaw.replace(/_/g, ' '));
    }
  }

  private formatInterviewStatus(statusRaw: string): string {
    if (statusRaw === 'pending') return 'Pending';
    if (statusRaw === 'completed') return 'Completed';
    if (statusRaw === 'cancelled') return 'Cancelled';
    return this.titleize(statusRaw.replace(/_/g, ' '));
  }

  private titleize(value: string): string {
    return String(value || '')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getFilterLabel(options: FilterOption[], value: string, fallback: string): string {
    return options.find((option) => option.value === value)?.label || fallback;
  }

  private toPositiveNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private toTimestamp(value: string | null): number | null {
    if (!value) return null;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
  }

  private toDateStringOrNull(value: unknown): string | null {
    if (!value) return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

}


