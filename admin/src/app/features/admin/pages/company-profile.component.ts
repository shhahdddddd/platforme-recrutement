import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-admin-company-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 font-['Outfit'] rounded-l-[40px] overflow-hidden">
      
      <!-- COVER IMAGE AREA -->
      <div class="h-32 sm:h-40 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 relative overflow-hidden rounded-b-[40px]">
        <div class="absolute inset-0 opacity-30" style="background-image: radial-gradient(circle at 2px 2px, rgba(148,163,184,0.2) 1px, transparent 0); background-size: 24px 24px;"></div>
        <!-- Floating decorative elements -->
        <div class="absolute top-4 right-20 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
        <div class="absolute bottom-4 left-40 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>

      <!-- MAIN CONTENT AREA -->
      <div class="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        
        <!-- BACK NAVIGATION -->
        <button (click)="navigateBack()" class="inline-flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-all mb-6 text-sm font-medium bg-white/90 backdrop-blur-sm shadow-lg shadow-slate-200/50 border border-white/80 px-5 py-2.5 rounded-[24px] cursor-pointer hover:shadow-xl hover:-translate-y-0.5 group">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:-translate-x-0.5 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
          Back to Companies
        </button>

        <!-- LOADING STATE -->
        <div *ngIf="isLoading()" class="flex flex-col items-center justify-center py-24 gap-4">
           <div class="w-12 h-12 border-3 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
           <p class="text-slate-500 font-medium">Loading company profile...</p>
        </div>

        <!-- MAIN CONTENT -->
        <div *ngIf="company() && !isLoading()" class="animate-in fade-in duration-700">
           
           <!-- COMPANY HEADER CARD -->
           <div class="relative bg-white/90 backdrop-blur-2xl rounded-[40px] shadow-2xl shadow-slate-200/40 border border-white/60 p-6 sm:p-8 mb-8 overflow-hidden">
              <!-- Subtle gradient overlay -->
              <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 opacity-60"></div>
              <div class="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl"></div>
              
             <div class="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <!-- COMPANY LOGO -->
                <div *ngIf="company().picture; else logoFallback" class="w-24 h-24 sm:w-28 sm:h-28 rounded-[24px] overflow-hidden shadow-xl shadow-indigo-500/20 ring-4 ring-white">
                   <img [src]="company().picture" class="w-full h-full object-cover">
                </div>
                <ng-template #logoFallback>
                   <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-[24px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-3xl shadow-xl shadow-indigo-500/20 ring-4 ring-white">
                      {{ company().name.substring(0,2).toUpperCase() }}
                   </div>
                </ng-template>
                
                <!-- COMPANY INFO -->
                <div class="flex-1 min-w-0">
                   <div class="flex flex-wrap items-center gap-3 mb-2">
                      <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{{ company().name }}</h1>
                      <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                         <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                         Verified Partner
                      </span>
                   </div>
                   <div class="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span class="flex items-center gap-1.5">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                         {{ company().location || 'Tunisia' }}
                      </span>
                      <span class="hidden sm:inline text-slate-300">•</span>
                      <span class="flex items-center gap-1.5">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                         {{ company().user?.email }}
                      </span>
                   </div>
                </div>

                <!-- STATUS INDICATOR -->
                <div class="flex flex-col items-end gap-2">
                   <div [class]="'px-4 py-2 rounded-2xl text-sm font-semibold flex items-center gap-2 ' + (company().user?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')">
                      <span [class]="'w-2 h-2 rounded-full ' + (company().user?.is_active ? 'bg-emerald-500' : 'bg-rose-500')"></span>
                      {{ company().user?.is_active ? 'Active Account' : 'Inactive Account' }}
                   </div>
                </div>
             </div>
           </div>

           <!-- PREMIUM COMPANY DETAILS GRID -->
           <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <!-- Industry Card -->
              <div class="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50/50 rounded-[40px] p-6 border border-white/80 shadow-lg shadow-slate-200/30 hover:shadow-2xl hover:shadow-indigo-200/20 hover:-translate-y-1.5 transition-all duration-300">
                 <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-violet-500"></div>
                 <div class="absolute -bottom-10 -right-10 w-20 h-20 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
                 <div class="relative flex items-center gap-4 mb-4">
                    <div class="w-12 h-12 rounded-[20px] bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200/50 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    </div>
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Industry</span>
                 </div>
                 <p class="relative text-base font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{{ company().industry?.name || 'Technology' }}</p>
              </div>

              <!-- Location Card -->
              <div class="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50/50 rounded-[40px] p-6 border border-white/80 shadow-lg shadow-slate-200/30 hover:shadow-2xl hover:shadow-emerald-200/20 hover:-translate-y-1.5 transition-all duration-300">
                 <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                 <div class="absolute -bottom-10 -right-10 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
                 <div class="relative flex items-center gap-4 mb-4">
                    <div class="w-12 h-12 rounded-[20px] bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200/50 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Location</span>
                 </div>
                 <p class="relative text-base font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">{{ company().location || 'Tunis, Tunisia' }}</p>
              </div>

              <!-- Company Type Card -->
              <div class="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50/50 rounded-[40px] p-6 border border-white/80 shadow-lg shadow-slate-200/30 hover:shadow-2xl hover:shadow-violet-200/20 hover:-translate-y-1.5 transition-all duration-300">
                 <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-500 to-purple-500"></div>
                 <div class="absolute -bottom-10 -right-10 w-20 h-20 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors"></div>
                 <div class="relative flex items-center gap-4 mb-4">
                    <div class="w-12 h-12 rounded-[20px] bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200/50 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-violet-600"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Type</span>
                 </div>
                 <p class="relative text-base font-semibold text-slate-800 group-hover:text-violet-600 transition-colors capitalize">{{ company().company_type || 'Private' }}</p>
              </div>

              <!-- Departments Card -->
              <div class="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50/50 rounded-[40px] p-6 border border-white/80 shadow-lg shadow-slate-200/30 hover:shadow-2xl hover:shadow-amber-200/20 hover:-translate-y-1.5 transition-all duration-300">
                 <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-orange-500"></div>
                 <div class="absolute -bottom-10 -right-10 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors"></div>
                 <div class="relative flex items-center gap-4 mb-4">
                    <div class="w-12 h-12 rounded-[20px] bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200/50 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-600"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Departments</span>
                 </div>
                 <p class="relative text-base font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">{{ (company().departments || []).length || 'N/A' }}</p>
              </div>
           </div>

           <!-- COMPANY BIO/DESCRIPTION -->
           <div *ngIf="company().description" class="relative mb-8 bg-gradient-to-br from-white/80 to-slate-50/50 backdrop-blur-xl rounded-[32px] p-6 border border-white/80 shadow-xl shadow-slate-200/30 overflow-hidden">
              <div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-violet-600"></div>
              <div class="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl"></div>
              
              <div class="relative flex items-center gap-3 mb-4">
                 <div class="w-10 h-10 rounded-[16px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M9 9h5"/><path d="M9 13h5"/></svg>
                 </div>
                 <span class="text-base font-bold text-slate-800">About {{ company().name }}</span>
              </div>
              <p class="relative text-slate-600 leading-relaxed text-sm pl-2 border-l-2 border-slate-100">{{ company().description }}</p>
           </div>

           <!-- PREMIUM JOB OPPORTUNITIES SECTION -->
           <div class="relative bg-gradient-to-br from-white to-slate-50/30 rounded-[40px] border border-white/80 shadow-2xl shadow-slate-200/40 overflow-hidden">
              <!-- Decorative elements -->
              <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>
              <div class="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl"></div>
              
              <div class="relative p-6 sm:p-8 border-b border-slate-100/80 bg-gradient-to-r from-slate-50/50 to-white flex items-center justify-between">
                 <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-[20px] bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 group-hover:scale-110 transition-transform">
                       <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div>
                       <h3 class="text-xl font-bold text-slate-900">Job Opportunities</h3>
                       <p class="text-sm text-slate-500">Active positions from {{ company().name }}</p>
                    </div>
                 </div>
                 <span class="px-4 py-2 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 text-sm font-semibold rounded-2xl border border-indigo-100 shadow-sm">
                    {{ (company().job_offers || company().jobOffers || []).length }} positions
                 </span>
              </div>

              <div class="relative p-6 sm:p-8">
                 <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl"></div>
                 
                 <div class="space-y-4 relative">
                    <div *ngFor="let job of (company().job_offers || company().jobOffers); let i = index" 
                         class="group relative p-6 bg-gradient-to-br from-slate-50/80 to-white rounded-[24px] border border-white/80 shadow-md shadow-slate-200/30 hover:border-indigo-300/50 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300">
                       
                       <!-- Decorative gradient accent -->
                       <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-l-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                       
                       <!-- Subtle glow on hover -->
                       <div class="absolute inset-0 rounded-[24px] bg-gradient-to-br from-indigo-500/0 to-violet-500/0 group-hover:from-indigo-500/5 group-hover:to-violet-500/5 transition-all duration-300"></div>
                       
                       <div class="relative flex items-start justify-between gap-4 pl-2">
                          <div class="flex-1 min-w-0">
                             <div class="flex items-center gap-3 mb-3">
                                <h4 class="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{{ job.title }}</h4>
                                <span [class]="'px-3 py-1 rounded-full text-xs font-semibold ' + (job.status === 'open' ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border border-emerald-200/60' : 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-600 border border-slate-200/60')">
                                   {{ job.status === 'open' ? 'Active' : 'Closed' }}
                                </span>
                             </div>
                             
                             <div class="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                <span class="flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-xl border border-slate-200/60 shadow-sm">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                   {{ job.location || company().location }}
                                </span>
                                <span *ngIf="job.salary_range" class="flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-xl border border-slate-200/60 shadow-sm">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
                                   {{ job.salary_range }}
                                </span>
                                <span class="flex items-center gap-2 text-slate-400">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                   Posted {{ (job.date_posted || job.created_at) | date:'MMM dd, yyyy' }}
                                </span>
                             </div>
                          </div>
                          
                          <div class="text-right shrink-0 flex flex-col items-end gap-2">
                             <div class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 via-violet-600 to-purple-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 group-hover:shadow-xl group-hover:shadow-indigo-500/30 transition-shadow">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                {{ job.applications_count ?? job.applications?.length ?? 0 }} applications
                             </div>
                          </div>
                       </div>
                    </div>

                    <!-- EMPTY STATE -->
                    <div *ngIf="!(company().job_offers || company().jobOffers) || (company().job_offers || company().jobOffers).length === 0" class="py-20 text-center">
                       <div class="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center shadow-inner">
                          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                       </div>
                       <h4 class="text-lg font-semibold text-slate-700 mb-2">No Job Postings Yet</h4>
                       <p class="text-sm text-slate-500 max-w-sm mx-auto">This company hasn't posted any job opportunities yet. Check back later for new openings.</p>
                    </div>
                 </div>
              </div>
           </div>
           
           <!-- FOOTER SPACING -->
           <div class="h-12"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #f8fafc; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 16px; border: 2px solid #f8fafc; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    .animate-in { animation: fadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes fadeIn {
       from { opacity: 0; transform: translateY(24px); }
       to { opacity: 1; transform: translateY(0); }
    }
    .ml-13 { margin-left: 52px; }
  `]
})
export class AdminCompanyProfileComponent implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly selectedCompanyStorageKey = 'admin_selected_company_profile';

  company = signal<any>(null);
  isLoading = signal(false);

  ngOnInit() {
    const routeCompanyId = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(routeCompanyId) && routeCompanyId > 0) {
      const selection = { companyId: routeCompanyId };
      sessionStorage.setItem(this.selectedCompanyStorageKey, JSON.stringify(selection));
      this.loadCompany(String(routeCompanyId));
      this.router.navigate(['/admin/companies/profile'], { state: selection, replaceUrl: true });
      return;
    }

    const selectedCompanyId = this.resolveSelectedCompanyId();
    if (!selectedCompanyId) {
      this.router.navigate(['/admin/companies']);
      return;
    }

    this.loadCompany(String(selectedCompanyId));
  }

  loadCompany(id: string) {
    this.isLoading.set(true);
    this.apiService.get<any>(`admin/companies/${id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.company.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  navigateBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  private resolveSelectedCompanyId(): number | null {
    const navState = this.router.getCurrentNavigation()?.extras?.state ?? {};
    const historyState = (window.history?.state || {}) as any;
    const stateCompanyId = Number((navState as any)?.companyId || historyState?.companyId);

    if (Number.isFinite(stateCompanyId) && stateCompanyId > 0) {
      sessionStorage.setItem(
        this.selectedCompanyStorageKey,
        JSON.stringify({ companyId: stateCompanyId }),
      );
      return stateCompanyId;
    }

    try {
      const cached = sessionStorage.getItem(this.selectedCompanyStorageKey);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      const cachedCompanyId = Number(parsed?.companyId);
      return Number.isFinite(cachedCompanyId) && cachedCompanyId > 0 ? cachedCompanyId : null;
    } catch {
      return null;
    }
  }
}
