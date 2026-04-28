import { Component, OnInit, inject, signal, HostListener, ElementRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

interface DepartmentOption {
  id: number;
  name: string;
  description?: string | null;
}

@Component({
  selector: 'app-company-recruiters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-7xl mx-auto pt-9 pb-10 px-4 font-['Outfit']">

      <!-- Header -->
      <div class="mb-10 text-center">
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">Recruiter <span class="text-blue-600">Management</span></h1>
        <p class="text-slate-500 font-medium">
          {{ departmentsEnabled() ? 'Register recruiters and assign them to existing departments.' : 'Startup profile detected: recruiters are managed without departments.' }}
        </p>
      </div>

      <div *ngIf="!departmentsEnabled()" class="mb-10 flex justify-center">
        <div class="max-w-4xl w-full p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
          <p class="text-sm font-black uppercase tracking-widest">Startup mode</p>
          <p class="text-xs font-bold mt-2">This company type does not use departments. Recruiters and job offers are created without department assignment.</p>
        </div>
      </div>

      <!-- Add Recruiter Form -->
      <div class="mb-10 flex justify-center">
        <div class="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 p-8 max-w-4xl w-full">
          <h2 class="text-lg font-black text-slate-900 mb-5">Register New Recruiter</h2>
          <form [formGroup]="recruiterForm" (ngSubmit)="createRecruiter()" class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div class="md:col-span-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input formControlName="full_name" class="w-full h-12 mt-2 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all text-black font-bold">
              <div *ngIf="recruiterForm.get('full_name')?.touched && recruiterForm.get('full_name')?.errors?.['required']" class="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">Name is required</div>
            </div>

            <div class="md:col-span-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <input formControlName="email" type="email" class="w-full h-12 mt-2 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all text-black font-bold">
              <div *ngIf="recruiterForm.get('email')?.touched && recruiterForm.get('email')?.errors" class="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">Valid email is required</div>
            </div>

            <div class="relative group">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div class="relative">
                <input [type]="showPassword() ? 'text' : 'password'" formControlName="password" class="w-full h-12 mt-2 px-4 pr-12 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all text-black font-bold">
                <button type="button" (click)="showPassword.set(!showPassword())" class="absolute right-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors">
                  <svg *ngIf="!showPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg *ngIf="showPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                </button>
              </div>
              <div *ngIf="recruiterForm.get('password')?.touched && recruiterForm.get('password')?.errors?.['minlength']" class="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">Min 8 characters</div>
            </div>

            <div class="relative group">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
              <div class="relative">
                <input [type]="showConfirmPassword() ? 'text' : 'password'" formControlName="confirm_password" class="w-full h-12 mt-2 px-4 pr-12 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all text-black font-bold">
                <button type="button" (click)="showConfirmPassword.set(!showConfirmPassword())" class="absolute right-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors">
                  <svg *ngIf="!showConfirmPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg *ngIf="showConfirmPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                </button>
              </div>
              <div *ngIf="recruiterForm.errors?.['passwordMismatch'] && recruiterForm.get('confirm_password')?.touched" class="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">Passwords do not match</div>
            </div>

            <div>
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number (Optional)</label>
              <input
                formControlName="phone"
                class="w-full h-12 mt-2 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all text-black font-bold"
                (keypress)="onlyNumbers($event)"
                maxlength="8"
              >
              <div *ngIf="recruiterForm.get('phone')?.touched && recruiterForm.get('phone')?.errors?.['pattern']" class="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">Must be exactly 8 digits</div>
            </div>

            <ng-container *ngIf="departmentsEnabled(); else startupDepartmentNote">
              <div>
                <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Department</label>
                <div class="relative mt-2" id="department-dropdown">
                  <button
                    type="button"
                    (click)="toggleDepartment()"
                    class="w-full h-12 px-4 rounded-xl border-2 border-transparent bg-slate-50 focus:bg-white outline-none font-bold text-slate-800 text-left flex items-center justify-between transition-all"
                    [class.border-blue-500]="isDepartmentOpen()"
                    [class.bg-white]="isDepartmentOpen()"
                  >
                    <span class="text-sm truncate">{{ getDepartmentName(recruiterForm.get('department_id')?.value) }}</span>
                    <svg [class.rotate-180]="isDepartmentOpen()" class="transition-transform duration-300 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div *ngIf="isDepartmentOpen()" class="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-2xl border border-slate-200/60 rounded-[1.5rem] shadow-2xl shadow-blue-900/10 p-2 max-h-64 overflow-y-auto custom-scroll animate-in">
                    <div *ngFor="let dep of departments()" (click)="selectDepartment(dep.id)" class="px-4 py-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer font-bold text-slate-700 flex items-center justify-between group mb-1 last:mb-0">
                      <span class="text-xs">{{ dep.name }}</span>
                      <svg *ngIf="recruiterForm.get('department_id')?.value === dep.id" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div *ngIf="departments().length === 0" class="p-4 text-center text-[10px] text-slate-400 font-bold">No departments found</div>
                  </div>
                </div>
                <div *ngIf="recruiterForm.get('department_id')?.touched && recruiterForm.get('department_id')?.errors" class="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">Selection is required</div>
                <div *ngIf="departments().length === 0" class="text-[10px] text-amber-600 font-bold mt-1 ml-1 uppercase">Add at least one department first.</div>
              </div>
            </ng-container>

            <ng-template #startupDepartmentNote>
              <div class="md:col-span-1 flex items-center mt-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-[10px] font-black uppercase tracking-widest text-amber-700">
                Startup company type: no department assignment.
              </div>
            </ng-template>

            <div class="md:col-span-2 mt-4 flex justify-end">
              <button [disabled]="recruiterForm.invalid || creatingRecruiter() || (departmentsEnabled() && departments().length === 0)" class="h-14 px-10 rounded-2xl bg-blue-600 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3">
                <span *ngIf="creatingRecruiter()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ creatingRecruiter() ? 'Authenticating...' : 'Register Recruiter' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Recruiters List -->
      <div class="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden">

        <!-- List Header + Filters -->
        <div class="p-6 border-b border-slate-100">
          <div class="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div>
              <h3 class="text-base font-black text-slate-900">Team Recruiters</h3>
              <p class="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-widest">
                {{ filteredRecruiters().length }} of {{ recruiters().length }} members shown
              </p>
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
              <!-- Search by name -->
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  placeholder="Search by name…"
                  [value]="searchQuery()"
                  (input)="searchQuery.set($any($event.target).value)"
                  class="pl-9 pr-4 h-10 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all w-48"
                >
              </div>
              <!-- Filter by department -->
              <div *ngIf="departmentsEnabled()" class="relative" id="filter-department-dropdown">
                <button
                  type="button"
                  (click)="toggleFilterDepartment()"
                  class="h-10 min-w-[220px] pl-3 pr-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-700 transition-all flex items-center justify-between gap-2"
                  [class.border-blue-500]="isFilterDeptOpen()"
                  [class.bg-white]="isFilterDeptOpen()"
                >
                  <span class="truncate">{{ getFilterDepartmentName() }}</span>
                  <svg [class.rotate-180]="isFilterDeptOpen()" class="transition-transform duration-300 text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>

                <div *ngIf="isFilterDeptOpen()" class="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200/70 rounded-2xl shadow-2xl shadow-slate-900/10 p-2 max-h-64 overflow-y-auto custom-scroll animate-in">
                  <button
                    type="button"
                    (click)="selectFilterDepartment(null)"
                    class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-bold text-slate-700 text-sm flex items-center justify-between group"
                  >
                    <span>All Departments</span>
                    <svg *ngIf="filterDeptId() === null" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>

                  <button
                    type="button"
                    *ngFor="let d of departments()"
                    (click)="selectFilterDepartment(d.id)"
                    class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-bold text-slate-700 text-sm flex items-center justify-between group mt-1"
                  >
                    <span class="truncate">{{ d.name }}</span>
                    <svg *ngIf="filterDeptId() === d.id" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-slate-50">
                <th class="text-left px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Member</th>
                <th class="text-left px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</th>
                <th class="text-left px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Department</th>
                <th class="text-left px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</th>
                <th class="text-left px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th class="text-center px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                *ngFor="let rec of filteredRecruiters()"
                class="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                [class.opacity-50]="!rec.user?.is_active"
                (click)="openRecruiterProfile(rec)"
              >
                <td class="px-8 py-5">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-colors"
                         [class.bg-blue-50]="rec.user?.is_active"
                         [class.text-blue-600]="rec.user?.is_active"
                         [class.bg-slate-100]="!rec.user?.is_active"
                         [class.text-slate-400]="!rec.user?.is_active">
                      {{ rec.full_name.charAt(0) }}
                    </div>
                    <span class="font-bold text-slate-900">{{ rec.full_name }}</span>
                  </div>
                </td>
                <td class="px-8 py-5 text-slate-600 font-medium">{{ rec.user?.email || '-' }}</td>
                <td class="px-8 py-5">
                  <span class="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                    {{ rec.department?.name || '-' }}
                  </span>
                </td>
                <td class="px-8 py-5 text-slate-600 font-medium">{{ rec.phone || '-' }}</td>
                <td class="px-8 py-5">
                  <span class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                        [class.bg-emerald-50]="rec.user?.is_active"
                        [class.text-emerald-600]="rec.user?.is_active"
                        [class.bg-red-50]="!rec.user?.is_active"
                        [class.text-red-500]="!rec.user?.is_active">
                    {{ rec.user?.is_active ? 'Active' : 'Deactivated' }}
                  </span>
                </td>
                <td class="px-8 py-5 text-center">
                  <button
                    type="button"
                    (click)="toggleRecruiterStatus(rec, $event)"
                    [disabled]="togglingId() === rec.id"
                    class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                    [class.bg-red-50]="rec.user?.is_active"
                    [class.text-red-600]="rec.user?.is_active"
                    [class.hover:bg-red-100]="rec.user?.is_active"
                    [class.bg-emerald-50]="!rec.user?.is_active"
                    [class.text-emerald-600]="!rec.user?.is_active"
                    [class.hover:bg-emerald-100]="!rec.user?.is_active"
                  >
                    <span *ngIf="togglingId() === rec.id" class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></span>
                    {{ rec.user?.is_active ? 'Deactivate' : 'Reactivate' }}
                  </button>
                </td>
              </tr>
              <tr *ngIf="filteredRecruiters().length === 0">
                <td colspan="6" class="px-8 py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                  {{ recruiters().length === 0 ? 'No recruiters registered yet.' : 'No results match your filters.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-scroll::-webkit-scrollbar { width: 4px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    @keyframes fadeInSlide {
      from { opacity: 0; transform: translateY(-10px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    .animate-in { animation: fadeInSlide 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
  `]
})
export class CompanyRecruitersComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private notifications = inject(NotificationService);
  private el = inject(ElementRef);
  private router = inject(Router);

  departments = signal<DepartmentOption[]>([]);
  recruiters = signal<any[]>([]);
  creatingRecruiter = signal(false);
  isDepartmentOpen = signal(false);
  isFilterDeptOpen = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  togglingId = signal<number | null>(null);
  companyType = signal('company');
  departmentsEnabled = signal(true);

  // Filter state
  searchQuery = signal('');
  filterDeptId = signal<number | null>(null);

  filteredRecruiters = computed(() => {
    let list = this.recruiters();
    const q = this.searchQuery().toLowerCase().trim();
    const d = this.filterDeptId();
    if (q) list = list.filter(r => r.full_name.toLowerCase().includes(q));
    if (d) list = list.filter(r => r.department?.id === d);
    return list;
  });

  recruiterForm = this.fb.group({
    full_name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required]],
    phone: ['', [Validators.pattern('^[0-9]{8}$')]],
    department_id: [null as number | null, Validators.required]
  }, { validators: this.passwordMatchValidator });

  passwordMatchValidator(g: any) {
    const pw = g.get('password')?.value;
    const cpw = g.get('confirm_password')?.value;
    return pw === cpw ? null : { passwordMismatch: true };
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isDepartmentOpen.set(false);
      this.isFilterDeptOpen.set(false);
    }
  }

  toggleDepartment() {
    if (!this.departmentsEnabled()) return;
    this.isFilterDeptOpen.set(false);
    this.isDepartmentOpen.update(v => !v);
  }
  selectDepartment(id: number) {
    this.recruiterForm.patchValue({ department_id: id });
    this.isDepartmentOpen.set(false);
  }
  getDepartmentName(id: any): string {
    if (!this.departmentsEnabled()) return 'No Department';
    const dep = this.departments().find(d => d.id === id);
    return dep ? dep.name : 'Select Department';
  }

  toggleFilterDepartment(): void {
    if (!this.departmentsEnabled()) return;
    this.isDepartmentOpen.set(false);
    this.isFilterDeptOpen.update(v => !v);
  }

  selectFilterDepartment(id: number | null): void {
    this.filterDeptId.set(id);
    this.isFilterDeptOpen.set(false);
  }

  getFilterDepartmentName(): string {
    const current = this.filterDeptId();
    if (current === null) return 'All Departments';

    const dep = this.departments().find(d => d.id === current);
    return dep?.name || 'All Departments';
  }

  onlyNumbers(event: any) {
    if (!/[0-9]/.test(String.fromCharCode(event.charCode))) event.preventDefault();
  }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadRecruiters();
  }

  loadDepartments(): void {
    this.api.get<any>('company/departments').subscribe({
      next: (res) => {
        const departments = (Array.isArray(res) ? res : (res?.data || [])) as DepartmentOption[];
        const companyType = String(res?.company_type || 'company').toLowerCase();
        const departmentsEnabled = typeof res?.departments_enabled === 'boolean'
          ? !!res.departments_enabled
          : companyType !== 'startup';

        this.companyType.set(companyType);
        this.departmentsEnabled.set(departmentsEnabled);
        this.departments.set(departments);

        if (!departmentsEnabled) {
          this.filterDeptId.set(null);
          this.isDepartmentOpen.set(false);
          this.isFilterDeptOpen.set(false);
        }

        if (this.filterDeptId() !== null && !departments.some(d => d.id === this.filterDeptId())) {
          this.filterDeptId.set(null);
        }

        this.applyDepartmentControlRules();
      },
      error: (err) => {
        this.departments.set([]);
        this.applyDepartmentControlRules();
        this.notifications.error(err?.error?.message || 'Failed to fetch departments.');
      }
    });
  }

  private applyDepartmentControlRules(): void {
    const departmentControl = this.recruiterForm.get('department_id');
    if (!departmentControl) return;

    if (this.departmentsEnabled()) {
      departmentControl.setValidators([Validators.required]);
      if (!departmentControl.value && this.departments().length > 0) {
        departmentControl.setValue(this.departments()[0].id);
      }
    } else {
      departmentControl.clearValidators();
      departmentControl.setValue(null);
    }

    departmentControl.updateValueAndValidity({ emitEvent: false });
  }

  loadRecruiters(): void {
    this.api.get<any>('company/recruiters').subscribe({
      next: (res) => { if (res.success) this.recruiters.set(res.data || []); }
    });
  }

  createRecruiter(): void {
    if (this.departmentsEnabled() && this.departments().length === 0) {
      this.notifications.warning('Add at least one department before creating recruiters.');
      return;
    }

    if (this.recruiterForm.invalid) { this.recruiterForm.markAllAsTouched(); return; }
    this.creatingRecruiter.set(true);
    const { confirm_password, ...payload } = this.recruiterForm.value;
    const requestPayload: any = { ...payload };
    if (!this.departmentsEnabled()) {
      requestPayload.department_id = null;
    }

    this.api.post<any>('company/recruiters', requestPayload).subscribe({
      next: (res) => {
        this.creatingRecruiter.set(false);
        if (res.success) {
          this.notifications.success('Recruiter registered successfully.');
          this.recruiterForm.reset({
            full_name: '',
            email: '',
            password: '',
            confirm_password: '',
            phone: '',
            department_id: this.departmentsEnabled() && this.departments().length > 0 ? this.departments()[0].id : null
          });
          this.applyDepartmentControlRules();
          this.loadRecruiters();
        }
      },
      error: (err) => {
        this.creatingRecruiter.set(false);
        this.notifications.error(err?.error?.message || 'Failed to create recruiter.');
      }
    });
  }

  toggleRecruiterStatus(rec: any, event?: Event): void {
    event?.stopPropagation();
    if (this.togglingId() !== null) return;
    this.togglingId.set(rec.id);
    this.api.patch<any>(`company/recruiters/${rec.id}/toggle-status`, {}).subscribe({
      next: (res) => {
        this.togglingId.set(null);
        if (res.success) {
          // Update inline without full reload
          this.recruiters.update(list =>
            list.map(r => r.id === rec.id
              ? { ...r, user: { ...r.user, is_active: res.is_active } }
              : r
            )
          );
          const action = res.is_active ? 'reactivated' : 'deactivated';
          this.notifications.success(`Recruiter ${action} successfully.`);
        }
      },
      error: (err) => {
        this.togglingId.set(null);
        this.notifications.error(err?.error?.message || 'Failed to update recruiter status.');
      }
    });
  }

  openRecruiterProfile(rec: any): void {
    const recruiterId = Number(rec?.id);
    if (!Number.isFinite(recruiterId) || recruiterId <= 0) {
      return;
    }

    this.router.navigate(['/company/recruiters', recruiterId], {
      state: { recruiterId }
    });
  }
}

