import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Chart, PieController, ArcElement, Tooltip, Legend } from 'chart.js';

Chart.register(PieController, ArcElement, Tooltip, Legend);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-6 font-['Outfit']">
      <div class="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">System <span class="text-blue-600">Overview</span></h1>
          <p class="text-slate-500 font-medium mt-1 italic">Real-time platform performance and enterprise management.</p>
        </div>
        <div class="flex items-center gap-3">
          <button 
            (click)="refreshStats()"
            [disabled]="statsLoading()"
            class="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
          >
            <svg *ngIf="!statsLoading()" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            <svg *ngIf="statsLoading()" class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
            {{ statsLoading() ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <!-- Stats -->
        <div class="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all hover:-translate-y-1">
          <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div *ngIf="!statsLoading()" class="text-4xl font-black text-slate-900 mb-2">{{ stats().total_users | number }}</div>
          <div *ngIf="statsLoading()" class="text-4xl font-black text-slate-300 mb-2">--</div>
          <div class="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total Active Users</div>
          <div *ngIf="!statsLoading() && stats().total_users > 0 && stats().users_growth > 0" class="mt-4 text-emerald-500 text-xs font-black">+{{ stats().users_growth }}% vs last month</div>
          <div *ngIf="!statsLoading() && stats().total_users === 0" class="mt-4 text-slate-400 text-xs font-medium italic">No users registered yet</div>
        </div>

        <div class="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all hover:-translate-y-1">
          <div class="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          </div>
          <div *ngIf="!statsLoading()" class="text-4xl font-black text-slate-900 mb-2">{{ stats().total_companies | number }}</div>
          <div *ngIf="statsLoading()" class="text-4xl font-black text-slate-300 mb-2">--</div>
          <div class="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Enterprise Partners</div>
          <div *ngIf="!statsLoading() && stats().total_companies > 0 && stats().companies_growth > 0" class="mt-4 text-emerald-500 text-xs font-black">+{{ stats().companies_growth }}% vs last month</div>
          <div *ngIf="!statsLoading() && stats().total_companies === 0" class="mt-4 text-slate-400 text-xs font-medium italic">No companies registered yet</div>
        </div>

        <div class="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-900/20 border border-slate-800 transition-all hover:-translate-y-1 relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-600/20 transition-all"></div>
          <div class="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
          <div *ngIf="!statsLoading()" class="text-4xl font-black text-white mb-2">{{ stats().total_revenue | number:'1.2-2' }} <span class="text-sm font-bold text-slate-500">DT</span></div>
          <div *ngIf="statsLoading()" class="text-4xl font-black text-slate-600 mb-2">--</div>
          <div class="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Platform Revenue</div>
          <div *ngIf="!statsLoading() && stats().total_revenue > 0 && stats().revenue_growth > 0" class="mt-4 text-blue-400 text-xs font-black">+{{ stats().revenue_growth }}% vs last month</div>
          <div *ngIf="!statsLoading() && stats().total_revenue === 0" class="mt-4 text-slate-500 text-xs font-medium italic">No revenue recorded yet</div>
        </div>

        <div class="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all hover:-translate-y-1">
          <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div *ngIf="!statsLoading()" class="text-4xl font-black text-slate-900 mb-2">{{ stats().total_hires | number }}</div>
          <div *ngIf="statsLoading()" class="text-4xl font-black text-slate-300 mb-2">--</div>
          <div class="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Candidates Accepted</div>
          <div *ngIf="!statsLoading() && stats().total_hires > 0 && stats().hires_growth > 0" class="mt-4 text-emerald-500 text-xs font-black">+{{ stats().hires_growth }}% vs last month</div>
          <div *ngIf="!statsLoading() && stats().total_hires === 0" class="mt-4 text-slate-400 text-xs font-medium italic">No candidates hired yet</div>
        </div>
      </div>

      <!-- Company Type Breakdown -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <!-- Startup Count Card -->
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-[2.5rem] p-8 shadow-xl shadow-blue-500/30 border border-blue-400 transition-all hover:-translate-y-1">
          <div class="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center mb-6 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
          </div>
          <div *ngIf="!statsLoading()" class="text-4xl font-black text-white mb-2">{{ stats().total_startups | number }}</div>
          <div *ngIf="statsLoading()" class="text-4xl font-black text-white/50 mb-2">--</div>
          <div class="text-blue-100 font-bold uppercase tracking-widest text-[10px]">Startups</div>
          <div *ngIf="!statsLoading() && stats().total_startups > 0" class="mt-4 text-blue-100 text-xs font-medium">Active startups on platform</div>
          <div *ngIf="!statsLoading() && stats().total_startups === 0" class="mt-4 text-blue-200/70 text-xs font-medium italic">No startups registered yet</div>
        </div>

        <!-- Company Count Card -->
        <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[2.5rem] p-8 shadow-xl shadow-emerald-500/30 border border-emerald-400 transition-all hover:-translate-y-1">
          <div class="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center mb-6 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          </div>
          <div *ngIf="!statsLoading()" class="text-4xl font-black text-white mb-2">{{ stats().total_enterprises | number }}</div>
          <div *ngIf="statsLoading()" class="text-4xl font-black text-white/50 mb-2">--</div>
          <div class="text-emerald-100 font-bold uppercase tracking-widest text-[10px]">Companies</div>
          <div *ngIf="!statsLoading() && stats().total_enterprises > 0" class="mt-4 text-emerald-100 text-xs font-medium">Established enterprises</div>
          <div *ngIf="!statsLoading() && stats().total_enterprises === 0" class="mt-4 text-emerald-200/70 text-xs font-medium italic">No companies registered yet</div>
        </div>

        <!-- Company Type Pie Chart -->
        <div class="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all hover:-translate-y-1">
          <div class="flex items-center justify-between mb-6">
            <div class="text-slate-900 font-black">Enterprise Distribution</div>
            <div class="text-slate-400 text-xs font-bold uppercase tracking-wider">Startups vs Companies</div>
          </div>
          <div class="h-48 relative">
            <canvas #companyTypeChart></canvas>
          </div>
          <div class="flex items-center justify-center gap-6 mt-4">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-blue-500"></span>
              <span class="text-xs font-bold text-slate-600">Startups: {{ stats().total_startups || 0 }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span class="text-xs font-bold text-slate-600">Companies: {{ stats().total_enterprises || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Management -->
      <div class="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
        <div class="p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 class="text-xl font-black text-slate-900 tracking-tight">Recent Enterprise Activity</h2>
            <p class="text-slate-400 text-sm font-medium mt-1">Review and manage recent company registrations.</p>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-3">
            <a routerLink="/admin/industries" class="h-14 px-6 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 border border-slate-200 shadow-sm active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21 5-5 5 5"></path><path d="M12 16V3"></path><path d="M4 7h16"></path></svg>
              Manage Industries
            </a>
            <a routerLink="/admin/companies/add" class="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-3 shadow-xl shadow-blue-500/20 active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add New Enterprise
            </a>
          </div>
        </div>
        <div class="overflow-x-auto min-h-[300px]">
          <table class="w-full text-left">
            <thead>
              <tr class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50">
                <th class="px-10 py-6">Company Entity</th>
                <th class="px-10 py-6">Sector</th>
                <th class="px-10 py-6 text-center">Status</th>
                <th class="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 text-[13px]">
              <tr *ngFor="let company of companies()" class="hover:bg-slate-50/80 transition-all group cursor-pointer" (click)="openCompanyProfile(company)">
                <td class="px-10 py-8">
                  <div class="flex items-center gap-4">
                    <div class="relative">
                      <div *ngIf="company.picture; else noPic" class="w-14 h-14 rounded-2xl overflow-hidden shadow-xl border-2 border-white group-hover:rotate-6 transition-transform duration-500">
                        <img [src]="company.picture" class="w-full h-full object-cover">
                      </div>
                      <ng-template #noPic>
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-black text-sm shadow-xl group-hover:rotate-6 transition-transform duration-500">
                          {{ company.name.substring(0,2).toUpperCase() }}
                        </div>
                      </ng-template>
                    </div>
                    <div>
                      <div class="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{{ company.name }}</div>
                      <div class="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1 italic">{{ company.location || 'Tunisia' }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-10 py-8">
                  <span class="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-[0.1em] border border-blue-100/50">
                    {{ company.industry?.name || 'General' }}
                  </span>
                </td>
                <td class="px-10 py-8 text-center">
                   <div class="inline-flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                      <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></span>
                      Active
                   </div>
                </td>
                <td class="px-10 py-8 text-right">
                  <button class="h-12 w-12 rounded-2xl bg-white text-slate-400 hover:bg-slate-900 hover:text-white transition-all border border-slate-100 flex items-center justify-center m-auto md:mr-0 group-hover:scale-110 shadow-sm active:scale-90">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                </td>
              </tr>
              
              <tr *ngIf="companies().length === 0 && !isLoading()">
                <td colspan="4" class="px-10 py-20 text-center">
                  <div class="flex flex-col items-center gap-4 opacity-20">
                     <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                     <p class="font-black uppercase tracking-[0.3em] text-xs">Platform Void</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private router = inject(Router);
  private readonly selectedCompanyStorageKey = 'admin_selected_company_profile';

  companies = signal<any[]>([]);
  stats = signal<any>({
    total_revenue: 0,
    total_users: 0,
    total_companies: 0,
    total_startups: 0,
    total_enterprises: 0,
    total_hires: 0,
    revenue_growth: 0,
    users_growth: 0,
    companies_growth: 0,
    hires_growth: 0,
    chart_data: { labels: [], revenue: [], users: [] },
    company_type_chart: { labels: ['Startups', 'Companies'], values: [0, 0], colors: ['#3B82F6', '#10B981'] }
  });

  @ViewChild('companyTypeChart') companyTypeChartRef!: ElementRef;
  companyTypeChart: Chart | null = null;

  isLoading = signal(false);
  statsLoading = signal(true);
  statsError = signal<string | null>(null);

  ngOnInit() {
    this.loadCompanies();
    this.loadStats();
  }

  ngOnDestroy() {
    if (this.companyTypeChart) {
      this.companyTypeChart.destroy();
    }
  }

  loadStats() {
    this.statsLoading.set(true);
    this.statsError.set(null);
    this.apiService.get<any>('admin/dashboard-stats').subscribe({
      next: (res) => {
        if (res.success) {
          this.stats.set(res.data);
          setTimeout(() => this.renderCompanyTypeChart(), 100);
        } else {
          this.statsError.set('Failed to load statistics');
        }
        this.statsLoading.set(false);
      },
      error: (err) => {
        this.statsError.set(err?.error?.message || 'Error loading dashboard statistics');
        this.statsLoading.set(false);
      }
    });
  }

  renderCompanyTypeChart() {
    if (this.companyTypeChart) {
      this.companyTypeChart.destroy();
    }
    const canvas = this.companyTypeChartRef?.nativeElement;
    if (!canvas) return;

    const chartData = this.stats().company_type_chart;
    const total = chartData.values[0] + chartData.values[1];

    this.companyTypeChart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: chartData.labels,
        datasets: [{
          data: chartData.values,
          backgroundColor: chartData.colors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: { size: 11, weight: 'bold' }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return `${ctx.label}: ${val} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  loadCompanies() {
    this.isLoading.set(true);
    this.apiService.get<any>('admin/companies').subscribe({
      next: (res) => {
        this.companies.set(res.data || []);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  refreshStats() {
    this.loadStats();
  }

  openCompanyProfile(company: any) {
    const companyId = Number(company?.id);
    if (!Number.isFinite(companyId) || companyId <= 0) return;

    const selection = { companyId };
    sessionStorage.setItem(this.selectedCompanyStorageKey, JSON.stringify(selection));
    this.router.navigate(['/admin/companies/profile'], { state: selection });
  }
}
