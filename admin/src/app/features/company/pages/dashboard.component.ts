import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-company-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-7xl mx-auto py-10 px-4 font-['Outfit']">
      <!-- Header Area -->
      <div class="flex items-center justify-between mb-10">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Recruitment <span class="text-blue-600">Overview</span></h1>
          <p class="text-slate-500 font-medium">Manage your active listings and track candidate engagement.</p>
        </div>
        <button 
          routerLink="/company/post-job"
          class="px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-3 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Post New Opening
        </button>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex items-center gap-6 relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full blur-2xl opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
          <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div>
            <h3 class="text-3xl font-black text-slate-900 tracking-tight">{{ stats().active_jobs }}</h3>
            <p class="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Active Positions</p>
          </div>
        </div>

        <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex items-center gap-6 relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full blur-2xl opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
          <div class="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <h3 class="text-3xl font-black text-slate-900 tracking-tight">{{ stats().total_applicants }}</h3>
            <p class="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Total Applicants</p>
          </div>
        </div>

        <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex items-center gap-6 relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full blur-2xl opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
          <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><rect x="5" y="3" width="6" height="18" rx="1"/><rect x="13" y="7" width="6" height="14" rx="1"/></svg>
          </div>
          <div>
            <h3 class="text-3xl font-black text-slate-900 tracking-tight">{{ jobs().length }}</h3>
            <p class="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Total Offers</p>
          </div>
        </div>
      </div>

      <!-- Main Listing Section -->
      <div class="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
        <div class="p-8 border-b border-slate-50 flex items-center justify-between">
           <h2 class="font-black text-slate-900 text-lg uppercase tracking-tight">Job Offers</h2>
           <div class="flex gap-2">
              <span class="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase rounded-lg tracking-widest">Total: {{ jobs().length }}</span>
           </div>
        </div>

        <div class="divide-y divide-slate-50">
          <div *ngIf="jobs().length === 0" class="py-20 flex flex-col items-center justify-center text-center">
             <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <svg class="text-slate-300" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             </div>
             <h4 class="font-bold text-slate-800">No job offers found</h4>
             <p class="text-slate-400 text-sm mt-1 max-w-xs">Start by creating your first professional job offer to attract top talent.</p>
          </div>

          <div *ngFor="let job of jobs()" class="p-8 hover:bg-slate-50 transition-colors group">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div class="flex items-start gap-5">
                <div [class]="'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ' + (job.status === 'open' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2 4-4"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/></svg>
                </div>
                <div>
                  <div class="flex items-center gap-3">
                    <button type="button" (click)="viewJob(job)" class="group/title text-left focus:outline-none">
                      <h3 class="font-black text-slate-900 text-lg tracking-tight group-hover/title:text-blue-600 transition-colors">{{ job.title }}</h3>
                    </button>
                    <span [class]="'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ' + (job.status === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')">
                      {{ job.status === 'open' ? 'Active' : 'Pas active' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                    <div class="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-tight" *ngIf="job.department?.name">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16"/><path d="M17 4v16"/></svg>
                      {{ job.department.name }}
                    </div>
                    <div class="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-tight">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {{ job.location }}
                    </div>
                    <div class="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-tight">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7 12 12 3 7"/><polyline points="21 14 12 19 3 14"/><path d="M21 7v7"/><path d="M3 7v7"/></svg>
                      {{ job.offer_type }}
                    </div>
                    <div class="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-tight" *ngIf="job.budget">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      {{ job.budget }} TND / Month
                    </div>
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-black text-[10px] uppercase tracking-widest border border-indigo-100">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {{ job.applications_count || 0 }} Candidates
                    </div>
                  </div>
                </div>
              </div>

	              <div class="flex items-center gap-3 self-end md:self-center">
	                 <button
	                   type="button"
	                   (click)="editOffer(job.id)"
	                   class="h-12 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border-2 border-amber-100 text-amber-600 hover:bg-amber-50 flex items-center gap-2"
	                 >
	                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
	                   Edit
	                 </button>
	                 <button 
	                   type="button"
	                   (click)="openApplicants(job.id)"
                   class="h-12 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center gap-2"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                   Applicants ({{ job.applications_count || 0 }})
                 </button>
                 <button 
                   (click)="toggleStatus(job)"
                   [disabled]="isUpdating() === job.id"
                   [class]="'h-12 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border-2 flex items-center gap-2 ' + (job.status === 'open' ? 'border-rose-100 text-rose-500 hover:bg-rose-50' : 'border-emerald-100 text-emerald-500 hover:bg-emerald-50')"
                 >
                   <span *ngIf="isUpdating() === job.id" class="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                   {{ job.status === 'open' ? 'Deactivate' : 'Activate' }}
                 </button>
                 <button 
                   (click)="requestDelete(job.id)"
                   class="h-12 w-12 rounded-xl border-2 border-slate-100 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:border-rose-100 hover:text-rose-500 transition-all"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Professional Delete Confirmation Modal -->
      <div *ngIf="showDeleteModal()" class="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
        <div class="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
           <div class="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
           </div>
           
           <h3 class="text-2xl font-black text-slate-900 text-center tracking-tight mb-3">Delete Job Offering?</h3>
           <p class="text-slate-500 text-center font-medium leading-relaxed mb-10">
              Are you sure you want to terminate this listing? This action will remove all associated match data and cannot be reversed.
           </p>

           <div class="flex flex-col gap-3">
              <button 
                (click)="confirmDelete()"
                [disabled]="isDeleting()"
                class="w-full py-5 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <span *ngIf="isDeleting()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ isDeleting() ? 'DELETING...' : 'YES, PERMANENTLY DELETE' }}
              </button>
              <button 
                (click)="cancelDelete()"
                [disabled]="isDeleting()"
                class="w-full py-5 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
              >
                Return to Dashboard
              </button>
           </div>
        </div>
      </div>

      <!-- Professional Job Insight Modal -->
      <div *ngIf="selectedJob()" class="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
        <div class="absolute inset-0" (click)="closeJobModal()"></div>
        <div class="bg-white rounded-[3rem] w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-100 relative z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
          <!-- Modal Header -->
          <div class="p-10 border-b border-slate-50 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-6">
              <div class="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              </div>
              <div>
                <div class="flex items-center gap-3 mb-1">
                  <h2 class="text-3xl font-black text-slate-900 tracking-tight leading-none">{{ selectedJob()?.title }}</h2>
                  <span [class]="'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ' + (selectedJob()?.status === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')">
                    {{ selectedJob()?.status === 'open' ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <div class="flex items-center gap-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                  <span class="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> {{ selectedJob()?.location }}</span>
                  <span class="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500"><path d="M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z"/><path d="m9 11 2 2 4-4"/></svg> {{ selectedJob()?.offer_type === 'internship' ? 'INTERNSHIP' : 'JOB OFFER' }} - {{ selectedJob()?.offer_type?.toUpperCase() }}</span>
                </div>
              </div>
            </div>
            <button (click)="closeJobModal()" class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center border-2 border-transparent hover:border-rose-100 active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div class="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
            <!-- Summary Row -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div class="space-y-4">
                <h3 class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <div class="w-1 h-3 bg-blue-600 rounded-full"></div>
                  Job Description
                </h3>
                <div class="prose prose-slate max-w-none px-6 py-8 bg-slate-50/50 rounded-[2rem] border border-slate-100 text-slate-600 font-medium leading-relaxed whitespace-pre-wrap text-sm">
                  {{ selectedJob()?.description }}
                </div>
              </div>

              <div class="space-y-8">
                <!-- Requirements Card -->
                <div class="space-y-4">
                  <h3 class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <div class="w-1 h-3 bg-indigo-600 rounded-full"></div>
                    Professional Requirements
                  </h3>
                  <div class="grid grid-cols-1 gap-4">
                    <div class="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-4 group hover:border-blue-200 transition-all">
                      <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>
                      <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Academic Pedigree</p>
                        <p class="text-sm font-black text-slate-800">{{ getJobDegrees(selectedJob()) }}</p>
                      </div>
                    </div>
                    <div class="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-4 group hover:border-emerald-200 transition-all">
                      <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
                      <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Experience Level</p>
                        <p class="text-sm font-black text-slate-800">{{ getJobExperience(selectedJob()) }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Compensation & Meta -->
                <div class="space-y-4">
                  <h3 class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <div class="w-1 h-3 bg-emerald-600 rounded-full"></div>
                    Target Alignment
                  </h3>
                  <div class="flex flex-wrap gap-3">
                    <div class="px-5 py-3 rounded-xl bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-widest border border-emerald-100" *ngIf="selectedJob()?.budget">
                      {{ selectedJob()?.budget }} TND / Month
                    </div>
                    <div class="px-5 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest border border-slate-200">
                      {{ selectedJob()?.applications_count || 0 }} Applications Received
                    </div>
                    <div class="px-5 py-3 rounded-xl bg-violet-50 text-violet-700 font-black text-[10px] uppercase tracking-widest border border-violet-100">
                      {{ selectedJob()?.department?.name || 'Global HQ' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="p-10 border-t border-slate-50 shrink-0 bg-slate-50/30 flex items-center justify-end gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
            <button (click)="closeJobModal()" class="px-8 py-4 rounded-2xl font-black text-xs text-slate-400 uppercase tracking-widest hover:bg-slate-100 transition-all">
              Dismiss
            </button>
            <button (click)="editOffer(selectedJob().id)" class="px-8 py-4 rounded-2xl font-black text-xs text-amber-600 bg-white border-2 border-amber-100 hover:bg-amber-50 transition-all uppercase tracking-widest shadow-sm">
              Refine Listing
            </button>
            <button (click)="openApplicants(selectedJob().id)" class="px-10 py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95">
              Review Pipeline
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
  `]
})
export class CompanyDashboardComponent implements OnInit {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  jobs = signal<any[]>([]);
  activeJobs = signal<any[]>([]);
  stats = signal<any>({ active_jobs: 0, total_applicants: 0 });
  isUpdating = signal<number | null>(null);

  // Custom Modal State
  showDeleteModal = signal(false);
  jobToDelete = signal<number | null>(null);
  selectedJob = signal<any | null>(null);
  isDeleting = signal(false);

  ngOnInit() {
    this.loadJobs();
    this.loadStats();
  }

  loadStats() {
    this.apiService.get('company/dashboard-stats').subscribe({
      next: (res: any) => {
        if (res.success) {
          this.stats.set(res.data);
        }
      }
    });
  }

  loadJobs() {
    this.apiService.get('company/job-offers').subscribe({
      next: (res: any) => {
        this.jobs.set(res.data);
        this.activeJobs.set(res.data.filter((j: any) => j.status === 'open'));
        this.loadStats();
      },
      error: (err: any) => {
        console.error('Error loading jobs:', err);
      }
    });
  }

  toggleStatus(job: any) {
    const newStatus = job.status === 'open' ? 'pas active' : 'open';
    this.isUpdating.set(job.id);

    this.apiService.patch(`company/job-offers/${job.id}/status`, { status: newStatus }).subscribe({
      next: (res: any) => {
        this.isUpdating.set(null);
        if (res.success) {
          this.notificationService.success(`Job ${newStatus === 'open' ? 'activated' : 'deactivated'} successfully!`);
          this.loadJobs();
        }
      },
      error: (err: any) => {
        this.isUpdating.set(null);
        this.notificationService.error('Failed to update job status.');
      }
    });
  }

  requestDelete(id: number) {
    this.jobToDelete.set(id);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.jobToDelete.set(null);
  }

  confirmDelete() {
    const id = this.jobToDelete();
    if (!id) return;

    this.isDeleting.set(true);
    this.apiService.delete(`company/job-offers/${id}`).subscribe({
      next: (res: any) => {
        this.isDeleting.set(false);
        this.showDeleteModal.set(false);
        if (res.success) {
          this.notificationService.success('Job offer deleted successfully!');
          this.loadJobs();
        }
      },
      error: (err: any) => {
        this.isDeleting.set(false);
        this.showDeleteModal.set(false);
        this.notificationService.error('Failed to delete job offer.');
      }
    });
  }

  openApplicants(jobId: number) {
    this.selectedJob.set(null);
    this.router.navigate(['/company/applicants'], { state: { jobId } });
  }

  editOffer(jobId: number) {
    this.selectedJob.set(null);
    this.router.navigate(['/company/post-job/edit'], { state: { offerId: jobId } });
  }

  viewJob(job: any) {
    this.selectedJob.set(job);
  }

  closeJobModal() {
    this.selectedJob.set(null);
  }

  getJobDegrees(job: any): string {
    if (!job) return 'N/A';
    const reqs = job.job_requirements?.[0] || job.internship_requirements?.[0];
    if (!reqs?.required_degrees) return 'No Specific Degree';
    try {
      const degrees = JSON.parse(reqs.required_degrees);
      return Array.isArray(degrees) ? degrees.join(', ') : degrees;
    } catch {
      return reqs.required_degrees;
    }
  }

  getJobExperience(job: any): string {
    if (!job) return 'N/A';
    const reqs = job.job_requirements?.[0];
    if (job.offer_type === 'internship') {
      const iReqs = job.internship_requirements?.[0];
      return iReqs?.duration_months ? `${iReqs.duration_months} Months Internship` : 'Standard Internship';
    }
    if (!reqs?.experience_levels) return 'All Experience Levels';
    try {
      const levels = JSON.parse(reqs.experience_levels);
      return Array.isArray(levels) ? levels.join(', ') : levels;
    } catch {
      return reqs.experience_levels;
    }
  }
}
