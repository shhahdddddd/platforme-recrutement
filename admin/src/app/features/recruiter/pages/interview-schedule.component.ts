import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-recruiter-interview-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-[#F8FAFC] pb-20">
      <div class="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div class="max-w-5xl mx-auto px-6 h-24 flex items-center justify-between">
          <div class="flex items-center gap-6">
            <button
              (click)="goBack()"
              class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all border border-transparent active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">Schedule</span>
                <span class="text-slate-300">/</span>
                <span class="text-slate-500 font-bold text-xs uppercase tracking-widest">Recruiter Action</span>
              </div>
              <h1 class="text-xl font-black text-slate-900 tracking-tight">Set Interview Date</h1>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button (click)="goBack()" class="px-6 h-12 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all text-xs uppercase tracking-widest">Cancel</button>
            <button
              (click)="submit()"
              [disabled]="isSubmitting() || !application() || !currentInterview()"
              class="px-8 h-12 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-[0.1em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-3 active:scale-95"
            >
              <svg *ngIf="!isSubmitting()" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
              <svg *ngIf="isSubmitting()" class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"/></svg>
              {{ isSubmitting() ? 'Saving...' : 'Save Date' }}
            </button>
          </div>
        </div>
      </div>

      <div class="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <div *ngIf="isLoadingApp()" class="animate-pulse space-y-6">
              <div class="w-24 h-24 bg-slate-100 rounded-3xl"></div>
              <div class="h-6 bg-slate-100 rounded-full w-3/4"></div>
              <div class="h-4 bg-slate-100 rounded-full w-1/2"></div>
            </div>

            <div *ngIf="!isLoadingApp() && application()" class="space-y-8">
              <div class="relative inline-block">
                <div *ngIf="!application().candidate?.picture" class="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-black text-3xl shadow-xl">
                  {{ application().candidate?.first_name?.[0] }}{{ application().candidate?.last_name?.[0] }}
                </div>
                <img *ngIf="application().candidate?.picture" [src]="application().candidate.picture" class="w-24 h-24 rounded-[2rem] object-cover shadow-xl" />
              </div>

              <div>
                <h2 class="text-3xl font-black text-slate-900 tracking-tight mb-2 leading-none">
                  {{ application().candidate?.first_name }} <br />
                  <span class="text-blue-600">{{ application().candidate?.last_name }}</span>
                </h2>
                <div class="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="13" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  {{ application().job_offer?.title }}
                </div>
              </div>

              <div class="pt-8 border-t border-slate-50 space-y-4">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <span class="text-xs font-bold text-slate-600 truncate">{{ application().candidate?.user?.email }}</span>
                </div>
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <span class="text-xs font-bold text-slate-600">{{ application().candidate?.phone || 'Not provided' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2 space-y-10">
          <section class="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm" *ngIf="currentInterview() as interview">
            <div class="flex items-center gap-4 mb-8">
              <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/20">01</div>
              <h3 class="text-lg font-black text-slate-900 tracking-tight">Assigned Interview</h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Type</p>
                <p class="text-base font-black text-slate-900">{{ interviewTypeLabel(interview?.interview_type || interview?.type) }}</p>
              </div>
              <div class="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Mode</p>
                <p class="text-base font-black text-slate-900">{{ interviewModeLabel(interview?.interview_mode || interview?.mode) }}</p>
              </div>
              <div class="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Duration</p>
                <p class="text-base font-black text-slate-900">{{ interview?.duration_minutes || 'Not set' }}<span *ngIf="interview?.duration_minutes"> min</span></p>
              </div>
              <div class="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Current Date</p>
                <p class="text-base font-black text-slate-900">{{ interview?.scheduled_at ? (interview.scheduled_at | date:'medium') : 'Not scheduled yet' }}</p>
              </div>
            </div>

            <div *ngIf="interview?.notes" class="mt-4 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
              <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Notes from RH</p>
              <p class="text-sm font-bold text-slate-700 leading-relaxed">{{ interview.notes }}</p>
            </div>
          </section>

          <section>
            <div class="flex items-center gap-4 mb-8">
              <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/20">02</div>
              <h3 class="text-lg font-black text-slate-900 tracking-tight">Date & Time</h3>
            </div>

            <div class="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
              <div class="relative group cursor-pointer focus-within:ring-4 focus-within:ring-blue-500/10 rounded-[1.5rem] transition-all">
                <input
                  type="datetime-local"
                  [(ngModel)]="form.scheduled_at"
                  [min]="minDate"
                  class="w-full relative z-10 bg-transparent border-2 border-slate-100 group-hover:border-blue-200 group-focus-within:border-blue-600 rounded-[1.5rem] pl-8 pr-16 py-5 font-black text-lg text-slate-900 transition-all outline-none cursor-pointer custom-date-input"
                >

                <div class="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 group-hover:text-blue-500 transition-colors pointer-events-none z-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                    <line x1="16" x2="16" y1="2" y2="6"/>
                    <line x1="8" x2="8" y1="2" y2="6"/>
                    <line x1="3" x2="21" y1="10" y2="10"/>
                    <path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
                  </svg>
                </div>
              </div>

              <div class="mt-4 rounded-[1.5rem] border-2 border-slate-100 px-6 py-4 flex items-center justify-between hover:border-blue-200 transition-all group">
                <div>
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Estimated Duration</p>
                  <p class="text-xs font-bold text-slate-600">How long will this interview take?</p>
                </div>
                <div class="flex items-center gap-3">
                  <input type="number" [(ngModel)]="form.duration_minutes" min="15" max="240" step="15"
                         class="w-20 bg-white border-2 border-slate-100 rounded-xl px-3 py-2 font-black text-center text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition-all outline-none">
                  <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Min</span>
                </div>
              </div>

              <div class="mt-6 rounded-[1.5rem] border border-blue-100 bg-blue-50/60 px-6 py-5">
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-2">Candidate notification</p>
                <p class="text-sm font-bold text-slate-700 leading-relaxed">
                  Once you save this date, the candidate will receive a notification and an email with this exact interview date and time.
                </p>
              </div>
            </div>
          </section>

          <div class="pt-10 border-t border-slate-100 flex flex-col items-center">
            <div class="mb-10 text-center space-y-2">
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 animate-pulse">Candidate Facing Update</p>
              <p class="text-xs font-bold text-slate-400 max-w-md">The date saved here is the same date that will appear in the candidate notification and email.</p>
            </div>
            <button
              (click)="submit()"
              [disabled]="isSubmitting() || !application() || !currentInterview()"
              class="w-full max-w-xl py-8 rounded-[2.5rem] bg-blue-600 text-white font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-4 active:scale-[0.98]"
            >
              Confirm Interview Date
              <svg *ngIf="!isSubmitting()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              <svg *ngIf="isSubmitting()" class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .custom-date-input {
      color: #0F172A;
    }
    .custom-date-input::-webkit-calendar-picker-indicator {
      opacity: 0;
      cursor: pointer;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
    .custom-date-input::-webkit-datetime-edit {
      padding-left: 0.5rem;
    }
    .custom-date-input::-webkit-datetime-edit-fields-wrapper {
      background: transparent;
    }
    .custom-date-input::-webkit-datetime-edit-text {
      color: #94A3B8;
      padding: 0 0.2rem;
    }
  `]
})
export class RecruiterInterviewScheduleComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  application = signal<any>(null);
  currentInterview = signal<any | null>(null);
  isLoadingApp = signal(true);
  isSubmitting = signal(false);
  jobId = signal<string | null>(null);

  form = {
    scheduled_at: '',
    duration_minutes: 45,
  };

  minDate = '';

  assignedRecruiterName = computed(() => {
    const interview = this.currentInterview();
    return interview?.recruiter?.full_name || 'Assigned recruiter';
  });

  ngOnInit(): void {
    this.setMinDate();

    const applicationId = history.state.applicationId;
    const jobId = history.state.jobId;

    if (jobId) {
      this.jobId.set(jobId);
    }

    if (applicationId) {
      this.loadApplicationData(String(applicationId));
      return;
    }

    this.navigateBackToApplicants();
  }

  private setMinDate(): void {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());

    const earliest = new Date(today.getTime() + 60 * 60 * 1000);
    earliest.setSeconds(0, 0);

    this.minDate = earliest.toISOString().slice(0, 16);
    this.form.scheduled_at = this.minDate;
  }

  private loadApplicationData(id: string): void {
    this.isLoadingApp.set(true);
    this.apiService.get<any>('company/applicants').subscribe({
      next: (res) => {
        if (!res?.success) {
          this.notificationService.error(res?.message || 'Application not found.');
          this.isLoadingApp.set(false);
          this.navigateBackToApplicants();
          return;
        }

        const app = Array.isArray(res?.data)
          ? res.data.find((item: any) => String(item?.id) === id)
          : null;

        if (!app) {
          this.notificationService.error('Application not found.');
          this.isLoadingApp.set(false);
          this.navigateBackToApplicants();
          return;
        }

        const assignedInterview = this.resolveAssignedInterview(app);
        if (!assignedInterview) {
          this.notificationService.error('No interview assignment was found for you on this application.');
          this.isLoadingApp.set(false);
          this.navigateBackToApplicants();
          return;
        }

        this.application.set(app);
        this.currentInterview.set(assignedInterview);

        const existingDate = this.toLocalDateTimeInputValue(assignedInterview?.scheduled_at);
        if (existingDate) {
          this.form.scheduled_at = existingDate;
        }

        this.isLoadingApp.set(false);
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Error while loading.');
        this.isLoadingApp.set(false);
        this.navigateBackToApplicants();
      }
    });
  }

  goBack(): void {
    this.navigateBackToApplicants();
  }

  private navigateBackToApplicants(): void {
    const jobId = this.jobId();
    if (jobId) {
      this.router.navigate(['/recruiter/applicants'], { state: { jobId } });
      return;
    }

    this.router.navigate(['/recruiter/applicants']);
  }

  submit(): void {
    const interview = this.currentInterview();
    if (this.isSubmitting() || !this.application() || !interview) {
      return;
    }

    if (!this.form.scheduled_at) {
      this.notificationService.warning('Please choose the interview date and time.');
      return;
    }

    this.isSubmitting.set(true);

    this.apiService.patch<any>(`company/recruiter/interviews/${interview.id}/schedule`, {
      scheduled_at: this.form.scheduled_at,
      duration_minutes: this.form.duration_minutes,
    }).subscribe({
      next: (res) => {
        if (res?.success) {
          this.notificationService.success('Interview scheduled. The candidate has been notified via push notification and email.');
          this.navigateBackToApplicants();
        } else {
          this.notificationService.error(res?.message || 'Could not save the interview date.');
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Server error while saving the interview date.');
        this.isSubmitting.set(false);
      }
    });
  }

  interviewTypeLabel(value: unknown): string {
    const raw = String(value || '').trim().toLowerCase();
    switch (raw) {
      case 'test_technique':
        return 'Technical interview';
      case 'test_rh_telephonique':
        return 'HR phone';
      case 'test_rh_video':
        return 'HR video';
      case 'test_psychotechnique':
        return 'Psychometric';
      default:
        return raw ? raw.replace(/_/g, ' ') : 'Interview';
    }
  }

  interviewModeLabel(value: unknown): string {
    const raw = String(value || '').trim().toLowerCase();
    switch (raw) {
      case 'online':
        return 'Online';
      case 'presentiel':
      case 'in_person':
      case 'onsite':
        return 'In person';
      default:
        return raw ? raw.replace(/_/g, ' ') : 'Not set';
    }
  }

  private resolveAssignedInterview(app: any): any | null {
    const recruiterId = this.currentRecruiterId();
    if (!recruiterId) {
      return null;
    }

    const interviews = this.collectInterviews(app).filter((item: any) => {
      const assignedId = this.toPositiveNumber(
        item?.recruiter_id ?? item?.interview_recruiter_id ?? item?.recruiter?.id
      );

      return assignedId === recruiterId;
    });

    if (!interviews.length) {
      return null;
    }

    interviews.sort((left: any, right: any) => this.interviewTimestamp(right) - this.interviewTimestamp(left));
    return interviews[0] ?? null;
  }

  private collectInterviews(app: any): any[] {
    const list: any[] = [];
    const sources = [app?.interviews, app?.interview_list, app?.interviewList];

    for (const source of sources) {
      if (Array.isArray(source)) {
        list.push(...source.filter(Boolean));
      } else if (source && typeof source === 'object' && source.constructor === Object) {
        list.push(...Object.values(source).filter((item: any) => item && typeof item === 'object'));
      }
    }

    if (app?.interview) list.push(app.interview);
    if (app?.current_interview) list.push(app.current_interview);

    return list;
  }

  private currentRecruiterId(): number | null {
    const currentUser = this.authService.getCurrentUser() as any;
    const candidates = [
      currentUser?.profile?.id,
      currentUser?.profile?.recruiter_id,
      currentUser?.recruiter?.id,
      currentUser?.recruiter_id,
    ];

    for (const value of candidates) {
      const normalized = this.toPositiveNumber(value);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private interviewTimestamp(interview: any): number {
    const raw = interview?.scheduled_at || interview?.created_at || interview?.updated_at;
    const parsed = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toPositiveNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  private toLocalDateTimeInputValue(value: unknown): string {
    if (!value) {
      return '';
    }

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
}
