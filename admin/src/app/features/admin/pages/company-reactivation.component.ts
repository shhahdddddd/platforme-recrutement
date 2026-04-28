import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-company-reactivation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-white p-6 lg:p-8 rounded-[40px] border border-slate-200 overflow-hidden">
      <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
          <div>
            <p class="text-xs font-semibold text-blue-600 uppercase tracking-wider">Subscription Management</p>
            <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Company Reactivation</h1>
          </div>
        </div>

        <a
          routerLink="/admin/companies"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/><path d="M21 12H9"/></svg>
          Back to Companies
        </a>
      </div>

      <div class="rounded-[32px] border border-slate-200 bg-white p-6 lg:p-8 shadow-sm">
        <form [formGroup]="reactivationForm" (ngSubmit)="submit()" class="space-y-8">
          <div class="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <p class="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Choose Subscription Plan</p>

            <div *ngIf="isLoadingPlans()" class="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <span class="inline-block h-7 w-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
              <p class="mt-3 text-sm font-semibold text-slate-500">Loading plans...</p>
            </div>

            <div *ngIf="!isLoadingPlans() && subscriptionPlans().length === 0" class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              <p>No subscription plans available for this company type.</p>
            </div>

            <div *ngIf="!isLoadingPlans() && subscriptionPlans().length > 0" class="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
              <button
                *ngFor="let plan of subscriptionPlans()"
                type="button"
                (click)="reactivationForm.patchValue({ plan_id: plan.id })"
                class="w-full rounded-2xl border-2 bg-white p-6 text-left transition-all hover:-translate-y-0.5"
                [class.border-blue-500]="reactivationForm.value.plan_id === plan.id"
                [class.bg-blue-50]="reactivationForm.value.plan_id === plan.id"
                [class.text-blue-700]="reactivationForm.value.plan_id === plan.id"
                [class.ring-2]="reactivationForm.value.plan_id === plan.id"
                [class.ring-blue-100]="reactivationForm.value.plan_id === plan.id"
                [class.shadow-md]="reactivationForm.value.plan_id === plan.id"
                [class.border-slate-200]="reactivationForm.value.plan_id !== plan.id"
                [class.hover:border-blue-200]="reactivationForm.value.plan_id !== plan.id"
              >
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">{{ plan.name }}</p>
                <p class="mt-1 text-2xl font-black text-slate-900">{{ plan.price }} TND</p>
                <p class="mt-1 text-xs font-medium text-slate-500">{{ plan.duration_text }}</p>
                <ul class="mt-3 space-y-1">
                  <li *ngFor="let feature of plan.feature_list" class="text-[11px] text-slate-600">{{ feature }}</li>
                </ul>
              </button>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 bg-white p-5">
            <p class="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Payment Method</p>
            <div class="flex flex-wrap justify-center gap-4">
              <button
                *ngFor="let method of paymentMethods"
                type="button"
                (click)="reactivationForm.patchValue({ payment_method: method })"
                class="rounded-2xl border-2 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all"
                [class.border-blue-500]="reactivationForm.value.payment_method === method"
                [class.bg-blue-50]="reactivationForm.value.payment_method === method"
                [class.text-blue-700]="reactivationForm.value.payment_method === method"
                [class.border-slate-200]="reactivationForm.value.payment_method !== method"
                [class.text-slate-600]="reactivationForm.value.payment_method !== method"
              >
                {{ method }}
              </button>
            </div>
          </div>

          <div>
            <p class="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Payment Notes (Optional)</p>
            <textarea
              formControlName="notes"
              rows="4"
              class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="Invoice number, cheque reference, transfer ID..."
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <a
              routerLink="/admin/companies"
              class="rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </a>
            <button
              type="submit"
              [disabled]="isSubmitting()"
              class="rounded-xl bg-emerald-600 px-7 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700 transition-all disabled:opacity-60"
            >
              <span
                *ngIf="isSubmitting()"
                class="mr-1 inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"
              ></span>
              Confirm Payment & Activate
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CompanyReactivationComponent implements OnInit {
  private router = inject(Router);
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  private readonly storageKey = 'admin_company_reactivation';


  paymentMethods = ['Cash', 'Bank Transfer', 'Cheque'];

  companyId = signal<number | null>(null);
  companyName = signal('Company');
  companyType = signal<'company' | 'startup'>('company');
  isSubmitting = signal(false);
  isLoadingPlans = signal(false);
  subscriptionPlans = signal<any[]>([]);

  reactivationForm = new FormGroup({
    plan_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    payment_method: new FormControl<string>('Cash', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl<string>(''),
  });

  ngOnInit(): void {
    const navState = this.router.getCurrentNavigation()?.extras?.state ?? history.state;
    const navCompanyId = Number((navState as any)?.companyId);
    const navCompanyName = String((navState as any)?.companyName || '').trim();
    const navCompanyType = String((navState as any)?.companyType || 'company').trim() as 'company' | 'startup';

    if (Number.isFinite(navCompanyId) && navCompanyId > 0) {
      this.companyId.set(navCompanyId);
      this.companyName.set(navCompanyName || `Company #${navCompanyId}`);
      this.companyType.set(navCompanyType);
      sessionStorage.setItem(this.storageKey, JSON.stringify({
        companyId: navCompanyId,
        companyName: this.companyName(),
        companyType: navCompanyType,
      }));
      this.loadSubscriptionPlans();
      return;
    }

    try {
      const raw = sessionStorage.getItem(this.storageKey);
      if (!raw) {
        this.notificationService.warning('Please select a company from the companies page.');
        this.router.navigate(['/admin/companies']);
        return;
      }

      const parsed = JSON.parse(raw);
      const storedCompanyId = Number(parsed?.companyId);
      const storedCompanyName = String(parsed?.companyName || '').trim();
      const storedCompanyType = String(parsed?.companyType || 'company').trim() as 'company' | 'startup';

      if (!Number.isFinite(storedCompanyId) || storedCompanyId <= 0) {
        this.notificationService.warning('Please select a company from the companies page.');
        this.router.navigate(['/admin/companies']);
        return;
      }

      this.companyId.set(storedCompanyId);
      this.companyName.set(storedCompanyName || `Company #${storedCompanyId}`);
      this.companyType.set(storedCompanyType);
      this.loadSubscriptionPlans();
    } catch {
      this.notificationService.warning('Please select a company from the companies page.');
      this.router.navigate(['/admin/companies']);
    }
  }

  loadSubscriptionPlans(): void {
    this.isLoadingPlans.set(true);
    const planType = this.companyType();
    this.apiService.get<any>(`pricing?plan_type=${planType}`, false).subscribe({
      next: (response) => {
        this.isLoadingPlans.set(false);
        if (response?.success && response?.data?.plans) {
          this.subscriptionPlans.set(response.data.plans);
          // Auto-select first plan if available
          if (response.data.plans.length > 0) {
            this.reactivationForm.patchValue({ plan_id: response.data.plans[0].id });
          }
        }
      },
      error: (err) => {
        this.isLoadingPlans.set(false);
        this.notificationService.error('Failed to load subscription plans.');
      },
    });
  }

  submit(): void {
    if (this.reactivationForm.invalid || this.companyId() === null) {
      this.reactivationForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.apiService.post<any>(`admin/companies/${this.companyId()}/reactivate`, {
      plan_id: this.reactivationForm.value.plan_id,
      payment_method: this.reactivationForm.value.payment_method,
      notes: this.reactivationForm.value.notes || null,
    }).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        if (response?.success) {
          sessionStorage.removeItem(this.storageKey);
          this.notificationService.success(response?.message || 'Company reactivated successfully.');
          this.router.navigate(['/admin/companies']);
          return;
        }
        this.notificationService.error('Failed to reactivate company.');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.notificationService.error(err?.error?.message || 'Failed to reactivate company subscription.');
      },
    });
  }
}
