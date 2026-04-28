import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface SubscriptionPlan {
  id: number;
  name: string;
  plan_type: 'company' | 'startup';
  description: string | null;
  price: number;
  duration_days?: number;
  duration_months?: number;
  duration_text?: string;
  max_job_offers?: number;
  max_job_posts?: number;
  features?: {
    max_job_posts?: number;
    ai_access?: boolean;
    priority_support?: boolean;
    advanced_analytics?: boolean;
  };
  ai_features_enabled: boolean;
  has_ai_access: boolean;
  has_priority_support: boolean;
  has_advanced_analytics: boolean;
  is_active: boolean;
  display_order: number;
  feature_list?: string[];
}

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-50 font-['Outfit']">
      <main class="pt-4 pb-24 px-6">
        <div class="max-w-6xl mx-auto">
          <!-- Header -->
          <div class="text-center mb-12">
            <div class="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-black uppercase tracking-widest mb-6">
              {{ resolvedCompanyType() === 'startup' ? 'Startup Plans' : 'Company Plans' }}
            </div>
            <h1 class="text-5xl font-black text-slate-900 mb-6 tracking-tight">Simple, Transparent <span class="text-blue-600">Pricing</span></h1>
            <p class="text-lg text-slate-500 max-w-2xl mx-auto">
              {{ resolvedCompanyType() === 'startup' 
                ? 'Special pricing tailored for startups. Scale your hiring as you grow.' 
                : 'Choose the best plan for your recruitment needs. All plans include full access to our AI matching engine.' }}
            </p>
          </div>

          <!-- Loading State -->
          <div *ngIf="isLoading()" class="flex flex-col items-center justify-center py-20">
            <div class="relative">
              <div class="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-blue-400/20"></div>
              <div class="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin text-white"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
              </div>
            </div>
            <p class="mt-4 text-sm font-medium text-slate-600">Loading plans...</p>
          </div>

          <!-- Pricing Cards -->
          <div
            *ngIf="!isLoading()"
            class="grid gap-6 items-stretch"
            [style.grid-template-columns]="'repeat(' + (plans().length || 1) + ', minmax(0, 1fr))'"
          >
            
            <div *ngFor="let plan of plans(); let i = index" 
                 class="group relative min-w-0 bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border-2 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl flex flex-col"
                 [class.border-blue-600]="i === 1"
                 [class.border-slate-100]="i !== 1"
                 [class.bg-blue-50]="i === 1"
                 [class.scale-105]="i === 1"
                 [class.z-10]="i === 1">
              
              <!-- Most Popular Badge -->
              <div *ngIf="i === 1" class="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/40">
                Most Popular
              </div>
              
              <div class="mb-8">
                <span class="px-4 py-1.5 rounded-full text-[10px] uppercase font-black tracking-widest"
                      [class.bg-blue-50]="i !== 1"
                      [class.text-blue-600]="i !== 1"
                      [class.bg-blue-600]="i === 1"
                      [class.text-white]="i === 1">
                  {{ getPlanLabel(i) }}
                </span>
                <h3 class="text-2xl font-bold mt-4 text-slate-800">{{ plan.name }}</h3>
                <p *ngIf="plan.description" class="text-sm mt-2 text-slate-500">{{ plan.description }}</p>
              </div>
              
              <div class="mb-8">
                <div class="flex items-baseline gap-1">
                  <span class="text-5xl font-black text-slate-900">{{ plan.price | number:'1.0-0' }}</span>
                  <span class="text-xl font-bold text-slate-400">TND</span>
                </div>
                <p class="text-sm mt-2 font-medium text-slate-500">{{ plan.duration_text || getDurationLabel(plan) }}</p>
              </div>

              <ul class="space-y-3 mb-12 flex-grow">
                <!-- Duration -->
                <li class="flex items-center gap-3 font-medium text-slate-600">
                  <svg class="w-5 h-5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Duration: {{ plan.duration_text || getDurationLabel(plan) }}
                </li>
                <!-- Max Job Posts -->
                <li class="flex items-center gap-3 font-medium text-slate-600">
                  <svg class="w-5 h-5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  {{ (plan.max_job_posts ?? plan.features?.max_job_posts ?? 0) === 0 ? 'Unlimited Job Posts' : (plan.max_job_posts ?? plan.features?.max_job_posts) + ' Job Posts' }}
                </li>
                <!-- AI Features -->
                <li class="flex items-center gap-3 font-medium text-slate-600">
                  <svg *ngIf="plan.ai_features_enabled || plan.has_ai_access || plan.features?.ai_access" class="w-5 h-5 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <svg *ngIf="!(plan.ai_features_enabled || plan.has_ai_access || plan.features?.ai_access)" class="w-5 h-5 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  AI Features
                </li>
                <!-- Priority Support -->
                <li class="flex items-center gap-3 font-medium text-slate-600">
                  <svg *ngIf="plan.has_priority_support || plan.features?.priority_support" class="w-5 h-5 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <svg *ngIf="!(plan.has_priority_support || plan.features?.priority_support)" class="w-5 h-5 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  Priority Support
                </li>
                <!-- Chat System (Advanced Analytics) -->
                <li class="flex items-center gap-3 font-medium text-slate-600">
                  <svg *ngIf="plan.has_advanced_analytics || plan.features?.advanced_analytics" class="w-5 h-5 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <svg *ngIf="!(plan.has_advanced_analytics || plan.features?.advanced_analytics)" class="w-5 h-5 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  Chat System
                </li>
              </ul>

              <button [class.bg-blue-600]="i === 1"
                      [class.text-white]="i === 1"
                      [class.hover:bg-blue-500]="i === 1"
                      [class.shadow-blue-500]="i === 1"
                      [class.bg-white]="i !== 1"
                      [class.text-slate-800]="i !== 1"
                      [class.hover:bg-slate-50]="i !== 1"
                      [class.border-slate-200]="i !== 1"
                      [class.border]="i !== 1"
                      class="w-full py-4 rounded-2xl font-bold transition-all shadow-xl">
                Subscribe Now
              </button>
            </div>

          </div>

          <!-- Empty State -->
          <div *ngIf="!isLoading() && plans().length === 0" class="py-20 text-center">
            <div class="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400">
                <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <p class="text-lg font-semibold text-slate-900">No plans available</p>
            <p class="text-sm text-slate-500 mt-2">Please check back later for available subscription plans.</p>
          </div>

          <!-- FAQ/Info -->
          <div class="mt-24 text-center">
            <p class="text-slate-500">Need a custom plan for a large organization? <a class="text-blue-600 font-bold hover:underline cursor-pointer">Contact Our Sales Team</a></p>
          </div>
        </div>
      </main>
    </div>
  `
})
export class PricingComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  plans = signal<SubscriptionPlan[]>([]);
  isLoading = signal(true);
  resolvedCompanyType = signal<'company' | 'startup' | ''>('');

  currentUser = computed(() => this.authService.getCurrentUser() as any);

  ngOnInit(): void {
    this.hydrateCompanyTypeFromCurrentUser();
    
    // If not found in auth, fetch from company profile
    if (!this.resolvedCompanyType()) {
      console.log('[Pricing] Company type not in auth, fetching from company/profile...');
      this.apiService.get<any>('company/profile').subscribe({
        next: (res) => {
          console.log('[Pricing] Company profile response:', res);
          const companyType = String(res?.data?.company_type || '').toLowerCase();
          console.log('[Pricing] Extracted company_type:', companyType);
          if (companyType === 'company' || companyType === 'startup') {
            this.resolvedCompanyType.set(companyType);
            this.loadPlans();
          } else {
            console.error('[Pricing] Invalid company_type:', companyType);
            this.isLoading.set(false);
          }
        },
        error: (err) => {
          console.error('[Pricing] Failed to load company profile:', err);
          this.isLoading.set(false);
        }
      });
    } else {
      console.log('[Pricing] Company type found in auth:', this.resolvedCompanyType());
      this.loadPlans();
    }
  }

  private hydrateCompanyTypeFromCurrentUser(): void {
    const user = this.currentUser();
    console.log('[Pricing] Current user:', user);
    const profile = user?.profile;
    const companyType = String(profile?.company_type || profile?.company?.company_type || '').toLowerCase();
    console.log('[Pricing] Company type from auth:', companyType);
    if (companyType === 'company' || companyType === 'startup') {
      this.resolvedCompanyType.set(companyType);
    }
  }

  loadPlans(): void {
    const companyType = this.resolvedCompanyType();
    console.log('[Pricing] Loading plans for type:', companyType);
    if (!companyType) {
      console.error('[Pricing] No company type available');
      this.isLoading.set(false);
      return;
    }

    const endpoint = `pricing?plan_type=${companyType}`;
    console.log('[Pricing] Calling endpoint:', endpoint);

    this.apiService.get<{ success: boolean; data: { plan_type: string; plans: SubscriptionPlan[] } }>(endpoint).subscribe({
      next: (response) => {
        console.log('[Pricing] Plans response:', response);
        const plans = response?.data?.plans || [];
        console.log('[Pricing] Setting plans:', plans);
        this.plans.set(plans);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('[Pricing] Failed to load plans:', err);
        this.isLoading.set(false);
      }
    });
  }

  getPlanLabel(index: number): string {
    if (index === 0) return 'Entry Plan';
    if (index === 1) return 'Most Popular';
    return 'Enterprise Elite';
  }

  getDurationLabel(plan: SubscriptionPlan): string {
    const days = plan.duration_days ?? (plan.duration_months ? plan.duration_months * 30 : 0);
    if (days === 0) return '';
    if (days % 365 === 0) {
      const years = days / 365;
      return `${years} year${years > 1 ? 's' : ''}`;
    }
    if (days % 30 === 0) {
      const months = days / 30;
      return `${months} month${months > 1 ? 's' : ''}`;
    }
    return `${days} days`;
  }
}
