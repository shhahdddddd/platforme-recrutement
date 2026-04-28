import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

const notPastDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (!control.value) return null;

  const [year, month, day] = String(control.value).split('-').map(Number);
  if (!year || !month || !day) return { invalidDate: true };

  const selectedDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selectedDate < today ? { pastDate: true } : null;
};

type PlanType = 'company' | 'startup';

interface SubscriptionPlanOption {
  id: number;
  name: string;
  plan_type: PlanType;
  description: string | null;
  price: number;
  duration_days: number;
  max_job_offers: number;
  max_job_posts: number;
  ai_features_enabled: boolean;
  has_ai_access: boolean;
  has_priority_support: boolean;
  has_advanced_analytics: boolean;
  is_active: boolean;
  display_order: number;
}

interface IndustryOption {
  id: number;
  name: string;
}

@Component({
  selector: 'app-admin-add-company',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div [class.bg-slate-900]="isBlackMode()" [class.bg-white]="!isBlackMode()" class="min-h-screen flex flex-col items-center justify-center p-8 transition-colors duration-700">
      
      <!-- Clean Minimal Header -->
      <div class="w-full max-w-4xl grid grid-cols-3 items-center mb-12">
        <div class="flex justify-start">
          <a routerLink="/admin/companies" 
             [class.text-slate-400]="!isBlackMode()" [class.text-slate-500]="isBlackMode()"
             [class.bg-slate-50/50]="!isBlackMode()" [class.bg-white/5]="isBlackMode()"
             class="group flex items-center gap-3 text-[11px] font-black hover:text-slate-900 transition-all uppercase tracking-[0.2em] px-8 py-4 rounded-full border border-slate-100/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="group-hover:-translate-x-1 transition-transform"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back
          </a>
        </div>

        <div class="text-center flex flex-col items-center gap-1">
          <h1 [class.text-white]="isBlackMode()" [class.text-slate-900]="!isBlackMode()" class="text-5xl font-black tracking-tighter transition-colors">
            Enterprise
          </h1>
          <p class="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Management Portal</p>
        </div>

        <div class="flex justify-end opacity-0 pointer-events-none">
           <div class="px-6 py-3">Back</div>
        </div>
      </div>

      <div [class.bg-slate-800]="isBlackMode()" [class.bg-white]="!isBlackMode()" 
           [class.border-white/10]="isBlackMode()" [class.border-slate-50]="!isBlackMode()"
           class="w-full max-w-4xl rounded-[5rem] border-2 p-14 mb-10 transition-all duration-500 shadow-2xl">

        <form [formGroup]="companyForm" (ngSubmit)="onSubmit()" class="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <!-- Basic Info Section -->
          <div class="col-span-2 flex items-center gap-3 pb-2 border-b border-slate-50/10">
             <div [class.bg-blue-500/10]="isBlackMode()" [class.bg-blue-50]="!isBlackMode()" class="w-8 h-8 rounded-lg text-blue-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
             </div>
             <h2 [class.text-white]="isBlackMode()" [class.text-slate-800]="!isBlackMode()" class="text-lg font-black uppercase tracking-widest text-[11px] transition-colors">Company Profile</h2>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Legal Name</label>
            <input type="text" formControlName="name" placeholder="Acme Corp TN" 
                   [class.border-red-500]="companyForm.get('name')?.invalid && companyForm.get('name')?.touched"
                   class="w-full h-16 bg-slate-50 text-slate-900 border-2 border-transparent rounded-full px-8 outline-none focus:border-blue-500/30 focus:bg-white transition-all font-medium">
          </div>

          <div class="space-y-2 relative" id="location-dropdown">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Location (Tunisia)</label>
            <div class="select-shell group"
                 [class.select-invalid]="companyForm.get('location')?.invalid && companyForm.get('location')?.touched">
              <span class="select-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </span>
              <button
                type="button"
                class="w-full h-full pl-14 pr-14 rounded-2xl text-left outline-none font-black text-sm tracking-[0.01em] text-slate-900"
                [attr.aria-expanded]="isLocationMenuOpen()"
                aria-haspopup="listbox"
                (click)="toggleLocationDropdown()"
              >
                <span [class.text-slate-400]="!companyForm.get('location')?.value">{{ companyForm.get('location')?.value || 'Select Governorate' }}</span>
              </button>
              <div class="select-arrow" [class.rotate-180]="isLocationMenuOpen()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <div
              *ngIf="isLocationMenuOpen()"
              class="absolute z-50 w-full mt-2 p-2 bg-white/95 backdrop-blur-xl border border-slate-200/70 rounded-3xl shadow-2xl shadow-slate-900/10 max-h-64 overflow-y-auto"
              role="listbox"
              aria-label="Location"
            >
              <button
                type="button"
                *ngFor="let gov of governorates"
                (click)="selectLocation(gov)"
                class="w-full text-left px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-between gap-2"
                [class.bg-blue-600]="companyForm.get('location')?.value === gov"
                [class.text-white]="companyForm.get('location')?.value === gov"
              >
                <span class="truncate">{{ gov }}</span>
                <svg *ngIf="companyForm.get('location')?.value === gov" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">{{ governorates.length }} governorates available</p>
          </div>

          <div class="space-y-2 relative" id="industry-dropdown">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Industry Sector</label>
            <div class="select-shell group"
                 [class.select-invalid]="companyForm.get('industry_id')?.invalid && companyForm.get('industry_id')?.touched">
              <span class="select-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l7-4v18"></path><path d="M19 21V11l-7-4"></path><path d="M9 9h.01"></path><path d="M9 13h.01"></path><path d="M9 17h.01"></path><path d="M15 13h.01"></path><path d="M15 17h.01"></path></svg>
              </span>
              <button
                type="button"
                class="w-full h-full pl-14 pr-14 rounded-2xl text-left outline-none font-black text-sm tracking-[0.01em] text-slate-900"
                [attr.aria-expanded]="isIndustryMenuOpen()"
                aria-haspopup="listbox"
                (click)="toggleIndustryDropdown()"
              >
                <span [class.text-slate-400]="!companyForm.get('industry_id')?.value">{{ companyForm.get('industry_id')?.value || 'Select Industry' }}</span>
              </button>
              <div class="select-arrow" [class.rotate-180]="isIndustryMenuOpen()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <div
              *ngIf="isIndustryMenuOpen()"
              class="absolute z-50 w-full mt-2 p-2 bg-white/95 backdrop-blur-xl border border-slate-200/70 rounded-3xl shadow-2xl shadow-slate-900/10 max-h-64 overflow-y-auto"
              role="listbox"
              aria-label="Industry"
            >
              <button
                type="button"
                *ngFor="let ind of industries"
                (click)="selectIndustry(ind)"
                class="w-full text-left px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-between gap-2"
                [class.bg-blue-600]="companyForm.get('industry_id')?.value === ind"
                [class.text-white]="companyForm.get('industry_id')?.value === ind"
              >
                <span class="truncate">{{ ind }}</span>
                <svg *ngIf="companyForm.get('industry_id')?.value === ind" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">{{ industries.length }} sectors available</p>
          </div>

          <!-- Company Type & Employees -->
          <div class="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
            <div class="space-y-3">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Entity Type</label>
              <div class="flex gap-3">
                <button type="button" 
                        (click)="selectCompanyType('company')"
                        [class.active-pm]="companyForm.get('company_type')?.value === 'company'"
                        class="pm-button flex-1 flex items-center justify-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                  <span class="text-sm font-black">Company</span>
                </button>
                <button type="button" 
                        (click)="selectCompanyType('startup')"
                        [class.active-pm]="companyForm.get('company_type')?.value === 'startup'"
                        class="pm-button flex-1 flex items-center justify-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3"/><path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5"/></svg>
                  <span class="text-sm font-black">Startup</span>
                </button>
              </div>
              <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1 italic" *ngIf="companyForm.get('company_type')?.value === 'startup'">
                 * Startups do not use departments
              </p>
            </div>

            <div class="space-y-4">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Estimated Workforce</label>
              <div class="relative group">
                <input type="number" formControlName="employee_count" placeholder="e.g. 25" 
                       class="w-full h-16 bg-slate-50 text-slate-900 border-2 border-transparent rounded-full px-8 outline-none focus:border-blue-500/30 focus:bg-white transition-all font-bold">
                <div class="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
              </div>
            </div>
          </div>

          <label class="col-span-2 md:col-span-1 flex items-center gap-4 mt-2 px-2 cursor-pointer group">
            <div class="relative inline-flex items-center">
              <input type="checkbox" formControlName="international" class="sr-only peer">
              <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 transition-colors"></div>
            </div>
            <span class="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-200 transition-colors">International Entity</span>
          </label>


          <!-- Conditional Country Input -->
          <div *ngIf="companyForm.get('international')?.value" class="col-span-2 md:col-span-1 space-y-2 animate-in fade-in slide-in-from-left-4 duration-300">
            <label class="text-xs font-black text-emerald-600 uppercase tracking-widest pl-1">Target Country</label>
            <input type="text" formControlName="country" placeholder="France, Germany, etc." 
                   class="w-full h-14 bg-emerald-50 text-slate-900 border-2 border-emerald-100 rounded-2xl px-6 outline-none focus:border-emerald-500 transition-all font-bold">
          </div>

          <div class="col-span-2 space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Company Description</label>
            <textarea formControlName="description" rows="4" placeholder="Brief overview of the company..." 
                      [class.border-red-500]="companyForm.get('description')?.invalid && companyForm.get('description')?.touched"
                      class="w-full bg-slate-50 text-slate-900 border-2 border-transparent rounded-3xl p-6 outline-none focus:border-blue-500/30 focus:bg-white transition-all font-medium"></textarea>
          </div>

          <!-- Subscription Section -->
          <div class="col-span-2 flex items-center gap-3 mt-4 pb-2 border-b border-slate-50/10">
             <div [class.bg-emerald-500/10]="isBlackMode()" [class.bg-emerald-50]="!isBlackMode()" class="w-8 h-8 rounded-lg text-emerald-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
             </div>
             <h2 [class.text-white]="isBlackMode()" [class.text-slate-800]="!isBlackMode()" class="text-lg font-black uppercase tracking-widest text-[11px] transition-colors">Subscription & Billing</h2>
          </div>

          <div class="col-span-2 space-y-4">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Selected Membership Plan</label>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">
              {{ companyForm.get('company_type')?.value === 'startup' ? 'Startup plans' : 'Company plans' }}
            </p>
            <div *ngIf="isPlansLoading()" class="rounded-3xl border border-slate-100 bg-slate-50 px-6 py-5 text-xs font-bold uppercase tracking-widest text-slate-500">
              Loading subscription plans...
            </div>
            <div *ngIf="!isPlansLoading() && subscriptionPlans().length === 0" class="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-xs font-bold uppercase tracking-widest text-amber-700">
              No active plans available for this entity type.
            </div>
            <div *ngIf="!isPlansLoading() && subscriptionPlans().length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div *ngFor="let plan of subscriptionPlans()"
                   (click)="selectPlan(plan.id)"
                   [class.active-plan]="companyForm.get('plan_id')?.value === plan.id"
                   [class.bg-slate-700]="isBlackMode() && companyForm.get('plan_id')?.value !== plan.id"
                   class="plan-card group">
                <div class="plan-header">
                  <span class="plan-tag">{{ plan.name }}</span>
                  <div class="plan-price" [class.text-white]="isBlackMode()">{{ plan.price | number:'1.0-2' }} <span class="text-xs">TND</span></div>
                </div>
                <p class="text-[10px] text-slate-400 font-bold uppercase mt-2">{{ formatPlanDuration(plan.duration_days) }}</p>
                <p *ngIf="plan.description" class="text-[10px] text-slate-500 mt-1 line-clamp-2">{{ plan.description }}</p>
                <div class="plan-check">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </div>
            </div>
          </div>

          <div class="col-span-2 space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Activation Date</label>
            <div class="relative group">
              <input type="date" formControlName="subscription_start_date" 
                     [min]="todayDate"
                     [class.border-red-500]="companyForm.get('subscription_start_date')?.invalid && companyForm.get('subscription_start_date')?.touched"
                     class="premium-date-input w-full h-16 bg-white text-slate-900 border-2 border-slate-100 rounded-full px-8 outline-none focus:border-emerald-500 transition-all font-black cursor-pointer pr-12">
              <div class="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-900 group-focus-within:text-emerald-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </div>
            </div>
            <p *ngIf="companyForm.get('subscription_start_date')?.hasError('pastDate') && companyForm.get('subscription_start_date')?.touched"
               class="text-xs font-bold text-red-500 pl-1">
              Start date cannot be before today.
            </p>
          </div>

          <div class="col-span-2 space-y-3">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                Payment Method 
                <span *ngIf="companyForm.get('payment_method')?.invalid && companyForm.get('payment_method')?.touched" class="text-red-500 normal-case ml-2 font-bold">— Please select one</span>
            </label>
            <div class="flex flex-wrap justify-center gap-3">
              <button type="button" *ngFor="let pm of paymentMethods"
                      (click)="companyForm.patchValue({payment_method: pm})"
                      [class.active-pm]="companyForm.get('payment_method')?.value === pm"
                      [class.border-red-200]="companyForm.get('payment_method')?.invalid && companyForm.get('payment_method')?.touched"
                      [class.bg-slate-700]="isBlackMode() && companyForm.get('payment_method')?.value !== pm"
                      class="pm-button group transition-colors">
                <div class="flex items-center gap-3">
                   <ng-container [ngSwitch]="pm">
                      <svg *ngSwitchCase="'Cash'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
                      <svg *ngSwitchCase="'Bank Transfer'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M8 21v-7M12 21v-7M16 21v-7"/></svg>
                      <svg *ngSwitchCase="'Cheque'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12H3m12-9a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-4zM7 3v18"/></svg>
                   </ng-container>
                   <span class="text-sm font-black">{{ pm }}</span>
                </div>
              </button>
            </div>
          </div>

          <div class="col-span-2 space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Subscription Notes</label>
            <textarea formControlName="notes" rows="3" placeholder="Additional details, payment references, etc." 
                      class="w-full bg-slate-50 text-slate-900 border-2 border-transparent rounded-3xl p-6 outline-none focus:border-emerald-500/30 focus:bg-white transition-all font-medium"></textarea>
          </div>

          <!-- Access Section -->
          <div class="col-span-2 flex items-center gap-3 mt-8 pb-2 border-b border-slate-50/10">
             <div [class.bg-indigo-500/10]="isBlackMode()" [class.bg-indigo-50]="!isBlackMode()" class="w-8 h-8 rounded-lg text-indigo-300 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
             </div>
             <h2 [class.text-white]="isBlackMode()" [class.text-slate-800]="!isBlackMode()" class="text-lg font-black uppercase tracking-widest text-[11px] transition-colors">Primary Access Account</h2>
          </div>

          <div class="col-span-2 md:col-span-1 space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Company Primary Email</label>
            <input type="email" formControlName="company_email" placeholder="hr@company.com" 
                   [class.border-red-500]="companyForm.get('company_email')?.invalid && companyForm.get('company_email')?.touched"
                   class="w-full h-16 bg-slate-50 text-slate-900 border-2 border-transparent rounded-full px-8 outline-none focus:border-blue-500/30 focus:bg-white transition-all font-medium">
          </div>

          <div class="col-span-2 md:col-span-1 space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Initial Password</label>
            <div class="relative group">
              <input [type]="showPassword() ? 'text' : 'password'" 
                     formControlName="initial_password" 
                     placeholder="••••••••" 
                     class="w-full h-16 bg-slate-50 text-slate-900 border-2 border-transparent rounded-full px-8 outline-none focus:border-blue-500/30 focus:bg-white transition-all font-medium pr-12">
              <button type="button" 
                      (click)="showPassword.set(!showPassword())"
                      class="absolute right-6 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 transition-colors">
                <svg *ngIf="!showPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg *ngIf="showPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              </button>
            </div>
          </div>

          <div class="col-span-2 pt-6 flex justify-center">
            <button type="submit" [disabled]="isLoading()" 
                    [class.bg-white]="isBlackMode()" [class.text-slate-900]="isBlackMode()"
                    [class.bg-slate-900]="!isBlackMode()" [class.text-white]="!isBlackMode()"
                    class="w-full max-w-md h-14 hover:opacity-90 rounded-full font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3">
              <span *ngIf="isLoading()" [class.border-slate-900]="isBlackMode()" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Register Enterprise & Provide Access
            </button>
          </div>
        </form>
      </div>

      <!-- Premium Success Overlay -->
      <div *ngIf="showSuccess()" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-2xl animate-in fade-in duration-500">
        <div class="relative w-full max-w-lg bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden scale-up-center border border-white/20">
            
            <!-- Background Decorative Blobs -->
            <div class="absolute top-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            <div class="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

            <div class="relative z-10 flex flex-col items-center text-center">
                <div class="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20 animate-bounce-short">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                
                <h2 class="text-3xl font-black text-slate-900 mb-2 tracking-tight">Enterprise Onboarded</h2>
                <p class="text-slate-500 font-medium mb-8 text-sm max-w-xs mx-auto">The company profile has been successfully created and linked to the active directory.</p>
                
                <div class="w-full bg-slate-50 rounded-3xl p-6 mb-8 border border-slate-100/50 shadow-inner">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-slate-200/50">
                         <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Access ID</span>
                         <code class="text-blue-600 font-black text-sm">{{ createdCredentials()?.email }}</code>
                    </div>
                    <div class="flex items-center justify-between">
                         <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Temp Pass</span>
                         <div class="flex items-center gap-2">
                            <code class="text-slate-900 font-black text-sm">{{ createdCredentials()?.pass }}</code>
                            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                         </div>
                    </div>
                </div>

                <button (click)="closeSuccess()" class="group w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3">
                    <span>Continue to Dashboard</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="group-hover:translate-x-1 transition-transform"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
            </div>
        </div>
      </div>

    </div>
  ` ,
  styles: [`
    .plan-card {
      @apply bg-white border-2 border-slate-50 p-6 rounded-[2.5rem] cursor-pointer transition-all relative overflow-hidden;
      box-shadow: 0 10px 30px -15px rgba(0,0,0,0.05);
    }
    .plan-card:hover {
        @apply border-emerald-100 bg-emerald-50/10 -translate-y-1;
    }
    .active-plan {
      @apply border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/10;
    }
    .plan-header {
      @apply flex flex-col gap-1;
    }
    .plan-tag {
      @apply text-[10px] font-black uppercase tracking-widest text-slate-400;
    }
    .active-plan .plan-tag {
      @apply text-emerald-600;
    }
    .plan-price {
      @apply text-2xl font-black text-slate-900;
    }
    .plan-check {
      @apply absolute top-5 right-5 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center scale-0 transition-transform duration-300;
    }
    .active-plan .plan-check {
      @apply scale-100;
    }
    .premium-date-input::-webkit-calendar-picker-indicator {
      @apply opacity-0 cursor-pointer absolute right-0 top-0 w-full h-full;
    }
    .pm-button {
      @apply px-8 py-4 rounded-full bg-white border-2 border-slate-100 text-slate-500 transition-all active:scale-95 hover:border-emerald-200 hover:bg-emerald-50/10 hover:text-emerald-700;
    }
    .active-pm {
      @apply border-emerald-500 bg-emerald-50/50 text-emerald-900 shadow-lg shadow-emerald-500/10;
    }
    .select-shell {
      @apply relative h-16 bg-white border-2 border-slate-100 rounded-2xl transition-all duration-200 shadow-sm;
    }
    .select-shell:hover {
      @apply border-slate-200;
    }
    .select-shell:focus-within {
      @apply border-blue-500 ring-4 ring-blue-500/10;
    }
    .select-shell.select-invalid {
      @apply border-red-500 ring-4 ring-red-500/10;
    }
    .select-icon {
      @apply absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none;
    }
    .select-arrow {
      @apply absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center pointer-events-none group-focus-within:text-blue-500 group-focus-within:border-blue-200 transition-all duration-200;
    }
  `]
})
export class AddCompanyComponent {
  todayDate = this.formatDateForInput(new Date());

  governorates = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Béja',
    'Jendouba', 'Le Kef', 'Siliana', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Sousse',
    'Monastir', 'Mahdia', 'Sfax', 'Gafsa', 'Tozeur', 'Kebili', 'Gabès', 'Medenine', 'Tataouine'
  ];

  private readonly fallbackIndustries = [
    'Technology & Software', 'Financial Services', 'Healthcare & Pharma',
    'Manufacturing', 'Energy & Utilities', 'Telecommunications',
    'Education & Training', 'Horeca (Hotel/Restaurant)', 'Consulting', 'Logistics', 'Retail & E-commerce'
  ];
  industries = [...this.fallbackIndustries];

  paymentMethods = [
    'Cash', 'Bank Transfer', 'Cheque'
  ];

  companyForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    location: new FormControl('', [Validators.required]),
    industry_id: new FormControl('', [Validators.required]),
    international: new FormControl(false),
    country: new FormControl(''),
    description: new FormControl('', [Validators.required]),
    plan_id: new FormControl<number | null>(null, [Validators.required]),
    subscription_start_date: new FormControl(this.todayDate, [Validators.required, notPastDateValidator]),
    subscription_end_date: new FormControl(''),
    payment_method: new FormControl('', [Validators.required]),
    amount: new FormControl(0, [Validators.required, Validators.min(0)]),
    notes: new FormControl(''),
    company_type: new FormControl('company', [Validators.required]),
    employee_count: new FormControl(null),
    company_email: new FormControl('', [Validators.required, Validators.email]),
    initial_password: new FormControl('123456', [Validators.required])
  });

  isLoading = signal(false);
  showPassword = signal(false);
  isBlackMode = signal(false);
  showSuccess = signal(false);
  isLocationMenuOpen = signal(false);
  isIndustryMenuOpen = signal(false);
  isPlansLoading = signal(false);
  subscriptionPlans = signal<SubscriptionPlanOption[]>([]);
  createdCredentials = signal<{ email: string, pass: string } | null>(null);

  private apiService = inject(ApiService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private elementRef = inject(ElementRef<HTMLElement>);

  constructor() {
    this.loadIndustries();

    // Black mode trigger
    this.companyForm.get('name')?.valueChanges.subscribe(name => {
      this.isBlackMode.set(!!name && name.toLowerCase().includes('black'));
    });

    // Load matching plans whenever entity type changes
    this.companyForm.get('company_type')?.valueChanges.subscribe(type => {
      const planType: PlanType = type === 'startup' ? 'startup' : 'company';
      this.loadSubscriptionPlans(planType);
    });

    // Keep derived subscription values in sync with selected plan
    this.companyForm.get('plan_id')?.valueChanges.subscribe(() => {
      const selectedPlan = this.getSelectedPlan();
      this.companyForm.patchValue({ amount: selectedPlan ? Number(selectedPlan.price) : 0 }, { emitEvent: false });
      this.calculateEndDate();
    });
    this.companyForm.get('subscription_start_date')?.valueChanges.subscribe(() => this.calculateEndDate());

    // Initial load
    this.loadSubscriptionPlans('company');
    this.calculateEndDate();
    this.companyForm.patchValue({ amount: 0 }, { emitEvent: false });
  }

  selectCompanyType(type: PlanType) {
    if (this.companyForm.get('company_type')?.value === type) return;
    this.companyForm.patchValue({ company_type: type });
  }

  selectPlan(planId: number) {
    this.companyForm.patchValue({ plan_id: planId });
    this.companyForm.get('plan_id')?.markAsTouched();
  }

  formatPlanDuration(durationDays: number): string {
    if (durationDays % 365 === 0) {
      const years = durationDays / 365;
      return `${years} year${years > 1 ? 's' : ''}`;
    }

    if (durationDays % 30 === 0) {
      const months = durationDays / 30;
      return `${months} month${months > 1 ? 's' : ''}`;
    }

    return `${durationDays} days`;
  }

  toggleLocationDropdown() {
    this.isLocationMenuOpen.update(open => !open);
    if (this.isLocationMenuOpen()) {
      this.isIndustryMenuOpen.set(false);
    }
  }

  toggleIndustryDropdown() {
    this.isIndustryMenuOpen.update(open => !open);
    if (this.isIndustryMenuOpen()) {
      this.isLocationMenuOpen.set(false);
    }
  }

  selectLocation(governorate: string) {
    this.companyForm.patchValue({ location: governorate });
    this.companyForm.get('location')?.markAsTouched();
    this.isLocationMenuOpen.set(false);
  }

  selectIndustry(industry: string) {
    this.companyForm.patchValue({ industry_id: industry });
    this.companyForm.get('industry_id')?.markAsTouched();
    this.isIndustryMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target || !this.elementRef.nativeElement) return;

    if (!target.closest('#location-dropdown')) {
      this.isLocationMenuOpen.set(false);
    }
    if (!target.closest('#industry-dropdown')) {
      this.isIndustryMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress() {
    this.isLocationMenuOpen.set(false);
    this.isIndustryMenuOpen.set(false);
  }

  calculateEndDate() {
    const startDateVal = this.companyForm.get('subscription_start_date')?.value;
    const selectedPlan = this.getSelectedPlan();

    if (startDateVal && selectedPlan) {
      const startDate = new Date(startDateVal);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + Number(selectedPlan.duration_days));

      this.companyForm.patchValue({
        subscription_end_date: endDate.toISOString().split('T')[0]
      }, { emitEvent: false });
    } else {
      this.companyForm.patchValue({
        subscription_end_date: ''
      }, { emitEvent: false });
    }
  }

  private getSelectedPlan(): SubscriptionPlanOption | null {
    const selectedId = Number(this.companyForm.get('plan_id')?.value);
    if (!selectedId) return null;

    return this.subscriptionPlans().find(plan => plan.id === selectedId) || null;
  }

  private loadSubscriptionPlans(planType: PlanType) {
    this.isPlansLoading.set(true);
    this.apiService.get<{ success: boolean; data: SubscriptionPlanOption[] }>(`admin/subscription-plans?plan_type=${planType}`).subscribe({
      next: (response) => {
        const plans = (response?.data || []).filter(plan => plan.is_active !== false);
        this.subscriptionPlans.set(plans);

        const selectedId = Number(this.companyForm.get('plan_id')?.value);
        const selectedStillValid = plans.some(plan => plan.id === selectedId);

        if (!selectedStillValid) {
          this.companyForm.patchValue({ plan_id: plans[0]?.id ?? null });
        }

        this.isPlansLoading.set(false);
      },
      error: (error) => {
        this.isPlansLoading.set(false);
        this.subscriptionPlans.set([]);
        this.companyForm.patchValue({ plan_id: null, amount: 0, subscription_end_date: '' }, { emitEvent: false });
        this.notificationService.error(error?.error?.message || 'Failed to load subscription plans.');
      }
    });
  }

  private loadIndustries() {
    this.apiService.get<{ success: boolean; data: IndustryOption[] }>('admin/industries').subscribe({
      next: (response) => {
        const values = (response?.data || [])
          .map((item) => String(item?.name || '').trim())
          .filter((name, index, arr) => !!name && arr.indexOf(name) === index);

        if (values.length > 0) {
          this.industries = values;
        }
      },
      error: () => {
        this.industries = [...this.fallbackIndustries];
      }
    });
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onSubmit() {
    this.companyForm.markAllAsTouched();

    console.log('Form Validity:', this.companyForm.valid);
    console.log('Form Value:', this.companyForm.value);

    if (this.companyForm.invalid) {
      const invalidControls = [];
      for (const name in this.companyForm.controls) {
        if (this.companyForm.get(name)?.invalid) {
          invalidControls.push(name);
        }
      }
      console.warn('Invalid fields:', invalidControls);
      this.notificationService.warning('Please fill the following required fields: ' + invalidControls.join(', '));
      return;
    }

    this.isLoading.set(true);

    const formData = this.companyForm.value;

    this.apiService.post('admin/companies', formData).subscribe({
      next: (response: any) => {
        this.isLoading.set(false);

        // Handle both old and new response formats
        if (response.success !== false) {
          this.createdCredentials.set({
            email: formData.company_email || '',
            pass: formData.initial_password || ''
          });
          this.showSuccess.set(true);
          this.notificationService.success(response.message || 'Company registered successfully!');
        } else {
          this.notificationService.error(response.message || 'Failed to register company');
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('Error adding company:', error);

        // Extract error message from response
        let errorMessage = 'Failed to register company.';

        if (error.error) {
          // Handle validation errors
          if (error.error.errors) {
            const validationErrors = error.error.errors;
            const errorFields = Object.keys(validationErrors);
            const errorMessages = errorFields.map(field =>
              `${field}: ${validationErrors[field].join(', ')}`
            ).join('\n');
            errorMessage = `Validation errors:\n${errorMessages}`;
            this.notificationService.error(errorMessage);
            return;
          }

          // Handle other error messages
          if (error.error.message) {
            errorMessage = error.error.message;
          } else if (error.error.error) {
            errorMessage = error.error.error;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }

        this.notificationService.error(errorMessage);
      }
    });
  }

  closeSuccess() {
    this.showSuccess.set(false);
    this.router.navigate(['/admin/companies']);
  }
}
