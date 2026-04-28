import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-recruiter-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-7xl mx-auto py-10 px-4 font-['Outfit']">
      <!-- Header Area -->
      <div class="flex items-center justify-between mb-10">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">
            Department <span class="text-blue-600">{{ currentUser()?.recruiter?.department?.name || 'Recruitment' }}</span>
          </h1>
          <p class="text-slate-500 font-medium tracking-tight">Monitoring job offers and applicants for your assigned department.</p>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex items-center gap-6 relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full blur-2xl opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
          <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div>
            <h3 class="text-3xl font-black text-slate-900 tracking-tight">{{ stats().active_jobs }}</h3>
            <p class="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Active Job Offers</p>
          </div>
        </div>

        <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex items-center gap-6 relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full blur-2xl opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
          <div class="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <h3 class="text-3xl font-black text-slate-900 tracking-tight">{{ stats().total_applicants }}</h3>
            <p class="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Total Pool Applicants</p>
          </div>
        </div>
      </div>

      <!-- Main Listing Section -->
      <div class="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
        <div class="p-8 border-b border-slate-50 flex items-center justify-between">
           <h2 class="font-black text-slate-900 text-lg uppercase tracking-tight">Departmental Vacancies</h2>
           <span class="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase rounded-lg tracking-widest">Total: {{ jobs().length }}</span>
        </div>

        <div class="divide-y divide-slate-50">
          <div *ngIf="jobs().length === 0" class="py-20 flex flex-col items-center justify-center text-center">
             <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <svg class="text-slate-300" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             </div>
             <h4 class="font-bold text-slate-800">No job offers found</h4>
             <p class="text-slate-400 text-sm mt-1 max-w-xs">Your department has no active job postings at the moment.</p>
          </div>

          <div *ngFor="let job of jobs()" class="p-8 hover:bg-slate-50 transition-colors group">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div class="flex items-start gap-5">
                <div [class]="'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ' + (job.status === 'open' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2 4-4"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/></svg>
                </div>
                <div>
                  <div class="flex items-center gap-3">
                    <button (click)="viewJobDetails(job)" class="group/title text-left">
                      <h3 class="font-black text-slate-900 text-lg tracking-tight group-hover/title:text-blue-600 transition-colors">{{ job.title }}</h3>
                    </button>
                    <span [class]="'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ' + (job.status === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')">
                      {{ job.status === 'open' ? 'Active' : 'Closed' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                    <div class="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-tight">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {{ job.location }}
                    </div>
                    <div class="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-tight">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7 12 12 3 7"/><polyline points="21 14 12 19 3 14"/><path d="M21 7v7"/><path d="M3 7v7"/></svg>
                      {{ job.offer_type }}
                    </div>
                    <div class="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-tight">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      {{ job.applications_count || 0 }} Applicants
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-3 self-end md:self-center">
                 <button 
                   (click)="viewJobDetails(job)"
                   class="h-12 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 flex items-center gap-2"
                 >
                   Details
                 </button>
                 <a 
                   (click)="navigateToApplicants(job.id)"
                   class="h-12 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                   Applicants
                 </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Job Details Modal -->
      <div *ngIf="selectedJob()" class="fixed inset-0 z-[1000] flex items-center justify-center p-4 transition-all animate-in fade-in duration-300">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" (click)="closeJobModal()"></div>
        
        <div class="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
          <!-- Modal Header -->
          <div class="px-10 py-10 bg-white flex items-center justify-between border-b border-slate-50 shrink-0">
             <div class="flex items-center gap-6">
                <div [class]="'w-20 h-20 rounded-[2rem] flex items-center justify-center shrink-0 ' + (selectedJob().status === 'open' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/></svg>
                </div>
                <div>
                   <div class="flex items-center gap-3 mb-2">
                     <h2 class="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                       {{ selectedJob().title }}
                     </h2>
                     <span [class]="'px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ' + (selectedJob().status === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')">
                       {{ selectedJob().status === 'open' ? 'Active' : 'Closed' }}
                     </span>
                   </div>
                    <div class="flex items-center gap-6">
                       <div class="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                         {{ selectedJob().location }}
                       </div>
                       <div class="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z"/><path d="m9 11 2 2 4-4"/></svg>
                         {{ selectedJob().offer_type === 'internship' ? 'INTERNSHIP' : 'JOB OFFER' }} - {{ selectedJob().offer_type?.toUpperCase() }}
                       </div>
                    </div>
                </div>
             </div>
             <button (click)="closeJobModal()" class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
             </button>
          </div>

          <!-- Modal Body -->
          <div class="flex-1 p-10 overflow-y-auto custom-scrollbar">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <!-- Left Column: Description -->
              <div class="lg:col-span-2 space-y-8">
                <div>
                   <h3 class="text-xs font-black text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                     <span class="w-1 h-4 bg-blue-600 rounded-full"></span>
                     Job Description
                   </h3>
                   <div class="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                     {{ selectedJob().description }}
                   </div>
                </div>

                <div *ngIf="selectedJob().budget">
                   <h3 class="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <span class="w-1 h-4 bg-blue-600 rounded-full"></span>
                     Compensation Package
                   </h3>
                   <div class="p-6 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 font-black text-lg">
                     {{ selectedJob().budget | currency:'TND':'symbol':'1.0-0' }} <span class="text-xs opacity-60">/ Monthly</span>
                   </div>
                </div>
              </div>

              <!-- Right Column: Requirements & Stats -->
              <div class="space-y-8">
                <div>
                   <h3 class="text-xs font-black text-violet-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                     <span class="w-1 h-4 bg-violet-600 rounded-full"></span>
                     Professional Requirements
                   </h3>
                   <div class="space-y-4">
                      <!-- Academic -->
                      <div class="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                         <div class="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                         </div>
                         <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Pedigree</p>
                            <p class="text-sm font-black text-slate-900">{{ parseRequirement(selectedJob(), 'required_degrees') || 'Any Degree' }}</p>
                         </div>
                      </div>

                      <!-- Experience -->
                      <div *ngIf="selectedJob().offer_type !== 'internship'" class="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                         <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                         </div>
                         <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience Level</p>
                            <p class="text-sm font-black text-slate-900">{{ parseRequirement(selectedJob(), 'experience_levels') || 'All levels' }}</p>
                         </div>
                      </div>

                      <!-- Internship specific -->
                      <div *ngIf="selectedJob().offer_type === 'internship'" class="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                         <div class="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                         </div>
                         <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</p>
                            <p class="text-sm font-black text-slate-900">{{ (selectedJob().internship_requirements?.[0]?.duration_months) }} Months Internship</p>
                         </div>
                      </div>
                   </div>
                </div>

                <div>
                   <h3 class="text-xs font-black text-emerald-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                     <span class="w-1 h-4 bg-emerald-600 rounded-full"></span>
                     Target Alignment
                   </h3>
                   <div class="flex flex-wrap gap-2">
                      <div class="px-5 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-900 uppercase tracking-widest">
                        {{ selectedJob().applications_count || 0 }} Applications Received
                      </div>
                      <div class="px-5 py-3 rounded-2xl bg-violet-50 border border-violet-100 text-[10px] font-black text-violet-600 uppercase tracking-widest">
                        AI RANKED
                      </div>
                      <div class="px-5 py-3 rounded-2xl bg-blue-50 border border-blue-100 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                        {{ getContractLabel(selectedJob().contract_type_detail) }}
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="px-10 py-8 bg-white border-t border-slate-50 flex items-center justify-between shrink-0">
             <button (click)="closeJobModal()" class="px-8 py-4 rounded-xl font-black text-xs text-slate-400 uppercase tracking-widest hover:bg-slate-50">Dismiss</button>
             <div class="flex gap-4">
                <a 
                  (click)="navigateToApplicants(selectedJob().id)"
                  (click)="closeJobModal()"
                  class="px-10 py-5 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 cursor-pointer"
                >
                   Applicants
                </a>
             </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
  `]
})
export class RecruiterDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);
  jobs = signal<any[]>([]);
  stats = signal<any>({ active_jobs: 0, total_applicants: 0 });
  currentUser = computed(() => this.authService.getCurrentUser() as any);
  selectedJob = signal<any>(null);

  ngOnInit(): void {
    this.loadStats();
    this.loadJobs();
  }

  navigateToApplicants(jobId: number) {
    this.router.navigate(['/recruiter/applicants'], { state: { jobId } });
  }

  loadStats() {
    this.api.get<any>('company/dashboard-stats').subscribe({
      next: (res) => {
        if (res.success) {
          this.stats.set(res.data);
        }
      }
    });
  }

  loadJobs() {
    this.api.get<any>('company/job-offers').subscribe({
      next: (res) => {
        if (res.success) {
          this.jobs.set(res.data || []);
        }
      }
    });
  }

  viewJobDetails(job: any) {
    this.selectedJob.set(job);
  }

  closeJobModal() {
    this.selectedJob.set(null);
  }

  parseRequirement(job: any, field: string): string {
    const reqs = job.offer_type === 'internship' ? job.internship_requirements : job.job_requirements;
    if (!reqs || reqs.length === 0) return '';
    
    const val = reqs[0][field];
    if (!val) return '';
    
    try {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      return Array.isArray(parsed) ? parsed.join(', ') : parsed;
    } catch (e) {
      return val;
    }
  }

  getContractLabel(val: string): string {
    const contracts: Record<string, string> = {
      'CDI': 'CDI',
      'CID': 'CDI',
      'CDD': 'CDD',
      'CVP': 'CIVP',
      'CIVP': 'CIVP',
      'ALTERNANCE': 'Alternance',
      'INTERNSHIP': 'Internship'
    };
    return contracts[val] || val || 'Full-time';
  }
}
