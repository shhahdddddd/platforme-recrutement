import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

type PlanType = 'company' | 'startup';

interface SubscriptionPlan {
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

@Component({
  selector: 'app-subscription-plans',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-white p-6 lg:p-8 rounded-[40px] border border-slate-200 overflow-hidden">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <!-- Left: Track Payments -->
          <div class="flex justify-start lg:w-48">
            <a
              routerLink="/admin/subscription-payments"
              class="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              Track Payments
            </a>
          </div>

          <!-- Centered Title Section -->
          <div class="flex-1 flex flex-col items-center text-center">
            <div class="flex items-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div class="text-left">
                <p class="text-xs font-semibold text-blue-600 uppercase tracking-wider">Subscription Management</p>
                <h1 class="text-3xl font-bold text-slate-900">Subscription Plans</h1>
              </div>
            </div>
            <p class="mt-3 text-slate-600 max-w-lg text-center">Manage pricing tiers and feature sets for company and startup subscription plans.</p>
          </div>
          
          <!-- Add Plan Button - Right Aligned -->
          <div class="flex justify-end lg:w-48">
            <button
              type="button"
              (click)="openCreateForm()"
              class="group inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div class="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:rotate-90">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
              Add Plan
            </button>
          </div>
        </div>
      </div>

      <!-- Plan Type Tabs -->
      <div class="mb-8 flex justify-center">
        <div class="inline-flex rounded-[24px] bg-white border border-slate-200 p-1.5">
          <button
            type="button"
            (click)="switchPlanType('company')"
            class="group relative flex items-center gap-2 rounded-[20px] px-5 py-2.5 text-sm font-semibold transition-all duration-300"
            [class.bg-white]="activePlanType() === 'company'"
            [class.text-slate-900]="activePlanType() === 'company'"
            [class.shadow-md]="activePlanType() === 'company'"
            [class.text-slate-500]="activePlanType() !== 'company'"
            [class.hover:text-slate-700]="activePlanType() !== 'company'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class.text-blue-600]="activePlanType() === 'company'" [class.text-slate-400]="activePlanType() !== 'company'"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/></svg>
            Company Plans
          </button>
          <button
            type="button"
            (click)="switchPlanType('startup')"
            class="group relative flex items-center gap-2 rounded-[20px] px-5 py-2.5 text-sm font-semibold transition-all duration-300"
            [class.bg-white]="activePlanType() === 'startup'"
            [class.text-slate-900]="activePlanType() === 'startup'"
            [class.shadow-md]="activePlanType() === 'startup'"
            [class.text-slate-500]="activePlanType() !== 'startup'"
            [class.hover:text-slate-700]="activePlanType() !== 'startup'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class.text-indigo-600]="activePlanType() === 'startup'" [class.text-slate-400]="activePlanType() !== 'startup'"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            Startup Plans
          </button>
        </div>
      </div>

      <!-- Stats Overview -->
      <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="group relative overflow-hidden rounded-[32px] border border-blue-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-blue-100/50">
          <div class="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-50 opacity-50 transition-transform group-hover:scale-110"></div>
          <div class="relative">
            <div class="flex items-center gap-2">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              </div>
              <p class="text-sm font-medium text-slate-500">Total Plans</p>
            </div>
            <p class="mt-3 text-3xl font-bold text-slate-900">{{ totalPlans() }}</p>
          </div>
        </div>
        <div class="group relative overflow-hidden rounded-[32px] border border-emerald-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-emerald-100/50">
          <div class="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-50 opacity-50 transition-transform group-hover:scale-110"></div>
          <div class="relative">
            <div class="flex items-center gap-2">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <p class="text-sm font-medium text-slate-500">Active</p>
            </div>
            <p class="mt-3 text-3xl font-bold text-emerald-600">{{ activePlans() }}</p>
          </div>
        </div>
        <div class="group relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-slate-200/50">
          <div class="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-slate-50 opacity-50 transition-transform group-hover:scale-110"></div>
          <div class="relative">
            <div class="flex items-center gap-2">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500"><path d="M10 21h4"/><path d="M19.07 4.93A9.95 9.95 0 0 0 12 2a10 10 0 0 0-10 10c0 4.99 3.66 9.12 8.44 9.88"/><path d="m15 10-4 4"/><path d="m19 6-4 4"/></svg>
              </div>
              <p class="text-sm font-medium text-slate-500">Inactive</p>
            </div>
            <p class="mt-3 text-3xl font-bold text-slate-600">{{ inactivePlans() }}</p>
          </div>
        </div>
      </div>

      <!-- Create/Edit Form -->
      <div *ngIf="formVisible()" class="mb-8 overflow-hidden rounded-[40px] border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-100 bg-white px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <div>
                <h2 class="text-lg font-semibold text-slate-900">{{ editingPlanId() ? 'Edit Plan' : 'Create New Plan' }}</h2>
                <p class="text-xs text-slate-500">{{ editingPlanId() ? 'Update plan details and features' : 'Configure a new subscription tier' }}</p>
              </div>
            </div>
            <button
              type="button"
              (click)="closeForm()"
              class="group flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600 hover:shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <form [formGroup]="planForm" (ngSubmit)="savePlan()" class="p-6">
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Plan Name</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <input
                  type="text"
                  formControlName="name"
                  class="block w-full rounded-xl border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  placeholder="e.g., Growth, Premium, Enterprise..."
                >
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Plan Type</label>
              <div class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class.text-blue-600]="activePlanType() === 'company'" [class.text-indigo-600]="activePlanType() === 'startup'"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/></svg>
                </span>
                <span class="text-sm font-medium text-slate-700">{{ activePlanType() === 'company' ? 'Company' : 'Startup' }}</span>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Price (TND)</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  formControlName="price"
                  class="block w-full rounded-xl border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  placeholder="0.00"
                >
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Duration (Days)</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <input
                  type="number"
                  min="1"
                  formControlName="duration_days"
                  class="block w-full rounded-xl border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  placeholder="90"
                >
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Max Job Offers</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                </div>
                <input
                  type="number"
                  min="0"
                  formControlName="max_job_offers"
                  class="block w-full rounded-xl border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  placeholder="0"
                >
              </div>
            </div>

            <div class="space-y-2 lg:col-span-2">
              <label class="text-sm font-semibold text-slate-700">Description</label>
              <div class="relative">
                <div class="absolute left-3 top-3 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="6" x2="8" y2="6"/><line x1="2" y1="18" x2="12" y2="18"/></svg>
                </div>
                <textarea
                  rows="3"
                  formControlName="description"
                  class="block w-full rounded-xl border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Short description shown in pricing screens..."
                ></textarea>
              </div>
            </div>
          </div>

          <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <p class="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Plan Features
            </p>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <!-- AI Features Toggle -->
              <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                <span class="text-sm font-medium text-slate-700">AI Features</span>
                <div class="flex items-center gap-3">
                  <span class="text-xs font-semibold" [class.text-emerald-600]="planForm.value.ai_features_enabled" [class.text-slate-400]="!planForm.value.ai_features_enabled">
                    {{ planForm.value.ai_features_enabled ? 'Enabled' : 'Disabled' }}
                  </span>
                  <button type="button"
                          (click)="planForm.patchValue({ ai_features_enabled: !planForm.value.ai_features_enabled })"
                          class="relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-200 focus:outline-none"
                          [class.bg-emerald-500]="planForm.value.ai_features_enabled"
                          [class.shadow-emerald-500/30]="planForm.value.ai_features_enabled"
                          [class.bg-slate-300]="!planForm.value.ai_features_enabled"
                          [class.shadow-slate-300/30]="!planForm.value.ai_features_enabled"
                          [class.shadow-lg]="true">
                    <span class="inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200"
                          [class.translate-x-9]="planForm.value.ai_features_enabled"
                          [class.translate-x-1]="!planForm.value.ai_features_enabled"></span>
                  </button>
                </div>
              </div>

              <!-- Priority Support Toggle -->
              <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                <span class="text-sm font-medium text-slate-700">Priority Support</span>
                <div class="flex items-center gap-3">
                  <span class="text-xs font-semibold"
                        [class.text-emerald-600]="planForm.value.has_priority_support"
                        [class.text-slate-400]="!planForm.value.has_priority_support">
                    {{ planForm.value.has_priority_support ? 'Enabled' : 'Disabled' }}
                  </span>
                  <button type="button"
                          (click)="planForm.patchValue({ has_priority_support: !planForm.value.has_priority_support })"
                          class="relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-200 focus:outline-none"
                          [class.bg-emerald-500]="planForm.value.has_priority_support"
                          [class.shadow-emerald-500/30]="planForm.value.has_priority_support"
                          [class.bg-slate-300]="!planForm.value.has_priority_support"
                          [class.shadow-slate-300/30]="!planForm.value.has_priority_support"
                          [class.shadow-lg]="true">
                    <span class="inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200"
                          [class.translate-x-9]="planForm.value.has_priority_support"
                          [class.translate-x-1]="!planForm.value.has_priority_support"></span>
                  </button>
                </div>
              </div>

              <!-- Chat System Toggle -->
              <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                <span class="text-sm font-medium text-slate-700">Chat System</span>
                <div class="flex items-center gap-3">
                  <span class="text-xs font-semibold" [class.text-emerald-600]="planForm.value.has_advanced_analytics" [class.text-slate-400]="!planForm.value.has_advanced_analytics">
                    {{ planForm.value.has_advanced_analytics ? 'Enabled' : 'Disabled' }}
                  </span>
                  <button type="button"
                          (click)="planForm.patchValue({ has_advanced_analytics: !planForm.value.has_advanced_analytics })"
                          class="relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-200 focus:outline-none"
                          [class.bg-emerald-500]="planForm.value.has_advanced_analytics"
                          [class.shadow-emerald-500/30]="planForm.value.has_advanced_analytics"
                          [class.bg-slate-300]="!planForm.value.has_advanced_analytics"
                          [class.shadow-slate-300/30]="!planForm.value.has_advanced_analytics"
                          [class.shadow-lg]="true">
                    <span class="inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200"
                          [class.translate-x-9]="planForm.value.has_advanced_analytics"
                          [class.translate-x-1]="!planForm.value.has_advanced_analytics"></span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              (click)="closeForm()"
              class="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="isSaving()"
              class="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30 hover:scale-[1.02] disabled:opacity-50"
            >
              <span *ngIf="isSaving()" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              <svg *ngIf="!isSaving()" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {{ editingPlanId() ? 'Save Changes' : 'Create Plan' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading()" class="flex flex-col items-center justify-center py-16">
        <div class="relative">
          <div class="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-blue-400/20"></div>
          <div class="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin text-white"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
          </div>
        </div>
        <p class="mt-4 text-sm font-medium text-slate-600">Loading plans...</p>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading() && plans().length === 0" class="rounded-[40px] border border-dashed border-slate-300 bg-white p-16 text-center">
        <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>
        <p class="mt-6 text-lg font-semibold text-slate-900">No {{ activePlanType() }} plans yet</p>
        <p class="mt-2 text-sm text-slate-500 max-w-sm mx-auto">Create your first subscription plan to offer pricing tiers to your users</p>
        <button
          type="button"
          (click)="openCreateForm()"
          class="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Create Your First Plan
        </button>
      </div>

      <!-- Plans List -->
      <div *ngIf="!isLoading() && plans().length > 0" class="space-y-4">
        <div
          *ngFor="let plan of plans()"
          class="group relative overflow-hidden rounded-[32px] border p-6 shadow-sm transition-all duration-300 hover:shadow-lg"
          [class.bg-blue-50]="plan.plan_type === 'company'"
          [class.bg-white]="plan.plan_type !== 'company'"
          [class.border-slate-200]="plan.is_active"
          [class.border-slate-100]="!plan.is_active"
          [class.opacity-75]="!plan.is_active"
        >
          <!-- Inactive overlay stripe -->
          <div *ngIf="!plan.is_active" class="absolute inset-x-0 top-0 h-1 bg-slate-300"></div>
          <div *ngIf="plan.is_active" class="absolute inset-x-0 top-0 h-1 bg-blue-500"></div>

          <div class="relative">
            <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex-1">
                <div class="flex flex-wrap items-center gap-3">
                  <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 shadow-sm">
                    <span class="text-lg font-bold text-blue-600">{{ plan.name.charAt(0) }}</span>
                  </div>
                  <h3 class="text-xl font-bold text-slate-900">{{ plan.name }}</h3>
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                    [class.bg-emerald-100]="plan.is_active"
                    [class.text-emerald-700]="plan.is_active"
                    [class.bg-slate-100]="!plan.is_active"
                    [class.text-slate-600]="!plan.is_active"
                  >
                    <span *ngIf="plan.is_active" class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    {{ plan.is_active ? 'Active' : 'Inactive' }}
                  </span>
                  <span class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {{ durationLabel(plan) }}
                  </span>
                </div>
                <p class="mt-3 text-sm text-slate-600 max-w-xl">{{ plan.description || 'No description available' }}</p>
              </div>

              <div class="flex-shrink-0 text-right">
                <p class="text-sm font-medium text-slate-500">Monthly Price</p>
                <div class="mt-1 flex items-baseline justify-end gap-1">
                  <span class="text-3xl font-bold text-slate-900">{{ plan.price | number:'1.0-2' }}</span>
                  <span class="text-sm font-medium text-slate-400">TND</span>
                </div>
              </div>
            </div>

            <!-- Features Grid -->
            <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div class="group/stat rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm">
                <div class="flex items-center gap-2">
                  <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                  </div>
                  <p class="text-xs font-medium text-slate-500">Job Offers</p>
                </div>
                <p class="mt-2 text-xl font-bold text-slate-900">{{ plan.max_job_offers }}</p>
              </div>
              <div class="group/stat rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="flex h-7 w-7 items-center justify-center rounded-lg" [class.bg-amber-50]="plan.has_ai_access" [class.bg-slate-100]="!plan.has_ai_access">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class.text-amber-500]="plan.has_ai_access" [class.text-slate-400]="!plan.has_ai_access"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                    </div>
                    <p class="text-xs font-medium text-slate-500">AI Access</p>
                  </div>
                  <button type="button"
                          (click)="togglePlanFeature(plan, 'has_ai_access')"
                          class="relative inline-flex h-6 w-10 items-center rounded-full transition-all duration-200 focus:outline-none"
                          [class.bg-amber-500]="plan.has_ai_access"
                          [class.shadow-amber-500/30]="plan.has_ai_access"
                          [class.bg-slate-300]="!plan.has_ai_access"
                          [class.shadow-slate-300/30]="!plan.has_ai_access">
                    <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200"
                          [class.translate-x-5]="plan.has_ai_access"
                          [class.translate-x-1]="!plan.has_ai_access"></span>
                  </button>
                </div>
              </div>
              <div class="group/stat rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="flex h-7 w-7 items-center justify-center rounded-lg" [class.bg-purple-50]="plan.has_advanced_analytics" [class.bg-slate-100]="!plan.has_advanced_analytics">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class.text-purple-600]="plan.has_advanced_analytics" [class.text-slate-400]="!plan.has_advanced_analytics"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <p class="text-xs font-medium text-slate-500">Chat</p>
                  </div>
                  <button type="button"
                          (click)="togglePlanFeature(plan, 'has_advanced_analytics')"
                          class="relative inline-flex h-6 w-10 items-center rounded-full transition-all duration-200 focus:outline-none"
                          [class.bg-purple-500]="plan.has_advanced_analytics"
                          [class.shadow-purple-500/30]="plan.has_advanced_analytics"
                          [class.bg-slate-300]="!plan.has_advanced_analytics"
                          [class.shadow-slate-300/30]="!plan.has_advanced_analytics">
                    <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200"
                          [class.translate-x-5]="plan.has_advanced_analytics"
                          [class.translate-x-1]="!plan.has_advanced_analytics"></span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                (click)="openEditForm(plan)"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              <div class="flex-1"></div>
              <button
                type="button"
                (click)="togglePlanStatus(plan)"
                class="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
                [class.bg-amber-50]="plan.is_active"
                [class.text-amber-700]="plan.is_active"
                [class.border]="plan.is_active"
                [class.border-amber-200]="plan.is_active"
                [class.hover:bg-amber-100]="plan.is_active"
                [class.shadow-sm]="plan.is_active"
                [class.bg-emerald-50]="!plan.is_active"
                [class.text-emerald-700]="!plan.is_active"
                [class.hover:bg-emerald-100]="!plan.is_active"
                [class.border]="!plan.is_active"
                [class.border-emerald-200]="!plan.is_active"
                [class.shadow-sm]="!plan.is_active"
              >
                <svg *ngIf="plan.is_active" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                <svg *ngIf="!plan.is_active" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                {{ plan.is_active ? 'Deactivate' : 'Activate' }}
              </button>
              <button
                type="button"
                (click)="deletePlan(plan)"
                class="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-all hover:bg-red-100 hover:shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- PREMIUM DELETE CONFIRMATION MODAL -->
      <div *ngIf="planToDelete()" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop with blur -->
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" (click)="cancelDelete()"></div>
        
        <!-- Modal Content -->
        <div class="relative w-full max-w-md transform transition-all">
          <!-- Decorative glow -->
          <div class="absolute -inset-1 rounded-[32px] blur opacity-10 bg-red-200"></div>
          
          <div class="relative bg-white rounded-[28px] shadow-2xl shadow-slate-900/20 overflow-hidden">
            <!-- Header with gradient -->
            <div class="relative px-6 pt-6 pb-4 bg-white">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-slate-900">Delete Plan</h3>
                  <p class="text-sm text-slate-500">This action cannot be undone</p>
                </div>
              </div>
            </div>
            
            <!-- Body -->
            <div class="px-6 py-5">
              <p class="text-slate-600 leading-relaxed">
                Are you sure you want to delete <span class="font-semibold text-slate-900">"{{ planToDelete()?.name }}"</span>? This will permanently remove the subscription plan from your system.
              </p>
              
              <!-- Warning box -->
              <div class="mt-4 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500 shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p class="text-sm text-amber-700 font-medium">All associated data with this plan will be lost.</p>
              </div>
            </div>
            
            <!-- Footer with actions -->
            <div class="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="cancelDelete()"
                class="px-5 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="confirmDelete()"
                class="px-5 py-2.5 rounded-2xl bg-red-600 text-white text-sm font-semibold shadow-sm hover:bg-red-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SubscriptionPlansComponent implements OnInit {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);

  activePlanType = signal<PlanType>('company');
  plans = signal<SubscriptionPlan[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  formVisible = signal(false);
  editingPlanId = signal<number | null>(null);
  planToDelete = signal<SubscriptionPlan | null>(null);

  totalPlans = computed(() => this.plans().length);
  activePlans = computed(() => this.plans().filter((plan) => plan.is_active).length);
  inactivePlans = computed(() => this.plans().filter((plan) => !plan.is_active).length);

  planForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl(''),
    price: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    duration_days: new FormControl(90, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    max_job_offers: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    max_job_posts: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    ai_features_enabled: new FormControl(false, { nonNullable: true }),
    has_ai_access: new FormControl(false, { nonNullable: true }),
    has_priority_support: new FormControl(false, { nonNullable: true }),
    has_advanced_analytics: new FormControl(false, { nonNullable: true }),
    is_active: new FormControl(true, { nonNullable: true }),
    display_order: new FormControl(0, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadPlans();
  }

  switchPlanType(type: PlanType): void {
    if (this.activePlanType() === type) return;
    this.activePlanType.set(type);
    this.closeForm();
    this.loadPlans();
  }

  openCreateForm(): void {
    this.editingPlanId.set(null);
    this.planForm.reset(this.buildFormValue());
    this.formVisible.set(true);
  }

  openEditForm(plan: SubscriptionPlan): void {
    this.editingPlanId.set(plan.id);
    this.planForm.reset(this.buildFormValue(plan));
    this.formVisible.set(true);
  }

  closeForm(): void {
    this.formVisible.set(false);
    this.editingPlanId.set(null);
    this.planForm.reset(this.buildFormValue());
  }

  loadPlans(): void {
    this.isLoading.set(true);
    const endpoint = `admin/subscription-plans?plan_type=${this.activePlanType()}&include_inactive=true`;

    this.apiService.get<{ success: boolean; data: SubscriptionPlan[] }>(endpoint).subscribe({
      next: (response) => {
        this.plans.set((response?.data || []).slice().sort((left, right) => left.display_order - right.display_order || left.id - right.id));
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.notificationService.error(error?.error?.message || 'Failed to load subscription plans.');
      },
    });
  }

  savePlan(): void {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      this.notificationService.warning('Please complete the required subscription plan fields.');
      return;
    }

    this.isSaving.set(true);
    const planId = this.editingPlanId();
    const payload = this.buildPayload();

    const request$ = planId
      ? this.apiService.put<{ success: boolean; message?: string }>(`admin/subscription-plans/${planId}`, payload)
      : this.apiService.post<{ success: boolean; message?: string }>('admin/subscription-plans', payload);

    request$.subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.notificationService.success(response?.message || `Plan ${planId ? 'updated' : 'created'} successfully.`);
        this.closeForm();
        this.loadPlans();
      },
      error: (error) => {
        this.isSaving.set(false);
        this.notificationService.error(error?.error?.message || 'Failed to save subscription plan.');
      },
    });
  }

  togglePlanStatus(plan: SubscriptionPlan): void {
    this.apiService.patch<{ success: boolean; message?: string }>(`admin/subscription-plans/${plan.id}/toggle-status`, {}).subscribe({
      next: (response) => {
        this.notificationService.success(response?.message || 'Plan status updated.');
        this.loadPlans();
      },
      error: (error) => {
        this.notificationService.error(error?.error?.message || 'Failed to update plan status.');
      },
    });
  }

  togglePlanFeature(plan: SubscriptionPlan, feature: 'has_ai_access' | 'has_advanced_analytics'): void {
    const currentValue = plan[feature];
    const payload = {
      [feature]: !currentValue
    };

    this.apiService.put<{ success: boolean; message?: string }>(`admin/subscription-plans/${plan.id}`, payload).subscribe({
      next: (response) => {
        this.notificationService.success(response?.message || 'Plan feature updated.');
        this.loadPlans();
      },
      error: (error) => {
        this.notificationService.error(error?.error?.message || 'Failed to update plan feature.');
      },
    });
  }

  deletePlan(plan: SubscriptionPlan): void {
    this.planToDelete.set(plan);
  }

  cancelDelete(): void {
    this.planToDelete.set(null);
  }

  confirmDelete(): void {
    const plan = this.planToDelete();
    if (!plan) return;
    
    this.planToDelete.set(null);

    this.apiService.delete<{ success: boolean; message?: string }>(`admin/subscription-plans/${plan.id}`).subscribe({
      next: (response) => {
        this.notificationService.success(response?.message || 'Plan deleted successfully.');
        this.loadPlans();
      },
      error: (error) => {
        this.notificationService.error(error?.error?.message || 'Failed to delete subscription plan.');
      },
    });
  }

  movePlan(plan: SubscriptionPlan, direction: -1 | 1): void {
    const currentPlans = [...this.plans()];
    const currentIndex = currentPlans.findIndex((item) => item.id === plan.id);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentPlans.length) return;

    [currentPlans[currentIndex], currentPlans[targetIndex]] = [currentPlans[targetIndex], currentPlans[currentIndex]];

    const orders = currentPlans.map((item, index) => ({
      id: item.id,
      display_order: index,
    }));

    this.isSaving.set(true);
    this.apiService.post<{ success: boolean; message?: string }>('admin/subscription-plans/reorder', { orders }).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.notificationService.success(response?.message || 'Plan order updated.');
        this.plans.set(
          currentPlans.map((item, index) => ({
            ...item,
            display_order: index,
          })),
        );
      },
      error: (error) => {
        this.isSaving.set(false);
        this.notificationService.error(error?.error?.message || 'Failed to reorder plans.');
      },
    });
  }

  durationLabel(plan: SubscriptionPlan): string {
    if (plan.duration_days % 365 === 0) {
      const years = plan.duration_days / 365;
      return `${years} year${years > 1 ? 's' : ''}`;
    }

    if (plan.duration_days % 30 === 0) {
      const months = plan.duration_days / 30;
      return `${months} month${months > 1 ? 's' : ''}`;
    }

    return `${plan.duration_days} days`;
  }

  private buildFormValue(plan?: SubscriptionPlan) {
    return {
      name: plan?.name ?? '',
      description: plan?.description ?? '',
      price: plan?.price ?? 0,
      duration_days: plan?.duration_days ?? 90,
      max_job_offers: plan?.max_job_offers ?? 0,
      max_job_posts: plan?.max_job_posts ?? 0,
      ai_features_enabled: plan?.ai_features_enabled ?? false,
      has_ai_access: plan?.has_ai_access ?? false,
      has_priority_support: plan?.has_priority_support ?? false,
      has_advanced_analytics: plan?.has_advanced_analytics ?? false,
      is_active: plan?.is_active ?? true,
      display_order: plan?.display_order ?? this.getNextDisplayOrder(),
    };
  }

  private buildPayload() {
    const value = this.planForm.getRawValue();

    return {
      name: value.name.trim(),
      plan_type: this.activePlanType(),
      description: value.description?.trim() || null,
      price: Number(value.price),
      duration_days: Number(value.duration_days),
      max_job_offers: Number(value.max_job_offers),
      max_job_posts: Number(value.max_job_posts),
      ai_features_enabled: Boolean(value.ai_features_enabled),
      has_ai_access: Boolean(value.has_ai_access),
      has_priority_support: Boolean(value.has_priority_support),
      has_advanced_analytics: Boolean(value.has_advanced_analytics),
      is_active: Boolean(value.is_active),
      display_order: Number(value.display_order),
    };
  }

  private getNextDisplayOrder(): number {
    if (this.plans().length === 0) return 0;
    return Math.max(...this.plans().map((plan) => plan.display_order)) + 1;
  }
}
