import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

interface Industry {
  id: number;
  name: string;
  description: string | null;
  companies_count: number;
  created_at?: string | null;
}

@Component({
  selector: 'app-admin-industries',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="relative min-h-screen overflow-hidden rounded-[36px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-6 lg:p-8">
      <div class="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl"></div>

      <div class="relative z-10">
        <div class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-center">
          <div class="flex justify-start">
            <a
              routerLink="/admin/dashboard"
              class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow"
            >
              <span class="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </span>
              Dashboard
            </a>
          </div>

          <div class="text-center">
            <h1 class="text-3xl font-black tracking-tight text-slate-900">Industry Management</h1>
            <p class="mt-1 text-sm text-slate-500">Create and maintain company industry options used in admin forms.</p>
          </div>

          <div class="flex justify-start lg:justify-end">
            <button
              type="button"
              (click)="openCreateForm()"
              class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800"
            >
              <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </span>
              Add Industry
            </button>
          </div>
        </div>
        <div *ngIf="formVisible()" class="mb-8 overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
          <div class="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-bold text-slate-900">{{ editingIndustryId() ? 'Edit Industry' : 'Create Industry' }}</h2>
                <p class="text-xs text-slate-500">Name is required and must be unique.</p>
              </div>
              <button
                type="button"
                (click)="closeForm()"
                class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>

          <form [formGroup]="industryForm" (ngSubmit)="saveIndustry()" class="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</label>
              <input
                type="text"
                formControlName="name"
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                placeholder="e.g. Fintech"
              />
            </div>

            <div class="space-y-2 lg:col-span-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Description (Optional)</label>
              <textarea
                rows="3"
                formControlName="description"
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                placeholder="Short description of this industry..."
              ></textarea>
            </div>

            <div class="lg:col-span-2 flex items-center justify-end gap-2">
              <button
                type="button"
                (click)="closeForm()"
                class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="isSaving()"
                class="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {{ isSaving() ? 'Saving...' : (editingIndustryId() ? 'Update Industry' : 'Create Industry') }}
              </button>
            </div>
          </form>
        </div>

        <div class="overflow-hidden rounded-[32px] border border-slate-200/90 bg-white/95 shadow-xl shadow-slate-200/40 backdrop-blur-sm">
          <div class="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
            <div class="flex items-center justify-between gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-700">Industries Directory</h3>
              <span class="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                {{ industries().length }} total
              </span>
            </div>
          </div>

          <div *ngIf="isLoading()" class="p-10 text-center text-sm font-medium text-slate-500">
            <span class="inline-flex items-center gap-2">
              <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500"></span>
              Loading industries...
            </span>
          </div>

          <div *ngIf="!isLoading() && industries().length === 0" class="p-12 text-center">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21 5-5 5 5"></path><path d="M12 16V3"></path><path d="M4 7h16"></path></svg>
            </div>
            <p class="mt-4 text-sm font-semibold text-slate-700">No industries found.</p>
            <p class="mt-1 text-xs text-slate-500">Use the "Add Industry" button to create your first one.</p>
          </div>

          <div *ngIf="!isLoading() && industries().length > 0" class="overflow-x-auto p-3">
            <table class="w-full min-w-[620px] border-separate border-spacing-y-3 text-left">
              <thead>
                <tr class="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <th class="px-6 py-2">Industry</th>
                  <th class="px-6 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                <tr
                  *ngFor="let industry of industries()"
                  class="group rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white to-slate-50/60 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                >
                  <td class="rounded-l-2xl px-6 py-4">
                    <div class="flex items-center gap-4">
                      <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-white text-sm font-black uppercase text-blue-600 ring-1 ring-blue-100 shadow-sm">
                        {{ industry.name.charAt(0) }}
                      </span>
                      <div>
                        <div class="font-bold text-slate-900">{{ industry.name }}</div>
                        <div 
                          *ngIf="industry.description"
                          class="mt-1 max-w-xs truncate text-xs font-medium text-slate-500" 
                          [attr.title]="industry.description"
                        >
                          {{ industry.description }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="rounded-r-2xl px-6 py-4">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        (click)="openEditForm(industry)"
                        class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        (click)="requestDelete(industry)"
                        class="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 shadow-sm transition-all hover:bg-red-100 active:scale-95"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path></svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div *ngIf="industryToDelete()" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" (click)="cancelDelete()"></div>
        <div class="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
          <h3 class="text-lg font-bold text-slate-900">Delete Industry</h3>
          <p class="mt-2 text-sm text-slate-600">
            Delete <span class="font-semibold">{{ industryToDelete()?.name }}</span>?
          </p>
          <div class="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              (click)="cancelDelete()"
              class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="confirmDelete()"
              [disabled]="isDeleting()"
              class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ isDeleting() ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class IndustriesComponent implements OnInit {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);

  industries = signal<Industry[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  isDeleting = signal(false);
  formVisible = signal(false);
  editingIndustryId = signal<number | null>(null);
  industryToDelete = signal<Industry | null>(null);

  industryForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  ngOnInit(): void {
    this.loadIndustries();
  }

  loadIndustries(): void {
    this.isLoading.set(true);
    this.apiService.get<{ success: boolean; data: Industry[] }>('admin/industries').subscribe({
      next: (response) => {
        this.industries.set(response?.data || []);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.notificationService.error(error?.error?.message || 'Failed to load industries.');
      },
    });
  }

  openCreateForm(): void {
    this.editingIndustryId.set(null);
    this.industryForm.reset({ name: '', description: '' });
    this.formVisible.set(true);
  }

  openEditForm(industry: Industry): void {
    this.editingIndustryId.set(industry.id);
    this.industryForm.reset({
      name: industry.name || '',
      description: industry.description || '',
    });
    this.formVisible.set(true);
  }

  closeForm(): void {
    this.formVisible.set(false);
    this.editingIndustryId.set(null);
    this.industryForm.reset({ name: '', description: '' });
  }

  saveIndustry(): void {
    if (this.industryForm.invalid) {
      this.industryForm.markAllAsTouched();
      this.notificationService.warning('Please provide a valid industry name.');
      return;
    }

    const industryId = this.editingIndustryId();
    const payload = {
      name: this.industryForm.value.name?.trim() || '',
      description: (this.industryForm.value.description || '').trim() || null,
    };

    this.isSaving.set(true);
    const request$ = industryId
      ? this.apiService.put<{ success: boolean; message?: string }>(`admin/industries/${industryId}`, payload)
      : this.apiService.post<{ success: boolean; message?: string }>('admin/industries', payload);

    request$.subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.notificationService.success(response?.message || `Industry ${industryId ? 'updated' : 'created'} successfully.`);
        this.closeForm();
        this.loadIndustries();
      },
      error: (error) => {
        this.isSaving.set(false);
        this.notificationService.error(error?.error?.message || 'Failed to save industry.');
      },
    });
  }

  requestDelete(industry: Industry): void {
    if (Number(industry.companies_count || 0) > 0) {
      this.notificationService.warning('This industry is in use and cannot be deleted.');
      return;
    }

    this.industryToDelete.set(industry);
  }

  cancelDelete(): void {
    this.industryToDelete.set(null);
  }

  confirmDelete(): void {
    const industry = this.industryToDelete();
    if (!industry) return;

    this.isDeleting.set(true);
    this.apiService.delete<{ success: boolean; message?: string }>(`admin/industries/${industry.id}`).subscribe({
      next: (response) => {
        this.isDeleting.set(false);
        this.industryToDelete.set(null);
        this.notificationService.success(response?.message || 'Industry deleted successfully.');
        this.loadIndustries();
      },
      error: (error) => {
        this.isDeleting.set(false);
        this.notificationService.error(error?.error?.message || 'Failed to delete industry.');
      },
    });
  }
}
