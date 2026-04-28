import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

interface SubscriptionPaymentRecord {
  id: number;
  company: {
    id: number;
    name: string;
    email?: string | null;
    company_type?: string | null;
    is_active: boolean;
  };
  plan: {
    id: number | null;
    name: string;
    plan_type?: string | null;
    duration_days?: number | null;
  };
  amount: number | null;
  payment_method: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  paid_at: string | null;
}

@Component({
  selector: 'app-subscription-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="relative min-h-screen overflow-hidden rounded-[40px] border border-slate-200 bg-white p-6 lg:p-8">
      <div class="relative z-10">
        <!-- Header Row -->
        <div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-center">
          <div class="flex justify-start">
            <a
              routerLink="/admin/subscription-plans"
              class="inline-flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white/95 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md active:scale-95"
            >
              <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/><path d="M21 12H9"/></svg>
              </span>
              Back to Plans
            </a>
          </div>

          <div class="text-center">
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Subscription Management</p>
            <h1 class="mt-1 text-3xl font-black tracking-tight text-slate-900">Payment Records</h1>
            <p class="mt-2 text-sm font-medium text-slate-500 mx-auto max-w-xs leading-relaxed">
              Real-time tracking of company subscription transactions and active plans.
            </p>
          </div>

          <div class="hidden lg:block"></div> <!-- Spacer for grid balance -->
        </div>

        <!-- Search & Stats Bar -->
        <div class="mb-8 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-xl shadow-slate-200/40 backdrop-blur-md">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="relative w-full sm:max-w-md">
              <div class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <input
                type="text"
                [(ngModel)]="searchQuery"
                placeholder="Search company, email, or plan..."
                class="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3 pl-11 pr-4 text-sm font-medium text-slate-700 transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            <div class="flex items-center gap-3 px-2">
              <div class="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">
                {{ filteredPayments().length }} Records Found
              </span>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading()" class="py-20 text-center">
          <div class="relative mx-auto h-16 w-16">
            <div class="absolute inset-0 animate-ping rounded-full bg-blue-400/20"></div>
            <div class="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin text-blue-600"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
            </div>
          </div>
          <p class="mt-4 text-sm font-bold text-slate-600">Synchronizing payment history...</p>
        </div>

        <!-- Enhanced Table Design -->
        <div *ngIf="!isLoading()" class="overflow-x-auto pb-8">
          <table class="w-full min-w-[900px] border-separate border-spacing-y-3.5 text-left">
            <thead>
              <tr class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <th class="px-8 py-2">Company Entity</th>
                <th class="px-6 py-2">Subscription Details</th>
                <th class="px-6 py-2">Transaction</th>
                <th class="px-6 py-2">Service Period</th>
                <th class="px-6 py-2 text-right">Verification</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let payment of filteredPayments()"
                class="group rounded-[24px] bg-white border border-slate-200 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5"
              >
                <!-- Company Column -->
                <td class="rounded-l-[24px] px-8 py-5 border-l border-y border-slate-100 group-hover:border-blue-100">
                  <div class="flex items-center gap-4">
                    <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-sm font-black text-slate-600 shadow-inner ring-1 ring-slate-200/50 group-hover:from-blue-50 group-hover:text-blue-600 group-hover:ring-blue-100">
                      {{ payment.company.name.charAt(0) }}
                    </div>
                    <div>
                      <div class="font-black text-slate-900 group-hover:text-blue-700 transition-colors">{{ payment.company.name }}</div>
                      <div class="mt-0.5 text-xs font-medium text-slate-500">{{ payment.company.email || 'No email registered' }}</div>
                    </div>
                  </div>
                </td>

                <!-- Plan Column -->
                <td class="px-6 py-5 border-y border-slate-100 group-hover:border-blue-100">
                  <div class="flex items-center gap-2.5">
                    <div class="h-1.5 w-1.5 rounded-full bg-blue-500 group-hover:scale-125 transition-transform"></div>
                    <div class="font-bold text-slate-800">{{ payment.plan.name }}</div>
                  </div>
                  <div class="mt-1 inline-flex items-center gap-1 rounded-lg bg-blue-50/50 px-2 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-100/50">
                    {{ formatPlanDuration(payment.plan.duration_days) }} Plan
                  </div>
                </td>

                <!-- Transaction Column -->
                <td class="px-6 py-5 border-y border-slate-100 group-hover:border-blue-100">
                  <div class="text-base font-black text-emerald-600">
                    {{ payment.amount !== null ? (payment.amount | number:'1.2-2') : '0.00' }}
                    <span class="text-[10px] text-slate-400">TND</span>
                  </div>
                  <div class="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                    {{ payment.payment_method || 'Standard' }}
                  </div>
                </td>

                <!-- Period Column -->
                <td class="px-6 py-5 border-y border-slate-100 group-hover:border-blue-100">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-black uppercase text-slate-300">From</span>
                      <span class="text-xs font-bold text-slate-700">{{ payment.start_date | date:'MMM d, y' }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-black uppercase text-slate-300">Until</span>
                      <span class="text-xs font-bold text-slate-700">{{ payment.end_date | date:'MMM d, y' }}</span>
                    </div>
                  </div>
                </td>

                <!-- Verification Column -->
                <td class="rounded-r-[24px] px-8 py-5 text-right border-r border-y border-slate-100 group-hover:border-blue-100">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.05em] border"
                    [ngClass]="getStatusClass(payment.status)"
                  >
                    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-80"></span>
                    {{ payment.status || 'Verified' }}
                  </span>
                  <div class="mt-2 text-[10px] font-bold text-slate-400">
                    {{ payment.paid_at | date:'MMM d, h:mm a' }}
                  </div>
                </td>
              </tr>

              <!-- Empty State in Table -->
              <tr *ngIf="filteredPayments().length === 0">
                <td colspan="5" class="px-6 py-20 text-center">
                  <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-50 text-slate-300 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                  </div>
                  <h3 class="text-lg font-black text-slate-800 tracking-tight">No matching payments</h3>
                  <p class="text-sm font-medium text-slate-500">Adjust your search query to find specific records.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class SubscriptionPaymentsComponent implements OnInit {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);

  payments = signal<SubscriptionPaymentRecord[]>([]);
  isLoading = signal(false);
  searchQuery = '';

  filteredPayments = computed(() => {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return this.payments();

    return this.payments().filter((payment) => {
      const companyName = String(payment.company?.name || '').toLowerCase();
      const email = String(payment.company?.email || '').toLowerCase();
      const planName = String(payment.plan?.name || '').toLowerCase();
      return companyName.includes(query) || email.includes(query) || planName.includes(query);
    });
  });

  ngOnInit(): void {
    this.loadPayments();
  }

  loadPayments(): void {
    this.isLoading.set(true);
    this.apiService.get<{ success: boolean; data: SubscriptionPaymentRecord[] }>('admin/subscription-payments').subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.payments.set(Array.isArray(response?.data) ? response.data : []);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.payments.set([]);
        this.notificationService.error(error?.error?.message || 'Failed to load subscription payments.');
      },
    });
  }

  formatPlanDuration(durationDays: number | null | undefined): string {
    if (!durationDays || durationDays <= 0) return 'Duration N/A';
    if (durationDays % 365 === 0) {
      const years = durationDays / 365;
      return `${years} year${years > 1 ? 's' : ''}`;
    }
    if (durationDays % 30 === 0) {
      const months = durationDays / 30;
      return `${months} month${months > 1 ? 's' : ''}`;
    }
    return `${durationDays} day${durationDays > 1 ? 's' : ''}`;
  }

  getStatusClass(status: string | null | undefined): string {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'active') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (normalized === 'expired') {
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    if (normalized === 'cancelled') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}
