import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-intern-candidates',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-7xl mx-auto py-10 px-4 font-['Outfit'] animate-in fade-in duration-500">
      <!-- Header -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 class="text-4xl font-black text-slate-900 tracking-tight mb-2">My Interns</h1>
          <p class="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">List of candidates accepted for internships</p>
        </div>
      </div>

      <!-- Internship Candidates List -->
      <div class="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/50">
                <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Intern Candidate</th>
                <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Internship Subject (Sujet)</th>
                <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Department</th>
                <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Attendance Time</th>
                <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-right">Confirmation Date</th>
                <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-center">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr *ngFor="let intern of interns()" class="hover:bg-blue-50/30 transition-all group">
                <!-- Candidate Details -->
                <td class="px-8 py-7">
                  <div class="flex items-center gap-5">
                    <div class="relative shrink-0">
                      <img
                        *ngIf="intern.candidate?.picture; else candidateInitials"
                        [src]="intern.candidate?.picture"
                        [alt]="intern.candidate?.first_name || 'Candidate'"
                        class="w-14 h-14 rounded-2xl object-cover shadow-xl shadow-blue-500/20 border border-slate-100"
                      />
                      <ng-template #candidateInitials>
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-xl shadow-xl shadow-blue-500/20 uppercase">
                          {{ intern.candidate?.first_name?.[0] }}{{ intern.candidate?.last_name?.[0] }}
                        </div>
                      </ng-template>
                      <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    </div>
                    <div>
                      <div class="font-black text-slate-900 text-base group-hover:text-blue-600 transition-colors">{{ intern.candidate?.first_name }} {{ intern.candidate?.last_name }}</div>
                      <div class="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{{ intern.candidate?.user?.email }}</div>
                    </div>
                  </div>
                </td>

                <!-- Subject (Sujet) -->
                <td class="px-8 py-7">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 border border-violet-100">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                    </div>
                    <div>
                      <div class="font-black text-slate-800 text-sm tracking-tight capitalize">{{ intern.job_offer?.title }}</div>
                      <div class="text-[10px] font-black text-violet-400 uppercase tracking-widest mt-1">Active Internship</div>
                    </div>
                  </div>
                </td>

                <!-- Department -->
                <td class="px-8 py-7">
                  <span class="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-widest border border-slate-200">
                    {{ intern.job_offer?.department?.name || 'Assigned Dept' }}
                  </span>
                </td>

                <!-- Attendance Time -->
                <td class="px-8 py-7">
                  <div class="flex flex-col items-start gap-1.5">
                    <span
                      class="px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest border"
                      [ngClass]="getAttendanceBadgeClass(intern.attendance)"
                    >
                      {{ getAttendanceLabel(intern.attendance) }}
                    </span>

                    <div *ngIf="intern.attendance_schedule?.start_time && intern.attendance_schedule?.end_time; else noAttendanceTime" class="font-black text-slate-900 text-xs">
                      {{ formatAttendanceTime(intern.attendance_schedule.start_time) }} - {{ formatAttendanceTime(intern.attendance_schedule.end_time) }}
                    </div>
                    <ng-template #noAttendanceTime>
                      <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Time not set</div>
                    </ng-template>

                    <div
                      *ngIf="intern.attendance === 'hybrid' && intern.attendance_schedule?.days?.length"
                      class="text-[10px] text-slate-500 font-black uppercase tracking-widest"
                    >
                      {{ intern.attendance_schedule.days.join(', ') }}
                    </div>
                  </div>
                </td>

                <!-- Date -->
                <td class="px-8 py-7 text-right">
                  <div class="flex flex-col items-end">
                    <div class="font-black text-slate-900 text-sm">{{ intern.updated_at | date:'MMM d, yyyy' }}</div>
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Confirmed</div>
                  </div>
                </td>

                <td class="px-8 py-7 text-center">
                  <a
                    [routerLink]="['/recruiter/chat']"
                    [state]="{ applicationId: intern.id }"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h8"/><path d="M8 8h5"/></svg>
                    Message
                  </a>
                </td>
              </tr>

              <!-- Empty State -->
              <tr *ngIf="interns().length === 0">
                <td colspan="6" class="px-8 py-32 text-center">
                  <div class="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-slate-100/50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-200"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <h3 class="text-2xl font-black text-slate-900 mb-2 tracking-tight">No intern candidates yet</h3>
                  <p class="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] max-w-xs mx-auto">Accepted internship candidates will automatically appear in this workspace.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-in {
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class InternCandidatesComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private notification = inject(NotificationService);
  
  interns = signal<any[]>([]);
  loading = signal(false);
  currentUser = computed(() => this.auth.getCurrentUser() as any);

  ngOnInit(): void {
    this.loadInterns();
  }

  loadInterns() {
    this.loading.set(true);
    this.api.get<any>('company/intern-candidates').subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.interns.set(res.data || []);
          return;
        }
        this.loadInternsFallback(res?.message);
      },
      error: (err) => {
        this.loadInternsFallback(err?.error?.message || err?.error?.error || err?.message);
      }
    });
  }

  private loadInternsFallback(primaryErrorMessage?: string) {
    this.api.get<any>('company/applicants').subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res?.success) {
          const allApps = Array.isArray(res.data) ? res.data : [];
          const interns = allApps.filter((app: any) => {
            const status = String(app?.status || '').toLowerCase().trim();
            const offerType = String(app?.job_offer?.offer_type || '').toLowerCase().trim();
            return status === 'accepted' && offerType === 'internship';
          });
          this.interns.set(interns);
          return;
        }

        this.interns.set([]);
        this.notification.error(
          primaryErrorMessage ||
          res?.message ||
          'Could not load intern candidates.'
        );
      },
      error: (fallbackErr) => {
        this.loading.set(false);
        this.interns.set([]);
        const fallbackMessage =
          fallbackErr?.error?.message ||
          fallbackErr?.error?.error ||
          fallbackErr?.message ||
          'Could not load intern candidates.';
        this.notification.error(primaryErrorMessage || fallbackMessage);
      }
    });
  }

  getAttendanceLabel(attendance: string | null | undefined): string {
    if (attendance === 'remote') return 'Remote';
    if (attendance === 'onsite') return 'On-site';
    if (attendance === 'hybrid') return 'Hybrid';
    return 'Unassigned';
  }

  getAttendanceBadgeClass(attendance: string | null | undefined): string {
    if (attendance === 'remote') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (attendance === 'onsite') {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (attendance === 'hybrid') {
      return 'bg-violet-50 text-violet-700 border-violet-200';
    }
    return 'bg-slate-100 text-slate-500 border-slate-200';
  }

  formatAttendanceTime(time: string | null | undefined): string {
    if (!time) return '--';
    const match = String(time).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return String(time);

    const rawHour = Number(match[1]);
    const minute = match[2];
    if (Number.isNaN(rawHour) || rawHour < 0 || rawHour > 23) return String(time);

    const suffix = rawHour >= 12 ? 'PM' : 'AM';
    const hour = rawHour % 12 || 12;
    return `${hour}:${minute} ${suffix}`;
  }
}
