import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

interface DepartmentItem {
  id: number;
  name: string;
  description?: string | null;
}

@Component({
  selector: 'app-manage-departments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-5xl mx-auto py-10 px-4 font-['Outfit']">
      <div class="mb-8">
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">Manage <span class="text-blue-600">Departments</span></h1>
        <p class="text-slate-500 font-medium">Add departments for your HR workflow using only name and description.</p>
      </div>

      <!-- Startup Mode Restricted Access -->
      <div *ngIf="!departmentsEnabled()" class="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-900 shadow-sm animate-in fade-in duration-500">
        <div class="flex items-start gap-5">
          <div class="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-amber-600"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div class="flex-1">
            <p class="text-[11px] font-black uppercase tracking-widest text-amber-600/70">Restricted Access</p>
            <h3 class="text-xl font-black mt-1">Startup Mode Active</h3>
            <p class="text-sm font-bold mt-2 opacity-80 leading-relaxed max-w-2xl">
              Startups do not use departments by default to keep the workflow agile. 
              If your organization has grown, you need to switch to **Company Type** to unlock department management features.
            </p>
            <button (click)="switchToCompany()" 
                    [disabled]="isSwitching()"
                    class="mt-6 px-10 py-3.5 bg-amber-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-95 shadow-lg shadow-amber-900/20 flex items-center gap-3">
              <span *ngIf="isSwitching()" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Switch to Company Mode
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="departmentsEnabled()" class="space-y-8 animate-in fade-in duration-700">
        
        <!-- Congratulations Banner -->
        <div *ngIf="justSwitched()" class="rounded-2xl bg-emerald-600 p-6 text-white shadow-xl shadow-emerald-500/20 flex items-center justify-between group animate-in slide-in-from-top-4 duration-500">
          <div class="flex items-center gap-4">
             <div class="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
             </div>
             <div>
                <h4 class="text-lg font-black tracking-tight">Congratulations! 🚀</h4>
                <p class="text-xs font-bold text-emerald-50 opacity-90">Your account has been successfully upgraded. You can now define your organizational structure.</p>
             </div>
          </div>
          <button (click)="justSwitched.set(false)" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 p-8">
          <h2 class="text-lg font-black text-slate-900 mb-5">Add Department</h2>

          <form [formGroup]="departmentForm" (ngSubmit)="addDepartment()" class="grid grid-cols-1 gap-4">
            <div>
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
              <input
                formControlName="name"
                class="w-full h-12 mt-2 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all text-black font-bold"
              >
              <div *ngIf="departmentForm.get('name')?.touched && departmentForm.get('name')?.errors?.['required']" class="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">
                Name is required
              </div>
            </div>

            <div>
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Description (Optional)</label>
              <textarea
                formControlName="description"
                rows="3"
                class="w-full mt-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all text-black font-medium resize-none"
              ></textarea>
            </div>

            <div class="flex justify-end">
              <button
                [disabled]="departmentForm.invalid || isSubmitting()"
                class="h-12 px-8 rounded-xl bg-blue-600 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <span *ngIf="isSubmitting()" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ isSubmitting() ? 'Adding...' : 'Add Department' }}
              </button>
            </div>
          </form>
        </div>

        <div class="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 p-8">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-black text-slate-900">Existing Departments</h2>
            <span class="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest">
              {{ departments().length }} total
            </span>
          </div>

          <div *ngIf="isLoading()" class="py-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
            Loading departments...
          </div>

          <div *ngIf="!isLoading() && departments().length === 0" class="py-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
            No departments added yet.
          </div>

          <div *ngIf="!isLoading() && departments().length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div *ngFor="let dep of departments()" class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div class="flex items-start gap-3">
                <div class="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 shadow-sm flex items-center justify-center shrink-0">
                  <svg width="32" height="32" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <line x1="18" y1="7" x2="18" y2="15" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
                    <line x1="46" y1="7" x2="46" y2="15" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
                    <circle cx="18" cy="6" r="4" fill="#fb7185" stroke="#0f172a" stroke-width="3"/>
                    <circle cx="46" cy="6" r="4" fill="#fb7185" stroke="#0f172a" stroke-width="3"/>
                    <rect x="10" y="15" width="44" height="34" rx="11" fill="#7cb7f3" stroke="#0f172a" stroke-width="4"/>
                    <rect x="20" y="25" width="24" height="14" rx="7" fill="#e2e8f0" stroke="#0f172a" stroke-width="3"/>
                    <path d="M28 31h8" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
                    <rect x="3" y="25" width="8" height="14" rx="4" fill="#6f90c8" stroke="#0f172a" stroke-width="3"/>
                    <rect x="53" y="25" width="8" height="14" rx="4" fill="#6f90c8" stroke="#0f172a" stroke-width="3"/>
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <p class="text-sm font-black text-slate-900 break-words">{{ dep.name }}</p>
                  </div>
                  <div class="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 max-w-full">
                    <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="mt-0.5 shrink-0" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.8"/>
                      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#7cb7f3" stroke="#0f172a" stroke-width="1.4"/>
                      <circle cx="12" cy="5" r="1.4" fill="#fb7185" stroke="#0f172a" stroke-width="1.2"/>
                      <circle cx="19" cy="12" r="1.4" fill="#fb7185" stroke="#0f172a" stroke-width="1.2"/>
                      <circle cx="12" cy="19" r="1.4" fill="#fb7185" stroke="#0f172a" stroke-width="1.2"/>
                      <circle cx="5" cy="12" r="1.4" fill="#fb7185" stroke="#0f172a" stroke-width="1.2"/>
                    </svg>
                    <p class="text-xs text-slate-500 font-semibold break-words">{{ dep.description || 'No description' }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ManageDepartmentsComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private fb = inject(FormBuilder);

  departments = signal<DepartmentItem[]>([]);
  departmentsEnabled = signal(true);
  isLoading = signal(false);
  isSubmitting = signal(false);
  isSwitching = signal(false);
  justSwitched = signal(false);

  departmentForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]]
  });

  ngOnInit(): void {
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.isLoading.set(true);
    this.api.get<any>('company/departments').subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const list = (Array.isArray(res) ? res : (res?.data || [])) as DepartmentItem[];
        const companyType = String(res?.company_type || 'company').toLowerCase();
        const enabled = typeof res?.departments_enabled === 'boolean'
          ? !!res.departments_enabled
          : companyType !== 'startup';

        this.departmentsEnabled.set(enabled);
        this.departments.set(list);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.departments.set([]);
        this.notifications.error(err?.error?.message || 'Failed to load departments.');
      }
    });
  }

  switchToCompany(): void {
    this.isSwitching.set(true);
    const payload = { company_type: 'company' };

    this.api.post<any>('company/profile', payload).subscribe({
      next: (res) => {
        this.isSwitching.set(false);
        if (res?.success) {
          this.departmentsEnabled.set(true);
          this.justSwitched.set(true);
          this.notifications.success('Type switched to Company successfully!');
          this.loadDepartments();
        }
      },
      error: (err) => {
        this.isSwitching.set(false);
        this.notifications.error(err?.error?.message || 'Failed to switch company type.');
      }
    });
  }

  addDepartment(): void {
    if (this.departmentForm.invalid || !this.departmentsEnabled()) {
      this.departmentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const payload = {
      name: (this.departmentForm.value.name || '').trim(),
      description: (this.departmentForm.value.description || '').trim() || null
    };

    this.api.post<any>('company/departments', payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res?.success) {
          this.notifications.success(res.message || 'Department added successfully.');
          this.departmentForm.reset({ name: '', description: '' });
          this.loadDepartments();
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.notifications.error(err?.error?.message || 'Failed to add department.');
      }
    });
  }
}
