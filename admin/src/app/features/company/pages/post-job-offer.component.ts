import { Component, inject, signal, HostListener, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

interface DepartmentOption {
  id: number;
  name: string;
  description?: string | null;
}

interface RecruiterOption {
  id: number;
  full_name: string;
  department_id?: number | null;
  department?: {
    id: number;
    name: string;
  } | null;
}

@Component({
  selector: 'app-post-job',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="max-w-4xl mx-auto py-12 px-4 font-['Outfit']">
      <!-- Header Section -->
      <div class="mb-10 flex items-center justify-between">
        <div>
          <h1 class="text-4xl font-black text-slate-900 tracking-tight">
            {{ isEditMode() ? 'Edit' : 'Post a' }} <span class="text-blue-600">{{ isEditMode() ? 'Job Opening' : 'New Opening' }}</span>
          </h1>
          <p class="text-slate-500 font-medium mt-2 text-lg">
            {{ isEditMode() ? 'Update the offer details and assigned recruiters.' : 'Reach the best talent in Tunisia with a professional listing.' }}
          </p>
        </div>
        <div class="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/></svg>
        </div>
      </div>

      <div *ngIf="loadingOffer()" class="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-700">
        Loading job offer details...
      </div>

      <form [formGroup]="jobForm" (ngSubmit)="onSubmit()" class="space-y-8">
        <!-- Section 1: Basic Info -->
        <div class="bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/50 border border-slate-100/50 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50"></div>
          
          <div class="relative z-10 flex flex-col gap-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <!-- Job Title -->
              <div class="space-y-3">
                <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Position Title</label>
                <input 
                  formControlName="title"
                  placeholder="e.g. Senior Full Stack Engineer"
                  class="w-full h-16 px-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-800"
                  [class.border-red-500]="isInvalid('title')"
                />
                <p *ngIf="isInvalid('title')" class="text-red-500 text-[10px] font-bold mt-1 ml-1 animate-in fade-in slide-in-from-top-1">
                  Title is required (min 5 characters)
                </p>
              </div>

              <!-- Offer Type (Internship vs Job) -->
              <div class="space-y-3">
                <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Type of Opening</label>
                <div class="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
                  <button 
                    type="button"
                    (click)="setType('internship')"
                    [class.bg-white]="jobForm.get('offer_type')?.value === 'internship'"
                    [class.shadow-md]="jobForm.get('offer_type')?.value === 'internship'"
                    [class.text-blue-600]="jobForm.get('offer_type')?.value === 'internship'"
                    class="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                    Internship
                  </button>
                  <button 
                    type="button"
                    (click)="setType('fulltime')"
                    [class.bg-white]="jobForm.get('offer_type')?.value === 'fulltime'"
                    [class.shadow-md]="jobForm.get('offer_type')?.value === 'fulltime'"
                    [class.text-blue-600]="jobForm.get('offer_type')?.value === 'fulltime'"
                    class="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                    Job / Career
                  </button>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-3">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mission &amp; Role Description</label>
              <textarea 
                formControlName="description"
                rows="6"
                placeholder="Describe the responsibilities, project context, and what makes this role unique..."
                class="w-full p-6 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-medium text-slate-700 leading-relaxed resize-none"
                [class.border-red-500]="isInvalid('description')"
              ></textarea>
              <p *ngIf="isInvalid('description')" class="text-red-500 text-[10px] font-bold mt-1 ml-1 animate-in fade-in slide-in-from-top-1">
                Description is too short (min 20 characters)
              </p>
            </div>
          </div>
        </div>

        <!-- Section 2: Requirements & Logistics -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
           <!-- Logistics Card -->
           <div class="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/30 border border-slate-100 flex flex-col gap-6">

              <!-- Work Location -->
              <div class="space-y-3 relative" id="location-dropdown">
                <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Work Location</label>
                <div class="relative">
                  <button 
                    type="button"
                    (click)="toggleLocation()"
                    class="w-full h-14 pl-12 pr-10 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 transition-all outline-none font-bold text-slate-800 text-left flex items-center justify-between"
                    [class.border-blue-500]="isLocationOpen()"
                    [class.bg-white]="isLocationOpen()"
                    [class.border-red-500]="isInvalid('location')"
                  >
                    <span>{{ jobForm.get('location')?.value || 'Select Governorate' }}</span>
                    <svg [class.rotate-180]="isLocationOpen()" class="transition-transform duration-300 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>

                  <div *ngIf="isLocationOpen()" class="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-2xl border border-slate-200/60 rounded-[1.8rem] shadow-2xl shadow-blue-900/10 max-h-64 overflow-y-auto p-2 post-job-custom-scroll animate-in fade-in slide-in-from-top-2 duration-200">
                    <div 
                      *ngFor="let gov of governorates" 
                      (click)="selectLocation(gov)"
                      class="px-5 py-3.5 rounded-2xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer font-bold text-slate-700 flex items-center justify-between group mb-1 last:mb-0"
                    >
                      {{ gov }}
                      <div class="w-2 h-2 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" *ngIf="jobForm.get('location')?.value !== gov"></div>
                      <svg *ngIf="jobForm.get('location')?.value === gov" class="text-white" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </div>
                  <p *ngIf="isInvalid('location')" class="text-red-500 text-[10px] font-bold mt-1 ml-1">Please select a location</p>
                </div>
              </div>

              <!-- Department Selection -->
              <div *ngIf="departmentsEnabled(); else startupDepartmentNote" class="space-y-3 relative" id="department-dropdown">
                <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                <div class="relative">
                  <button 
                    type="button"
                    (click)="toggleDepartment()"
                    class="w-full h-14 pl-6 pr-10 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 transition-all outline-none font-bold text-slate-800 text-left flex items-center justify-between"
                    [class.border-blue-500]="isDepartmentOpen()"
                    [class.bg-white]="isDepartmentOpen()"
                    [class.border-red-500]="isInvalid('department_id')"
                  >
                    <span>{{ getDepartmentName(jobForm.get('department_id')?.value) }}</span>
                    <svg [class.rotate-180]="isDepartmentOpen()" class="transition-transform duration-300 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div *ngIf="isDepartmentOpen()" class="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-2xl border border-slate-200/60 rounded-[1.8rem] shadow-2xl shadow-blue-900/10 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div 
                      *ngFor="let dep of departments()" 
                      (click)="selectDepartment(dep.id)"
                      class="px-5 py-3.5 rounded-2xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer font-bold text-slate-700 flex items-center justify-between group mb-1 last:mb-0"
                    >
                      <span class="text-sm">{{ dep.name }}</span>
                      <svg *ngIf="jobForm.get('department_id')?.value === dep.id" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div *ngIf="departments().length === 0" class="p-4 text-center text-xs text-slate-400 font-bold">
                       No departments found
                    </div>
                  </div>
                  <p *ngIf="isInvalid('department_id')" class="text-red-500 text-[10px] font-bold mt-1 ml-1">Department is required</p>
                </div>
              </div>

              <ng-template #startupDepartmentNote>
                <div class="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <label class="text-xs font-black text-amber-700 uppercase tracking-widest ml-1">Department</label>
                  <p class="text-[11px] font-bold text-amber-700">Startup profiles do not use departments. This offer will be posted without a department assignment.</p>
                </div>
              </ng-template>

              <!-- Recruiter Assignment -->
              <div class="space-y-3 relative" id="recruiter-dropdown">
                <div class="flex items-center justify-between ml-1">
                  <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Assigned Recruiters</label>
                  <span class="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Multiple</span>
                </div>
                <div class="relative">
                  <button
                    type="button"
                    (click)="toggleRecruiters()"
                    class="w-full h-14 pl-6 pr-10 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 transition-all outline-none font-bold text-slate-800 text-left flex items-center justify-between"
                    [class.border-blue-500]="isRecruiterOpen()"
                    [class.bg-white]="isRecruiterOpen()"
                    [disabled]="isRecruitersLoading()"
                  >
                    <span>{{ getRecruiterSummary() }}</span>
                    <span *ngIf="isRecruitersLoading()" class="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></span>
                    <svg *ngIf="!isRecruitersLoading()" [class.rotate-180]="isRecruiterOpen()" class="transition-transform duration-300 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>

                  <div *ngIf="isRecruiterOpen()" class="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-2xl border border-slate-200/60 rounded-[1.8rem] shadow-2xl shadow-blue-900/10 max-h-64 overflow-y-auto p-2 post-job-custom-scroll animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      *ngFor="let recruiter of availableRecruiters()"
                      type="button"
                      (click)="toggleRecruiterSelection(recruiter.id)"
                      class="w-full px-5 py-3.5 rounded-2xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer font-bold text-slate-700 flex items-center justify-between group mb-1 last:mb-0 text-left"
                    >
                      <div class="flex flex-col">
                        <span class="text-sm">{{ recruiter.full_name }}</span>
                        <span class="text-[10px] font-medium opacity-60 group-hover:opacity-90">{{ recruiter.department?.name || 'No Department' }}</span>
                      </div>
                      <svg *ngIf="isRecruiterSelected(recruiter.id)" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <div *ngIf="availableRecruiters().length === 0 && !isRecruitersLoading()" class="p-4 text-center text-xs text-slate-400 font-bold">
                      No recruiters found for the selected department
                    </div>
                  </div>
                </div>
                <div *ngIf="selectedRecruiters().length > 0" class="flex flex-wrap gap-2 pt-1">
                  <span *ngFor="let recruiter of selectedRecruiters()" class="inline-flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-1.5 text-[11px] font-black text-blue-700">
                    {{ recruiter.full_name }}
                    <button type="button" (click)="removeRecruiter(recruiter.id, $event)" class="text-blue-400 hover:text-blue-700 leading-none">&times;</button>
                  </span>
                </div>
              </div>

              <!-- Contract Type -->
              <div class="space-y-3 relative" id="contract-dropdown">
                <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Contract Detail</label>
                <div class="relative">
                  <button 
                    type="button"
                    (click)="toggleContract()"
                    class="w-full h-14 px-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 transition-all outline-none font-bold text-slate-800 text-left flex items-center justify-between"
                    [class.border-blue-500]="isContractOpen()"
                    [class.bg-white]="isContractOpen()"
                  >
                    <span>{{ getContractLabel(jobForm.get('contract_type_detail')?.value) }}</span>
                    <svg [class.rotate-180]="isContractOpen()" class="transition-transform duration-300 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div *ngIf="isContractOpen()" class="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-2xl border border-slate-200/60 rounded-[1.8rem] shadow-2xl shadow-blue-900/10 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div 
                      *ngFor="let contract of availableContracts" 
                      (click)="selectContract(contract.value)"
                      class="px-5 py-4 rounded-2xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer font-bold text-slate-700 flex flex-col group mb-1 last:mb-0"
                    >
                      <div class="flex items-center justify-between w-full">
                        <span class="text-sm tracking-tight">{{ contract.label }}</span>
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500" *ngIf="jobForm.get('contract_type_detail')?.value === contract.value"></div>
                      </div>
                      <span class="text-[10px] opacity-50 group-hover:opacity-100 font-medium mt-0.5">{{ contract.desc }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Budget -->
              <div class="space-y-3">
                <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Approximate Monthly Budget (TND)</label>
                <input 
                  type="number"
                  formControlName="budget"
                  placeholder="Optional salary range"
                  class="w-full h-14 px-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 transition-all outline-none font-bold text-slate-800"
                />
              </div>

              <!-- Internship-only: Duration + Start Date -->
              <div *ngIf="jobForm.get('offer_type')?.value === 'internship'" class="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div class="space-y-3">
                  <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Internship Duration</label>
                  <div class="relative">
                    <input
                      type="number"
                      formControlName="duration_months"
                      placeholder="e.g. 6"
                      class="w-full h-14 px-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 transition-all outline-none font-bold text-slate-800"
                      [class.border-red-500]="isInvalid('duration_months')"
                    />
                    <span class="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Months</span>
                  </div>
                  <p *ngIf="isInvalid('duration_months')" class="text-red-500 text-[10px] font-bold mt-1 ml-1">Duration is required</p>
                </div>

                <div class="space-y-3">
                  <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                  <input
                    type="date"
                    formControlName="start_date"
                    class="w-full h-14 px-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 transition-all outline-none font-bold text-slate-800"
                    [class.border-red-500]="isInvalid('start_date')"
                  />
                  <p *ngIf="isInvalid('start_date')" class="text-red-500 text-[10px] font-bold mt-1 ml-1">Start date is required</p>
                </div>
              </div>
           </div>

           <!-- Qualifications Card -->
           <div class="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/30 border border-slate-100 flex flex-col gap-6">

              <!-- Degree Requirements -->
              <div class="space-y-4">
                <div class="flex items-center justify-between ml-1">
                  <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Degree Requirements</label>
                  <span class="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Multiple Choice</span>
                </div>
                <div class="grid grid-cols-1 gap-3">
                  <button 
                    *ngFor="let degree of ['Licence', 'Master', 'Cycle Eng']"
                    type="button"
                    (click)="toggleDegree(degree)"
                    [class.bg-blue-600]="isDegreeSelected(degree)"
                    [class.text-white]="isDegreeSelected(degree)"
                    [class.border-blue-600]="isDegreeSelected(degree)"
                    [class.bg-slate-50]="!isDegreeSelected(degree)"
                    [class.text-slate-600]="!isDegreeSelected(degree)"
                    [class.border-slate-100]="!isDegreeSelected(degree)"
                    class="flex items-center justify-between px-6 py-4 rounded-2xl border-2 transition-all font-bold text-sm group"
                  >
                    <span>{{ degree }}</span>
                    <div class="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                         [class.bg-white/20]="isDegreeSelected(degree)"
                         [class.bg-slate-200]="!isDegreeSelected(degree)">
                      <svg *ngIf="isDegreeSelected(degree)" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <div *ngIf="!isDegreeSelected(degree)" class="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:scale-150 transition-transform"></div>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Experience Level (job only) -->
              <div *ngIf="jobForm.get('offer_type')?.value === 'fulltime'" class="space-y-4 pt-4 border-t border-slate-100">
                <div class="flex items-center justify-between ml-1">
                  <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Experience Level</label>
                  <span class="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Junior / Senior</span>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <button 
                    *ngFor="let level of ['Junior Level', 'Senior Level']"
                    type="button"
                    (click)="toggleLevel(level)"
                    [class.bg-blue-600]="isLevelSelected(level)"
                    [class.text-white]="isLevelSelected(level)"
                    [class.border-blue-600]="isLevelSelected(level)"
                    [class.bg-slate-50]="!isLevelSelected(level)"
                    [class.text-slate-600]="!isLevelSelected(level)"
                    [class.border-slate-100]="!isLevelSelected(level)"
                    class="flex items-center justify-center px-4 py-3.5 rounded-2xl border-2 transition-all font-bold text-xs"
                  >
                    {{ level }}
                  </button>
                </div>
              </div>

           </div>
        </div>

        <!-- Submit Section -->
        <div class="flex items-center justify-between pt-6">
          <button 
            type="button"
            (click)="goBack()"
            class="px-8 py-4 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] hover:text-slate-600 transition-colors"
          >
            {{ isEditMode() ? 'Cancel Edit' : 'Cancel Draft' }}
          </button>

          <button 
            type="submit"
            [disabled]="isSubmitting()"
            class="px-12 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-slate-900/30 hover:bg-blue-600 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-4"
            [class.opacity-50]="jobForm.invalid && !isSubmitting()"
          >
            <span *ngIf="isSubmitting()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ isEditMode() ? (isSubmitting() ? 'Saving...' : 'Save Changes') : (isSubmitting() ? 'Publishing...' : 'Publish Job Opening') }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .post-job-custom-scroll::-webkit-scrollbar { width: 6px; }
    .post-job-custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .post-job-custom-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    .post-job-custom-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
    @keyframes fadeInSlide {
      from { opacity: 0; transform: translateY(-10px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .animate-in { animation: fadeInSlide 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
  `]
})
export class PostJobComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private el = inject(ElementRef);

  jobForm: FormGroup;
  isSubmitting = signal(false);
  loadingOffer = signal(false);
  isEditMode = signal(false);
  editingOfferId = signal<number | null>(null);
  isLocationOpen = signal(false);
  isContractOpen = signal(false);
  isDepartmentOpen = signal(false);
  isRecruiterOpen = signal(false);
  isRecruitersLoading = signal(false);
  availableRecruiters = signal<RecruiterOption[]>([]);
  selectedRecruiterIds = signal<number[]>([]);

  departments = signal<DepartmentOption[]>([]);
  companyType = signal('company');
  departmentsEnabled = signal(true);

  governorates = [
    'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
    'Kairouan', 'Kasserine', 'Kebili', 'Kef', 'Mahdia', 'Manouba', 'Medenine',
    'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse',
    'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
  ];

  contracts = [
    { value: 'CDI',        label: 'CDI',        desc: 'Contrat Durée Indéterminée' },
    { value: 'CDD',        label: 'CDD',        desc: 'Contrat Durée Déterminée' },
    { value: 'CIVP',       label: 'CIVP',       desc: 'SIVP / Karama Program' },
    { value: 'ALTERNANCE', label: 'Alternance', desc: 'Work-Study Contract' },
    { value: 'INTERNSHIP', label: 'Internship', desc: 'Stage PFE / Summer' },
  ];

  get availableContracts() {
    const type = this.jobForm.get('offer_type')?.value;
    return type === 'internship'
      ? this.contracts.filter(c => c.value === 'INTERNSHIP')
      : this.contracts.filter(c => c.value !== 'INTERNSHIP');
  }

  constructor() {
    this.jobForm = this.fb.group({
      title:                ['', [Validators.required, Validators.minLength(5)]],
      description:          ['', [Validators.required, Validators.minLength(20)]],
      location:             ['', Validators.required],
      department_id:        [null, Validators.required],
      offer_type:           ['fulltime', Validators.required],
      contract_type_detail: ['CDI'],
      budget:               [null],
      duration_months:      [null],
      start_date:           [null],
      required_degrees:     [[]],
      experience_levels:    [[]],
      recruiter_ids:        [[]]
    });
  }

  ngOnInit(): void {
    this.applyOfferTypeRules(this.jobForm.get('offer_type')?.value);

    // Edit mode: detect id from route param OR from history state (dashboard passes state)
    const offerIdRaw = this.route.snapshot.paramMap.get('id') ?? history.state?.offerId;
    const offerId = offerIdRaw ? Number(offerIdRaw) : NaN;
    if (Number.isFinite(offerId) && offerId > 0) {
      this.isEditMode.set(true);
      this.editingOfferId.set(offerId);
    }

    this.loadDepartments();
  }

  // ── Validators ──────────────────────────────────────────────────────────────

  isInvalid(controlName: string): boolean {
    const control = this.jobForm.get(controlName);
    return !!(control && control.invalid && (control.touched || control.dirty));
  }

  // ── Dropdown toggles ────────────────────────────────────────────────────────

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.closeAllDropdowns();
    }
  }

  private closeAllDropdowns() {
    this.isLocationOpen.set(false);
    this.isContractOpen.set(false);
    this.isDepartmentOpen.set(false);
    this.isRecruiterOpen.set(false);
  }

  toggleLocation()   { this.isLocationOpen.update(v => !v);  this.isContractOpen.set(false); this.isDepartmentOpen.set(false); this.isRecruiterOpen.set(false); }
  toggleContract()   { this.isContractOpen.update(v => !v);  this.isLocationOpen.set(false); this.isDepartmentOpen.set(false); this.isRecruiterOpen.set(false); }
  toggleDepartment() {
    if (!this.departmentsEnabled()) return;
    this.isDepartmentOpen.update(v => !v);
    this.isLocationOpen.set(false); this.isContractOpen.set(false); this.isRecruiterOpen.set(false);
  }
  toggleRecruiters() {
    if (this.isRecruitersLoading()) return;
    this.isRecruiterOpen.update(v => !v);
    this.isLocationOpen.set(false); this.isContractOpen.set(false); this.isDepartmentOpen.set(false);
  }

  // ── Selection helpers ────────────────────────────────────────────────────────

  selectLocation(gov: string)     { this.jobForm.patchValue({ location: gov }); this.isLocationOpen.set(false); }
  selectContract(val: string)     { this.jobForm.patchValue({ contract_type_detail: val }); this.isContractOpen.set(false); }

  selectDepartment(id: number) {
    this.jobForm.patchValue({ department_id: id });
    this.isDepartmentOpen.set(false);
    this.selectedRecruiterIds.set([]);
    this.jobForm.patchValue({ recruiter_ids: [] }, { emitEvent: false });
    this.isRecruiterOpen.set(false);
    this.loadRecruiters(id);
  }

  getDepartmentName(id: any): string {
    if (!this.departmentsEnabled()) return 'No Department';
    const dep = this.departments().find(d => d.id === id);
    return dep ? dep.name : 'Select Department';
  }

  getContractLabel(val: string): string {
    const c = this.contracts.find(i => i.value === val);
    return c ? `${c.label} — ${c.desc}` : 'Select Contract Type';
  }

  // ── Recruiter multi-select ───────────────────────────────────────────────────

  getRecruiterSummary(): string {
    if (this.isRecruitersLoading()) return 'Loading recruiters...';
    const selected = this.selectedRecruiters();
    if (selected.length === 0) return this.availableRecruiters().length > 0 ? 'Select recruiters' : 'No recruiters available';
    if (selected.length === 1) return selected[0].full_name;
    return `${selected.length} recruiters selected`;
  }

  selectedRecruiters(): RecruiterOption[] {
    const ids = new Set(this.selectedRecruiterIds());
    return this.availableRecruiters().filter(r => ids.has(r.id));
  }

  isRecruiterSelected(id: number): boolean { return this.selectedRecruiterIds().includes(id); }

  toggleRecruiterSelection(id: number) {
    const next = [...this.selectedRecruiterIds()];
    const idx = next.indexOf(id);
    idx > -1 ? next.splice(idx, 1) : next.push(id);
    this.selectedRecruiterIds.set(next);
    this.jobForm.patchValue({ recruiter_ids: next }, { emitEvent: false });
  }

  removeRecruiter(id: number, event?: Event) {
    event?.stopPropagation();
    const next = this.selectedRecruiterIds().filter(rid => rid !== id);
    this.selectedRecruiterIds.set(next);
    this.jobForm.patchValue({ recruiter_ids: next }, { emitEvent: false });
  }

  // ── Degree / level toggles ───────────────────────────────────────────────────

  toggleDegree(degree: string) {
    const current: string[] = [...(this.jobForm.get('required_degrees')?.value || [])];
    const idx = current.indexOf(degree);
    idx > -1 ? current.splice(idx, 1) : current.push(degree);
    this.jobForm.patchValue({ required_degrees: current });
  }

  isDegreeSelected(degree: string): boolean {
    return (this.jobForm.get('required_degrees')?.value || []).includes(degree);
  }

  toggleLevel(level: string) {
    const current: string[] = [...(this.jobForm.get('experience_levels')?.value || [])];
    const idx = current.indexOf(level);
    idx > -1 ? current.splice(idx, 1) : current.push(level);
    this.jobForm.patchValue({ experience_levels: current });
  }

  isLevelSelected(level: string): boolean {
    return (this.jobForm.get('experience_levels')?.value || []).includes(level);
  }

  // ── Offer type logic ─────────────────────────────────────────────────────────

  setType(type: string) {
    this.jobForm.patchValue({ offer_type: type });
    this.applyOfferTypeRules(type);
  }

  private applyOfferTypeRules(type: string) {
    const duration  = this.jobForm.get('duration_months');
    const startDate = this.jobForm.get('start_date');

    if (type === 'internship') {
      this.jobForm.patchValue({ contract_type_detail: 'INTERNSHIP' });
      duration?.setValidators([Validators.required, Validators.min(1)]);
      startDate?.setValidators([Validators.required]);
    } else {
      const current = this.jobForm.get('contract_type_detail')?.value;
      const allowed = ['CDI', 'CDD', 'ALTERNANCE', 'CIVP'];
      this.jobForm.patchValue({
        contract_type_detail: allowed.includes(current) ? current : 'CDI',
        duration_months: null,
        start_date: null
      });
      duration?.clearValidators();
      startDate?.clearValidators();
    }

    duration?.updateValueAndValidity({ emitEvent: false });
    startDate?.updateValueAndValidity({ emitEvent: false });
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  loadDepartments(): void {
    this.apiService.get<any>('company/departments').subscribe({
      next: (res: any) => {
        const list = (Array.isArray(res) ? res : (res?.data || [])) as DepartmentOption[];
        const companyType = String(res?.company_type || this.companyType()).toLowerCase();
        const enabled = typeof res?.departments_enabled === 'boolean'
          ? !!res.departments_enabled
          : companyType !== 'startup';

        this.companyType.set(companyType);
        this.departmentsEnabled.set(enabled);
        this.departments.set(list);
        this.applyDepartmentControlRules();
        this.bootstrapOfferData();
      },
      error: () => {
        this.applyDepartmentControlRules();
        this.bootstrapOfferData();
      }
    });
  }

  private bootstrapOfferData(): void {
    const offerId = this.editingOfferId();
    if (this.isEditMode() && offerId) {
      this.loadOfferForEdit(offerId);
      return;
    }
    const departmentId = this.departmentsEnabled() ? this.jobForm.get('department_id')?.value : null;
    this.loadRecruiters(departmentId);
  }

  private applyDepartmentControlRules() {
    const ctrl = this.jobForm.get('department_id');
    if (!ctrl) return;
    if (this.departmentsEnabled()) {
      ctrl.setValidators([Validators.required]);
      if (!ctrl.value && this.departments().length > 0) ctrl.setValue(this.departments()[0].id);
    } else {
      ctrl.clearValidators();
      ctrl.setValue(null);
      this.isDepartmentOpen.set(false);
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  private loadRecruiters(departmentId?: number | null, keepSelected = false) {
    const depId = departmentId ?? this.jobForm.get('department_id')?.value ?? null;
    let endpoint = 'company/recruiters';
    if (this.departmentsEnabled() && depId) endpoint += `?department_id=${depId}`;

    this.isRecruitersLoading.set(true);
    this.apiService.get<any>(endpoint).subscribe({
      next: (res: any) => {
        const recruiters = (Array.isArray(res) ? res : (res?.data || [])) as RecruiterOption[];
        this.availableRecruiters.set(recruiters);
        const validIds = keepSelected
          ? this.selectedRecruiterIds().filter(id => recruiters.some(r => r.id === id))
          : [];
        this.selectedRecruiterIds.set(validIds);
        this.jobForm.patchValue({ recruiter_ids: validIds }, { emitEvent: false });
        this.isRecruitersLoading.set(false);
      },
      error: () => {
        this.availableRecruiters.set([]);
        this.selectedRecruiterIds.set([]);
        this.jobForm.patchValue({ recruiter_ids: [] }, { emitEvent: false });
        this.isRecruitersLoading.set(false);
      }
    });
  }

  private loadOfferForEdit(offerId: number): void {
    this.loadingOffer.set(true);
    this.apiService.get<any>(`company/job-offers/${offerId}`).subscribe({
      next: (res: any) => {
        const offer = res?.data || res;
        if (!offer?.id) {
          this.notificationService.error('Offer not found.');
          this.router.navigate(['/company/dashboard']);
          this.loadingOffer.set(false);
          return;
        }

        const offerType    = String(offer.offer_type || 'fulltime');
        const contractType = this.mapBackendContractToForm(offer.contract_type_detail, offerType);

        const jobReq  = Array.isArray(offer.job_requirements)         && offer.job_requirements.length         ? offer.job_requirements[0]         : null;
        const internReq = Array.isArray(offer.internship_requirements) && offer.internship_requirements.length ? offer.internship_requirements[0] : null;

        const requiredDegrees  = this.parseArrayField(internReq?.required_degrees  ?? jobReq?.required_degrees);
        const experienceLevels = this.parseArrayField(jobReq?.experience_levels);
        const startDate        = internReq?.start_date ? String(internReq.start_date).slice(0, 10) : null;
        const durationMonths   = internReq?.duration_months ? Number(internReq.duration_months) : null;

        this.jobForm.patchValue({
          title:                offer.title        ?? '',
          description:          offer.description  ?? '',
          location:             offer.location     ?? '',
          department_id:        this.departmentsEnabled() ? (offer.department_id ?? null) : null,
          offer_type:           offerType,
          contract_type_detail: contractType,
          budget:               offer.budget       ?? null,
          duration_months:      Number.isFinite(durationMonths) ? durationMonths : null,
          start_date:           startDate,
          required_degrees:     requiredDegrees,
          experience_levels:    experienceLevels
        }, { emitEvent: false });

        this.applyOfferTypeRules(offerType);

        const recruiterIds = Array.isArray(offer.recruiters)
          ? offer.recruiters.map((r: any) => Number(r?.id)).filter((id: number) => Number.isFinite(id) && id > 0)
          : [];
        this.selectedRecruiterIds.set(recruiterIds);
        this.jobForm.patchValue({ recruiter_ids: recruiterIds }, { emitEvent: false });

        const depId = this.departmentsEnabled() ? this.jobForm.get('department_id')?.value : null;
        this.loadRecruiters(depId, true);
        this.loadingOffer.set(false);
      },
      error: () => {
        this.loadingOffer.set(false);
        this.notificationService.error('Failed to load job offer details.');
        this.router.navigate(['/company/dashboard']);
      }
    });
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  private parseArrayField(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).filter(s => s.trim());
    if (typeof value === 'string') {
      const t = value.trim();
      if (!t) return [];
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.map(String).filter(s => String(s).trim());
      } catch { /* plain string */ }
      return [t];
    }
    return [];
  }

  private mapBackendContractToForm(contractType: unknown, offerType: string): string {
    if (offerType === 'internship') return 'INTERNSHIP';
    const n = String(contractType || '').toUpperCase();
    if (n === 'CID') return 'CDI';
    if (n === 'CVP') return 'CIVP';
    if (['CDD', 'ALTERNANCE', 'CDI', 'CIVP'].includes(n)) return n;
    return 'CDI';
  }

  goBack() { this.router.navigate(['/company/dashboard']); }

  // ── Submit ───────────────────────────────────────────────────────────────────

  onSubmit() {
    if (!this.jobForm.valid) {
      this.jobForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.jobForm.value;

    const payload: any = {
      ...formValue,
      recruiter_ids: [...this.selectedRecruiterIds()],
    };

    if (!this.departmentsEnabled()) payload.department_id = null;

    if (formValue.offer_type === 'internship') {
      payload.internship_start_date = formValue.start_date || null;
    } else {
      delete payload.duration_months;
    }
    delete payload.start_date; // always use internship_start_date key for backend

    const editingId = this.editingOfferId();
    const request$ = (this.isEditMode() && editingId)
      ? this.apiService.patch(`company/job-offers/${editingId}`, payload)
      : this.apiService.post('company/job-offers', payload);

    request$.subscribe({
      next: (res: any) => {
        this.isSubmitting.set(false);
        if (res?.success) {
          this.notificationService.success(
            this.isEditMode() ? 'Job offer updated successfully!' : 'Job offer published successfully!'
          );

          if (res?.data?.ai_warning) {
            setTimeout(() => {
              this.notificationService.info(res.data.ai_warning);
            }, 1500);
          }

          this.router.navigate(['/company/dashboard']);
        } else {
          this.notificationService.error(res?.message || 'Something went wrong.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.notificationService.error(
          err?.error?.message || (this.isEditMode() ? 'Failed to update job offer.' : 'Failed to publish job offer.')
        );
      }
    });
  }
}
