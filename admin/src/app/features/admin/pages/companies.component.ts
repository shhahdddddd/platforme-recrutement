import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-admin-companies',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-6">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-2xl font-bold text-white">Companies Management</h1>
          <p class="text-white/70">Manage enterprise access and company profiles</p>
        </div>
        <a routerLink="/admin/companies/add" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Company
        </a>
      </div>

      <div class="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[400px]">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs uppercase tracking-widest">
              <th class="px-8 py-5">Company</th>
              <th class="px-8 py-5">Industry</th>
              <th class="px-8 py-5">Location</th>
              <th class="px-8 py-5">Departments</th>
              <th class="px-8 py-5">Type</th>
              <th class="px-8 py-5">Status</th>
              <th class="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr
              *ngFor="let company of companies()"
              class="hover:bg-slate-50/50 transition-colors group"
              [class.opacity-50]="company.user?.is_active === false"
            >
              <td class="px-8 py-5">
                <div class="flex items-center gap-4">
                  <div *ngIf="company.picture; else noPic" class="w-10 h-10 rounded-xl overflow-hidden shadow-md">
                     <img [src]="company.picture" class="w-full h-full object-cover">
                  </div>
                  <ng-template #noPic>
                     <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        {{ company.name.charAt(0).toUpperCase() }}
                     </div>
                  </ng-template>
                  <div>
                    <div class="font-bold text-slate-800">{{ company.name }}</div>
                    <div class="text-xs text-slate-400 font-medium">{{ company.user?.email || 'N/A' }}</div>
                  </div>
                </div>
              </td>
              <td class="px-8 py-5">
                <span class="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                    {{ company.industry?.name || 'Software' }}
                </span>
              </td>
              <td class="px-8 py-5 text-slate-500 text-sm font-medium">{{ company.location || 'Tunisia' }}</td>
              <td class="px-8 py-5">
                <div *ngIf="company.departments?.length; else noDepts" class="flex flex-wrap gap-1.5 items-center">
                  <span *ngFor="let dept of company.departments.slice(0, 3)" class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold truncate max-w-[100px]" [title]="dept.name">{{ dept.name }}</span>
                  <span *ngIf="company.departments.length > 3" class="text-[10px] text-slate-400 font-bold">+{{ company.departments.length - 3 }} more</span>
                </div>
                <ng-template #noDepts>
                  <span class="text-[10px] text-slate-300 font-bold uppercase tracking-wider">No departments</span>
                </ng-template>
              </td>
              <td class="px-8 py-5">
                <span *ngIf="company.international" class="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider italic">
                    International
                </span>
                <span *ngIf="!company.international" class="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider italic">
                    Local
                </span>
              </td>
              <td class="px-8 py-5">
                <span
                  class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                  [class.bg-emerald-50]="company.user?.is_active !== false && !isSubscriptionExpired(company)"
                  [class.text-emerald-600]="company.user?.is_active !== false && !isSubscriptionExpired(company)"
                  [class.bg-slate-200]="company.user?.is_active === false || isSubscriptionExpired(company)"
                  [class.text-slate-600]="company.user?.is_active === false || isSubscriptionExpired(company)"
                >
                  {{ (company.user?.is_active === false || isSubscriptionExpired(company)) ? 'Deactivated' : 'Active' }}
                </span>
              </td>
              <td class="px-8 py-5 text-right">
                <button
                  (click)="toggleCompanyStatus(company)"
                  [disabled]="togglingCompanyId() === company.id || isSubscriptionExpired(company)"
                  class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  [class.bg-rose-50]="company.user?.is_active !== false"
                  [class.text-rose-600]="company.user?.is_active !== false"
                  [class.hover:bg-rose-100]="company.user?.is_active !== false"
                  [class.bg-emerald-50]="company.user?.is_active === false"
                  [class.text-emerald-600]="company.user?.is_active === false"
                  [class.hover:bg-emerald-100]="company.user?.is_active === false"
                >
                  <span
                    *ngIf="togglingCompanyId() === company.id"
                    class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"
                  ></span>
                  {{ company.user?.is_active === false ? 'Activate' : 'Deactivate' }}
                </button>
              </td>
            </tr>
            
            <tr *ngIf="companies().length === 0 && !isLoading()">
               <td colspan="7" class="px-8 py-20 text-center opacity-40">
                  <p class="font-black uppercase tracking-widest text-xs">No registered companies found</p>
               </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="showConfirmationModal()" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm p-4 flex items-center justify-center">
        <div class="w-full max-w-lg bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-8">
          <h2 class="text-2xl font-black text-slate-900">
            {{ pendingAction() === 'activate' ? 'Confirm Subscription Payment' : 'Confirm Deactivation' }}
          </h2>

          <p class="mt-3 text-slate-600 leading-relaxed" *ngIf="pendingAction() === 'activate'">
            Are you sure <span class="font-bold text-slate-800">{{ pendingCompany()?.name || 'this company' }}</span>
            paid for a new subscription?
          </p>

          <p class="mt-3 text-slate-600 leading-relaxed" *ngIf="pendingAction() === 'deactivate'">
            Are you sure you want to deactivate access for
            <span class="font-bold text-slate-800">{{ pendingCompany()?.name || 'this company' }}</span>?
          </p>

          <div class="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              (click)="closeConfirmationModal()"
              class="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="confirmPendingAction()"
              class="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all"
              [class.bg-emerald-600]="pendingAction() === 'activate'"
              [class.hover:bg-emerald-700]="pendingAction() === 'activate'"
              [class.bg-rose-600]="pendingAction() === 'deactivate'"
              [class.hover:bg-rose-700]="pendingAction() === 'deactivate'"
            >
              {{ pendingAction() === 'activate' ? 'Continue to Payment' : 'Deactivate' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    `
})
export class CompaniesComponent implements OnInit {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  companies = signal<any[]>([]);
  isLoading = signal(false);
  togglingCompanyId = signal<number | null>(null);
  showConfirmationModal = signal(false);
  pendingAction = signal<'activate' | 'deactivate' | null>(null);
  pendingCompany = signal<any | null>(null);

  ngOnInit() {
    this.loadCompanies();
  }

  isSubscriptionExpired(company: any): boolean {
    const endDate = company?.subscription_ends_at || company?.subscription_end_date;
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  }

  loadCompanies() {
    this.isLoading.set(true);
    this.apiService.get<any>('admin/companies').subscribe({
      next: (response) => {
        this.companies.set(response.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading companies:', err);
        this.isLoading.set(false);
      }
    });
  }

  toggleCompanyStatus(company: any) {
    const companyId = Number(company?.id);
    if (!Number.isFinite(companyId) || companyId <= 0) return;
    if (this.togglingCompanyId() !== null) return;

    const isActive = company?.user?.is_active !== false;
    this.pendingCompany.set(company);
    this.pendingAction.set(isActive ? 'deactivate' : 'activate');
    this.showConfirmationModal.set(true);
  }

  private handleToggleSuccess(companyId: number, response: any) {
    this.togglingCompanyId.set(null);
    if (!response?.success) return;

    this.companies.update((list) =>
      list.map((item) =>
        item.id === companyId
          ? {
              ...item,
              user: {
                ...(item.user || {}),
                is_active: response.is_active,
              },
            }
          : item,
      ),
    );

    this.notificationService.success(
      response?.message || `Company access ${response?.is_active ? 'activated' : 'deactivated'}.`,
    );
  }

  closeConfirmationModal() {
    if (this.togglingCompanyId() !== null) return;
    this.showConfirmationModal.set(false);
    this.pendingAction.set(null);
    this.pendingCompany.set(null);
  }

  confirmPendingAction() {
    const action = this.pendingAction();
    const company = this.pendingCompany();
    const companyId = Number(company?.id);
    if (!action || !Number.isFinite(companyId) || companyId <= 0) return;

    if (action === 'activate') {
      const reactivationContext = {
        companyId,
        companyName: company?.name || 'Company',
        companyType: company?.company_type || 'company',
      };
      sessionStorage.setItem('admin_company_reactivation', JSON.stringify(reactivationContext));
      this.closeConfirmationModal();
      this.router.navigate(['/admin/activation'], { state: reactivationContext });
      return;
    }

    this.showConfirmationModal.set(false);
    this.pendingAction.set(null);
    this.pendingCompany.set(null);
    this.togglingCompanyId.set(companyId);
    this.apiService.patch<any>(`admin/companies/${companyId}/toggle-status`, {}).subscribe({
      next: (response) => {
        this.handleToggleSuccess(companyId, response);
      },
      error: (err) => {
        this.togglingCompanyId.set(null);
        this.notificationService.error(err?.error?.message || 'Failed to update company access.');
      },
    });
  }
}
