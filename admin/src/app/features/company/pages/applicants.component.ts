import { Component, signal, inject, OnInit, computed, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-applicants',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[#f8fafc] pb-20 font-['Outfit']">
      <div class="max-w-[1400px] mx-auto px-6 py-12">

        <!-- Premium Header -->
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-violet-100">
               Talent Pipeline
            </div>
            <h1 class="text-4xl font-black text-slate-900 tracking-tight leading-none">
              Candidate <span class="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Insights</span>
            </h1>
            <p class="text-slate-500 font-semibold mt-3 max-w-2xl text-sm sm:text-base italic">
              AI-driven semantic ranking of all received applications for your active and past job offerings.
            </p>
          </div>
          <div class="flex items-center gap-3">
             <a routerLink="/company/dashboard" class="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xs shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-3 border border-slate-100 uppercase tracking-widest">
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
               Dashboard
             </a>
             <button (click)="loadAllApplicants()" class="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
             </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="bg-white rounded-[2.5rem] p-4 border border-slate-100 mb-10 flex flex-col md:flex-row items-center gap-6">
          <div class="flex-1 relative w-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Search by candidate name, skill, or job title..." 
              class="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] pl-16 pr-6 py-4 font-bold text-slate-800 focus:bg-white focus:border-violet-500/20 text-sm transition-all outline-none" 
            />
          </div>
          <div class="flex items-center gap-2 px-2 overflow-x-auto w-full md:w-auto">
             <button 
               *ngFor="let status of ['all', 'pending', 'interview', 'accepted', 'rejected']"
               (click)="statusFilter.set(status)"
               [class]="'px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ' + (statusFilter() === status ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100')"
             >
               {{ status }}
             </button>
          </div>
        </div>

        <!-- Desktop Table -->
        <div class="bg-white rounded-[3rem] border border-slate-100 overflow-hidden relative min-h-[500px]">
          
          <div *ngIf="isCompanyDeactivated()" class="absolute inset-0 z-[40] backdrop-blur-md bg-white/30 flex items-center justify-center p-6 transition-all animate-in fade-in duration-700">
             <div class="bg-white px-8 py-5 rounded-2xl shadow-2xl border border-slate-100 flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div class="flex flex-col">
                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Security Status</span>
                  <span class="text-sm font-black text-slate-900 uppercase tracking-widest">Restricted Access</span>
                </div>
             </div>
          </div>

          <div class="overflow-x-auto custom-scrollbar" [class.blur-sm]="isApplicantsLocked()">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50/50">
                  <th class="px-10 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Applicant</th>
                  <th class="px-8 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-center w-28">AI Rank</th>
                  <th *ngIf="shouldShowTechnicalColumn()" class="px-8 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-center w-28">Technical</th>
                  <th class="px-8 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-center">Compatibility Matrix</th>
                  <th class="px-8 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Submission</th>
                  <th class="px-10 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-center">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr *ngFor="let app of filteredApplicants()" class="hover:bg-slate-50/80 transition-all group">
                  <td class="px-10 py-8">
                    <button type="button" (click)="viewCandidate(app)" class="flex w-full items-center gap-5 text-left">
                      <div class="relative">
                        <!-- Table Picture/Initials -->
                        <div *ngIf="!app.candidate?.picture" class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-black text-lg shadow-xl shrink-0 transition-transform group-hover:-rotate-3 duration-500">
                          {{ app.candidate?.first_name?.[0] }}{{ app.candidate?.last_name?.[0] }}
                        </div>
                        <img *ngIf="app.candidate?.picture" [src]="app.candidate.picture" class="w-14 h-14 rounded-2xl object-cover shadow-xl shrink-0 transition-transform group-hover:-rotate-3 duration-500" alt="Profile" />
                        <div [class]="'absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white ' + getStatusDotColor(app.status)"></div>
                      </div>
	                      <div class="min-w-0">
	                        <div class="font-black text-slate-900 group-hover:text-violet-600 transition-colors text-base leading-none mb-1.5 truncate max-w-[240px]">
	                          {{ app.candidate?.first_name }} {{ app.candidate?.last_name }}
	                        </div>
	                        <div class="text-[11px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[240px]">{{ app.candidate?.specialty?.name || 'Candidate' }}</div>
	                      </div>
	                    </button>
	                  </td>
                  <td class="px-8 py-8">
                    <!-- Case 1: Subscription Restricted -->
                    <div *ngIf="app.ai_restricted; else normalScoreView" class="flex flex-col items-center gap-1 opacity-60">
                       <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                       </div>
                       <span class="text-[8px] font-black uppercase tracking-widest text-slate-400">Upgrade Plan</span>
                    </div>

                    <!-- Case 2: Subscription Allowed -->
                    <ng-template #normalScoreView>
                      <div *ngIf="app.ai_match_score != null && !rescoringApplicationIds().has(app.id); else noScoreCircle" class="flex flex-col items-center gap-1">
                        <span class="text-lg font-black" [ngStyle]="{'color': getScoreColor(app.ai_match_score)}">
                          {{ (app.ai_match_score * 100) | number:'1.0-0' }}%
                        </span>
                        <span class="text-[8px] font-black uppercase tracking-widest text-slate-400">Match Rank</span>
                      </div>

                      <ng-template #noScoreCircle>
                        <div class="text-center">
                          <div *ngIf="app.ai_error && !rescoringApplicationIds().has(app.id); else processing" class="text-[9px] text-rose-500 font-black uppercase">Error</div>
                          <ng-template #processing>
                            <div *ngIf="rescoringApplicationIds().has(app.id); else waitingForScore" class="flex flex-col items-center gap-1">
                              <div class="w-4 h-4 border-2 border-slate-100 border-t-slate-500 animate-spin rounded-full"></div>
                              <span class="text-[8px] font-bold text-slate-400">Re-analyzing...</span>
                            </div>
                          </ng-template>
                          <ng-template #waitingForScore>
                            <div class="w-4 h-4 border-2 border-slate-100 border-t-slate-400 animate-spin mx-auto rounded-full"></div>
                          </ng-template>
                        </div>
                      </ng-template>
                    </ng-template>
                  </td>

                  <td
                    *ngIf="shouldShowTechnicalColumn()"
                    class="px-8 py-8 text-center group hover:bg-slate-50/50 transition-colors relative"
                    [class.cursor-pointer]="hasPassedTechnicalQuiz(app)"
                    [attr.title]="hasPassedTechnicalQuiz(app) ? 'View technical assessment report' : 'Technical report available after quiz completion'"
                    (click)="onTechnicalCellClick($event, app)"
                  >
                    <div class="inline-flex flex-col items-center hover:scale-110 transition-transform" *ngIf="hasPassedTechnicalQuiz(app); else noTechnicalScore">
                        <div class="text-base font-black text-violet-600 group-hover:text-violet-700">
                          {{ (getTechnicalScore(app) || 0) | number:'1.0-1' }}%
                        </div>
                        <div class="mt-1 text-[9px] font-black uppercase tracking-widest text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          {{ hasPassedManualQuiz(app) ? 'Manual Report' : 'AI Report' }}
                        </div>
                    </div>
                    <ng-template #noTechnicalScore>
                       <span class="text-[8px] font-bold text-slate-300 italic uppercase">-</span>
                    </ng-template>
                  </td>
                  <td class="px-8 py-8">
                    <!-- Case 1: Subscription Restricted -->
                    <div *ngIf="app.ai_restricted; else normalBreakdownView" class="flex flex-col gap-2">
                       <div class="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden relative">
                         <div class="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200 to-transparent animate-shimmer" style="width: 200%; background-size: 50% 100%;"></div>
                       </div>
                       <div class="h-1.5 w-2/3 rounded-full bg-slate-100 overflow-hidden relative">
                         <div class="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200 to-transparent animate-shimmer" style="width: 200%; background-size: 50% 100%;"></div>
                       </div>
                       <span class="text-[7px] font-bold uppercase tracking-[0.2em] text-slate-300">Feature Locked</span>
                    </div>

                    <!-- Case 2: Subscription Allowed -->
                    <ng-template #normalBreakdownView>
                      <div *ngIf="app.ai_match_score != null && !rescoringApplicationIds().has(app.id); else noBreakdown" class="flex flex-col gap-1.5 min-w-[140px]">
                        <div class="flex items-center gap-2">
                          <span class="text-[9px] font-black text-violet-500 uppercase tracking-widest w-16 shrink-0 text-left">Semantic</span>
                          <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div class="h-full rounded-full bg-violet-500 transition-all shadow-sm" [style.width]="((app.ai_semantic_score ?? 0) * 100) + '%'"></div>
                          </div>
                          <span class="text-[10px] font-black text-violet-700 w-8 text-right">{{ ((app.ai_semantic_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-[9px] font-black text-blue-500 uppercase tracking-widest w-16 shrink-0 text-left">Skills</span>
                          <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div class="h-full rounded-full bg-blue-500 transition-all shadow-sm" [style.width]="((app.ai_skill_score ?? 0) * 100) + '%'"></div>
                          </div>
                          <span class="text-[10px] font-black text-blue-700 w-8 text-right">{{ ((app.ai_skill_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-[9px] font-black text-emerald-500 uppercase tracking-widest w-16 shrink-0 text-left">Exp.</span>
                          <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div class="h-full rounded-full bg-emerald-500 transition-all shadow-sm" [style.width]="((app.ai_experience_score ?? 0) * 100) + '%'"></div>
                          </div>
                          <span class="text-[10px] font-black text-emerald-700 w-8 text-right">{{ ((app.ai_experience_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-[9px] font-black text-amber-500 uppercase tracking-widest w-16 shrink-0 text-left">Degree</span>
                          <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div class="h-full rounded-full bg-amber-500 transition-all shadow-sm" [style.width]="((app.ai_degree_score ?? 0) * 100) + '%'"></div>
                          </div>
                          <span class="text-[10px] font-black text-amber-700 w-8 text-right">{{ ((app.ai_degree_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                        </div>
                      </div>

                      <ng-template #noBreakdown>
                        <div *ngIf="rescoringApplicationIds().has(app.id); else waitingForBreakdown" class="flex flex-col items-center gap-1">
                          <div class="flex items-center gap-2">
                            <div class="w-3 h-3 border-2 border-slate-100 border-t-slate-500 animate-spin rounded-full"></div>
                            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Re-analyzing...</span>
                          </div>
                        </div>
                        <ng-template #waitingForBreakdown>
                          <span class="text-[10px] text-slate-300 font-bold italic uppercase tracking-widest">Pending</span>
                        </ng-template>
                      </ng-template>
                    </ng-template>
                  </td>
                  <td class="px-8 py-8">
                    <div class="text-[13px] font-black text-slate-900">{{ app.applied_at | date:'MMM d, y' }}</div>
                    <div class="text-[10px] text-slate-400 font-bold">{{ app.applied_at | date:'shortTime' }}</div>
                  </td>
                  <td class="px-10 py-8 text-right">
                    <div class="flex items-center justify-end gap-3 flex-nowrap">
                        <!-- View CV Button (Always visible if exists) -->
                        <button *ngIf="app.id" type="button" (click)="openCv($event, app)" class="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-all border border-slate-200" title="View CV">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </button>

                        <!-- HR schedules the interview and assigns the responsible recruiter -->
                        <button
                          (click)="navigateToSchedule(app)"
                          class="h-12 px-6 rounded-3xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 group active:scale-95"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="group-hover:translate-x-0.5 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                           Schedule Interview
                        </button>

                        <div
                          *ngIf="canShowHrDecisionActions(app)"
                          class="inline-flex h-12 items-center px-5 rounded-3xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest border border-slate-200 shrink-0"
                        >
                          Recruiter decision required
                        </div>

                        <div *ngIf="app.status?.toLowerCase()?.trim() === 'rejected'" class="h-10 px-4 rounded-xl bg-rose-50 text-rose-500 font-black text-[9px] uppercase tracking-widest border border-rose-100 flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                          Rejected
                        </div>

                        <div *ngIf="app.status?.toLowerCase()?.trim() === 'accepted'" class="h-10 px-4 rounded-xl bg-emerald-50 text-emerald-500 font-black text-[9px] uppercase tracking-widest border border-emerald-100 flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17 4 12"/></svg>
                          Hired
                        </div>
                      </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Empty State -->
          <div *ngIf="filteredApplicants().length === 0" class="py-40 text-center">
            <h3 class="text-2xl font-black text-slate-900 mb-2">No applications found</h3>
            <p class="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Try adjusting your filters</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
      <div *ngIf="selectedApp()" class="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 transition-all animate-in fade-in duration-300">
        <div class="absolute inset-0 bg-slate-900/70 backdrop-blur-xl" (click)="closeModal()"></div>
        
        <div class="relative bg-white w-full max-w-4xl max-h-[92vh] rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl shadow-slate-900/30">
          
          <!-- Premium Header with White Background -->
          <div class="relative px-8 py-8 bg-white flex items-center justify-between shrink-0 overflow-hidden border-b border-slate-100">
            <!-- Background Decorations -->
            <div class="absolute inset-0 overflow-hidden">
              <div class="absolute -top-20 -right-20 w-64 h-64 bg-slate-100/50 rounded-full blur-3xl"></div>
              <div class="absolute -bottom-20 -left-20 w-48 h-48 bg-slate-100/50 rounded-full blur-3xl"></div>
            </div>
            
            <!-- Left: Profile Info -->
            <div class="relative flex items-center gap-6 z-10">
              <!-- Premium Profile Picture -->
              <div class="relative">
                <div class="absolute inset-0 bg-gradient-to-br from-slate-300 to-slate-400 rounded-3xl blur-lg opacity-40 scale-110"></div>
                <div class="relative w-20 h-20 rounded-3xl overflow-hidden ring-4 ring-white/20 shadow-2xl">
                  <div *ngIf="!selectedApp()?.candidate?.picture" class="w-full h-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
                    <span class="text-white font-black text-3xl">{{ selectedApp()?.candidate?.first_name?.[0] }}{{ selectedApp()?.candidate?.last_name?.[0] }}</span>
                  </div>
                  <img *ngIf="selectedApp()?.candidate?.picture" [src]="selectedApp().candidate.picture" class="w-full h-full object-cover" />
                </div>
                <!-- Status Indicator -->
                <div [class]="'absolute -bottom-1 -right-1 w-6 h-6 rounded-xl border-3 border-slate-800 flex items-center justify-center ' + getStatusBgColor(selectedApp()?.status)">
                  <svg *ngIf="selectedApp()?.status?.toLowerCase() === 'accepted'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="text-white"><polyline points="20 6 9 17 4 12"/></svg>
                  <svg *ngIf="selectedApp()?.status?.toLowerCase() === 'rejected'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="text-white"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  <div *ngIf="selectedApp()?.status?.toLowerCase() === 'pending'" class="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              
              <!-- Name & Role -->
              <div>
                <h2 class="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                  {{ selectedApp()?.candidate?.first_name }} <span class="text-slate-600">{{ selectedApp()?.candidate?.last_name }}</span>
                </h2>
                <div class="flex items-center gap-3">
                  <span class="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-widest border border-slate-200">
                    {{ selectedApp()?.candidate?.specialty?.name || 'Candidate' }}
                  </span>
                  <span *ngIf="selectedApp()?.status" [class]="'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border ' + getStatusBadgeClass(selectedApp()?.status)">
                    {{ selectedApp()?.status }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Right: Actions -->
            <div class="relative flex items-center gap-3 z-10">
              <button
                *ngIf="!selectedApp()?.ai_restricted"
                (click)="rescoreApplication(selectedApp())"
                [disabled]="rescoringApplicationIds().has(selectedApp()?.id)"
                class="h-12 px-5 rounded-2xl bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200 flex items-center gap-2 disabled:opacity-50"
                title="Regenerate AI Match & Parsing"
              >
                <svg *ngIf="!rescoringApplicationIds().has(selectedApp()?.id)" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                <svg *ngIf="rescoringApplicationIds().has(selectedApp()?.id)" class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"/></svg>
                {{ rescoringApplicationIds().has(selectedApp()?.id) ? 'Re-analyzing...' : 'Reparse AI' }}
              </button>

              <button (click)="closeModal()" class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-all border border-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>

          <!-- Body (Scrollable) -->
          <div class="flex-1 p-10 overflow-y-auto custom-scrollbar space-y-10">

              <!-- AI Match Score Section - Clean White -->
              <div *ngIf="selectedApp()?.ai_restricted" class="relative overflow-hidden rounded-[2rem] bg-slate-50 border border-slate-200 p-8 text-center">
                <div class="max-w-md mx-auto py-6">
                  <div class="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-6 text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><rect x="14" y="14" width="8" height="8" rx="2"/><path d="M18 14v-4"/></svg>
                  </div>
                  <h3 class="text-xl font-black text-slate-900 mb-2">AI Insights Restricted</h3>
                  <p class="text-sm font-bold text-slate-500 leading-relaxed mb-6">
                    This company's current subscription plan does not include AI-powered candidate matching and semantic analysis.
                  </p>
                  <a routerLink="/company/pricing" class="inline-flex h-12 px-8 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all items-center shadow-lg shadow-blue-500/20">
                    Upgrade Subscription
                  </a>
                </div>
              </div>

              <div *ngIf="!selectedApp()?.ai_restricted && selectedApp()?.ai_match_score != null" class="relative overflow-hidden rounded-[2rem] bg-white ring-1 ring-slate-200">
              <!-- Soft Background Effects -->
              <div class="absolute inset-0 overflow-hidden">
                <div class="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-slate-100/50 to-slate-200/30 rounded-full blur-3xl"></div>
                <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-slate-100/50 to-slate-200/30 rounded-full blur-3xl"></div>
              </div>
              
              <div class="relative p-8">
                <!-- Header -->
                <div class="flex items-center justify-between mb-6">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    </div>
                    <div>
                      <p class="text-[11px] font-black uppercase tracking-widest text-slate-500">AI Match Analysis</p>
                      <p class="text-xs font-bold text-slate-400">Semantic Compatibility Score</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-wider" [ngClass]="{
                      'text-emerald-600': selectedApp()?.ai_match_score >= 0.7,
                      'text-amber-600': selectedApp()?.ai_match_score >= 0.5 && selectedApp()?.ai_match_score < 0.7,
                      'text-rose-600': selectedApp()?.ai_match_score < 0.5
                    }">
                      {{ selectedApp()?.ai_match_score >= 0.7 ? 'Strong Match' : selectedApp()?.ai_match_score >= 0.5 ? 'Moderate Match' : 'Weak Match' }}
                    </span>
                    <button 
                      *ngIf="hasPassedTechnicalQuiz(selectedApp())"
                      (click)="openTechnicalReport(selectedApp())"
                      class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      Report
                    </button>
                  </div>
                </div>

                <!-- Main Content - Large Score + Breakdown -->
                <div class="flex items-stretch gap-6">
                  <!-- Large Circular Score -->
                  <div class="relative w-40 h-40 shrink-0">
                    <!-- Outer Glow -->
                    <div class="absolute inset-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-200/50 blur-xl"></div>
                    <svg class="w-full h-full -rotate-90 relative z-10" viewBox="0 0 100 100">
                      <!-- Background Track -->
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#E2E8F0" stroke-width="6"/>
                      <!-- Progress Arc with Gradient -->
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" [attr.stop-color]="getScoreColor(selectedApp().ai_match_score)" stop-opacity="0.9"/>
                          <stop offset="100%" [attr.stop-color]="getScoreColor(selectedApp().ai_match_score)"/>
                        </linearGradient>
                      </defs>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="url(#scoreGradient)" stroke-width="6" stroke-linecap="round" 
                        stroke-dasharray="264" 
                        [attr.stroke-dashoffset]="264 * (1 - selectedApp().ai_match_score)"
                        class="transition-all duration-1000 ease-out"/>
                    </svg>
                    <!-- Score Text -->
                    <div class="absolute inset-0 flex flex-col items-center justify-center z-20">
                      <span class="text-5xl font-black tracking-tighter" [ngStyle]="{'color': getScoreColor(selectedApp().ai_match_score)}">
                        {{ (selectedApp().ai_match_score * 100) | number:'1.0-0' }}
                      </span>
                      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">% Match</span>
                    </div>
                  </div>

                  <!-- Score Breakdown - Card Style -->
                  <div class="flex-1 grid grid-cols-2 gap-3">
                    <!-- Semantic Card -->
                    <div class="p-4 rounded-xl bg-white border border-slate-100 hover:border-slate-300 transition-all group">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <div class="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-violet-600"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                          </div>
                          <span class="text-[11px] font-bold text-violet-600">Semantic</span>
                        </div>
                        <span class="text-lg font-black text-violet-700">{{ ((selectedApp()?.ai_semantic_score ?? 0) * 100) | number:'1.0-0' }}<span class="text-xs text-violet-500">%</span></span>
                      </div>
                      <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-500" [style.width]="((selectedApp()?.ai_semantic_score ?? 0) * 100) + '%'"></div>
                      </div>
                    </div>

                    <!-- Skills Card -->
                    <div class="p-4 rounded-xl bg-white border border-slate-100 hover:border-slate-300 transition-all group">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <div class="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-600"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          </div>
                          <span class="text-[11px] font-bold text-blue-600">Skills</span>
                        </div>
                        <span class="text-lg font-black text-blue-700">{{ ((selectedApp()?.ai_skill_score ?? 0) * 100) | number:'1.0-0' }}<span class="text-xs text-blue-500">%</span></span>
                      </div>
                      <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500" [style.width]="((selectedApp()?.ai_skill_score ?? 0) * 100) + '%'"></div>
                      </div>
                    </div>

                    <!-- Experience Card -->
                    <div class="p-4 rounded-xl bg-white border border-slate-100 hover:border-slate-300 transition-all group">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <div class="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-600"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                          </div>
                          <span class="text-[11px] font-bold text-emerald-600">Experience</span>
                        </div>
                        <span class="text-lg font-black text-emerald-700">{{ ((selectedApp()?.ai_experience_score ?? 0) * 100) | number:'1.0-0' }}<span class="text-xs text-emerald-500">%</span></span>
                      </div>
                      <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500" [style.width]="((selectedApp()?.ai_experience_score ?? 0) * 100) + '%'"></div>
                      </div>
                    </div>

                    <!-- Education Card -->
                    <div class="p-4 rounded-xl bg-white border border-slate-100 hover:border-slate-300 transition-all group">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <div class="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-600"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 4 6 4s6-2 6-4v-5"/></svg>
                          </div>
                          <span class="text-[11px] font-bold text-amber-600">Education</span>
                        </div>
                        <span class="text-lg font-black text-amber-700">{{ ((selectedApp()?.ai_degree_score ?? 0) * 100) | number:'1.0-0' }}<span class="text-xs text-amber-500">%</span></span>
                      </div>
                      <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500" [style.width]="((selectedApp()?.ai_degree_score ?? 0) * 100) + '%'"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- AI Summary - Premium Card -->
                <div class="mt-6 p-5 rounded-xl bg-white border-l-4 border-l-slate-400 border-y border-r border-slate-200">
                  <div class="flex items-start gap-4">
                    <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-slate-600"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    </div>
                    <div>
                      <p class="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">AI Assessment</p>
                      <p class="text-sm font-bold text-slate-700 leading-relaxed">{{ selectedApp()?.ai_explanation?.summary || 'Candidate demonstrates strong compatibility with position requirements through relevant skills and experience.' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Two Column Layout -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <!-- Left Column -->
              <div class="space-y-8">
                <!-- Contact Info Card - Enhanced -->
                <div class="space-y-4">
	                  <div class="flex items-center gap-3">
	                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
	                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
	                    </div>
	                    <h3 class="text-xs font-black uppercase tracking-widest text-cyan-700">Contact</h3>
	                  </div>
	                  <div class="space-y-3">
	                    <!-- Email -->
	                    <a [href]="'mailto:' + selectedApp()?.candidate?.user?.email" class="flex items-center gap-4 p-4 rounded-xl bg-white border border-cyan-100 hover:border-cyan-300 transition-all group">
	                      <div class="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center group-hover:bg-cyan-100 transition-colors">
	                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-700"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
	                      </div>
	                      <div class="min-w-0 flex-1">
	                        <p class="text-[10px] font-bold text-cyan-500 uppercase tracking-wider mb-0.5">Email Address</p>
	                        <p class="text-sm font-bold text-slate-800 truncate group-hover:text-cyan-700 transition-colors">{{ selectedApp()?.candidate?.user?.email }}</p>
	                      </div>
	                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-300 group-hover:text-cyan-600"><polyline points="9 18 15 12 9 6"/></svg>
	                    </a>
	                    <!-- Phone -->
	                    <div class="flex items-center gap-4 p-4 rounded-xl bg-white border border-emerald-100">
	                      <div class="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
	                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-700"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
	                      </div>
	                      <div class="flex-1">
	                        <p class="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-0.5">Phone Number</p>
	                        <p class="text-sm font-bold text-slate-800">{{ selectedApp()?.candidate?.phone || 'Not provided' }}</p>
	                      </div>
	                    </div>
                  </div>
                </div>

                <!-- Skills Section -->
                <div class="space-y-3">
	                  <div class="flex items-center gap-2">
	                    <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
	                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-700"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
	                    </div>
	                    <h3 class="text-xs font-black uppercase tracking-widest text-indigo-700">Skills & Expertise</h3>
	                    <span class="ml-auto px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-black">{{ selectedApp()?.candidate?.skills?.length || 0 }}</span>
	                  </div>
	                  <div class="flex flex-wrap gap-2">
	                    <span *ngFor="let s of selectedApp()?.candidate?.skills" class="px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 transition-all cursor-default">
	                      {{ s.name }}
	                    </span>
	                  </div>
                </div>
              </div>

              <!-- Right Column -->
              <div class="space-y-8">
                <!-- Education Card - Premium -->
                <div class="space-y-4">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 4 6 4s6-2 6-4v-5"/></svg>
                    </div>
                    <h3 class="text-xs font-black uppercase tracking-widest text-amber-700">Education</h3>
                    <div *ngIf="selectedApp()?.ai_degree_score != null" class="ml-auto px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-200">
                      <span class="text-[10px] font-black text-amber-700">{{ (selectedApp()?.ai_degree_score * 100) | number:'1.0-0' }}% Match</span>
                    </div>
                  </div>
                  <div class="p-5 rounded-xl bg-amber-50/40 border border-amber-100">
                    <div class="flex items-start gap-4">
                      <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 flex items-center justify-center shrink-0">
                        <span class="text-2xl">🎓</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-base font-black text-slate-900 leading-tight">{{ selectedApp()?.candidate?.diploma || 'Degree Not Specified' }}</p>
                        <p class="text-sm font-bold text-amber-700/80 mt-1">{{ selectedApp()?.candidate?.university || 'University Not Provided' }}</p>
                        <div *ngIf="selectedApp()?.ai_explanation?.details?.degree" class="mt-3 pt-3 border-t border-amber-200">
                          <div class="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-amber-600"><polyline points="20 6 9 17 4 12"/></svg>
                            <p class="text-[10px] font-bold text-amber-700 uppercase">AI Verified</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Experience Summary - Premium -->
                <div class="space-y-4">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <h3 class="text-xs font-black uppercase tracking-widest text-emerald-700">Experience</h3>
                    <div *ngIf="selectedApp()?.ai_experience_score != null" class="ml-auto px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-200">
                      <span class="text-[10px] font-black text-emerald-700">{{ (selectedApp()?.ai_experience_score * 100) | number:'1.0-0' }}% Match</span>
                    </div>
                  </div>
                  <div class="p-5 rounded-xl bg-emerald-50/40 border border-emerald-100">
                    <div class="flex items-start gap-4">
                      <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 flex items-center justify-center shrink-0">
                        <span class="text-2xl">💼</span>
                      </div>
                      <div class="flex-1">
                        <p class="text-base font-black text-slate-900">{{ selectedApp()?.candidate?.experience_years || '0' }} Years</p>
                        <p class="text-sm font-bold text-emerald-700/80 mt-1">Professional Experience</p>
                        <div class="mt-3 flex items-center gap-2">
                          <div class="h-2 flex-1 rounded-full bg-emerald-100 overflow-hidden">
                            <div class="h-full rounded-full bg-emerald-500" [style.width]="min(selectedApp()?.candidate?.experience_years * 5, 100) + '%'"></div>
                          </div>
                          <span class="text-[10px] font-bold text-emerald-600">{{ selectedApp()?.candidate?.experience_years || 0 }}/20 yrs</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bio Section -->
            <div *ngIf="selectedApp()?.candidate?.bio" class="space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-700"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <h3 class="text-xs font-black uppercase tracking-widest text-rose-700">About</h3>
              </div>
              <div class="p-6 bg-rose-50/40 rounded-2xl border border-rose-100">
                <p class="text-sm font-medium text-slate-600 leading-relaxed">{{ selectedApp()?.candidate?.bio }}</p>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button (click)="closeModal()" class="px-6 py-3 rounded-xl font-black text-xs text-slate-500 uppercase tracking-widest hover:bg-slate-100 transition-all">
                Close Profile
              </button>
              <div class="flex items-center gap-3">
                <button 
                  (click)="openCV(selectedApp()?.cv_url || selectedApp()?.candidate?.cv)"
                  class="px-6 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  View CV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    <!-- Reject Confirmation Modal -->
    <div *ngIf="confirmRejectApp()" class="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="confirmRejectApp.set(null)"></div>
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
        <div class="p-8 text-center">
          <div class="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-rose-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-500"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
          </div>
          <h3 class="text-xl font-black text-slate-900 mb-2">Reject Application?</h3>
          <p class="text-slate-500 text-sm font-medium leading-relaxed">
            Are you sure you want to reject <strong class="text-slate-700">{{ confirmRejectApp()?.candidate?.first_name }} {{ confirmRejectApp()?.candidate?.last_name }}</strong>'s application for <strong class="text-slate-700">{{ confirmRejectApp()?.job_offer?.title }}</strong>?
          </p>
          <p class="text-slate-400 text-xs font-bold mt-3">
            The candidate will be notified by email and push notification.
          </p>
        </div>
        <div class="px-8 pb-8 flex gap-3">
          <button 
            (click)="confirmRejectApp.set(null)" 
            class="flex-1 h-12 rounded-2xl font-black text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
          >Cancel</button>
          <button 
            (click)="rejectCandidate(confirmRejectApp())" 
            [disabled]="isDecisionBlocked(confirmRejectApp())"
            class="flex-1 h-12 rounded-2xl font-black text-sm text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/30 transition-all disabled:opacity-50"
          >Yes, Reject</button>
        </div>
      </div>
    </div>
  <!-- ===== QUIZ CONFIGURATION MODAL ===== -->
  <div *ngIf="quizApp()" class="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
    <div class="absolute inset-0 bg-slate-900/70 backdrop-blur-xl" (click)="closeQuizModal()"></div>

    <div class="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">

      <!-- Modal Header -->
      <div class="px-10 pt-10 pb-8 border-b border-slate-50">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border border-orange-100">
              ⚡ Assessment Engine
            </div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight leading-none">Configure Quiz</h2>
            <p class="text-slate-400 font-bold text-xs mt-2">
              For <span class="text-slate-700">{{ quizApp()?.candidate?.first_name }} {{ quizApp()?.candidate?.last_name }}</span>
              · <span class="text-violet-600">{{ quizApp()?.job_offer?.title }}</span>
            </p>
          </div>
          <button (click)="closeQuizModal()" class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all shrink-0 border border-transparent">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="px-10 py-8 space-y-8">

        <!-- Difficulty -->
        <div>
          <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Difficulty Level</label>
          <div class="grid grid-cols-4 gap-2">
            <button
              *ngFor="let d of ['easy','medium','hard','mixed']"
              (click)="quizDifficulty.set(d)"
              [class]="'h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ' +
                (quizDifficulty() === d
                  ? getDifficultyActiveClass(d)
                  : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100')"
            >
              {{ d }}
            </button>
          </div>
        </div>

        <!-- Number of Questions -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400">Number of Questions</label>
            <span class="text-2xl font-black text-slate-900">{{ quizNumQuestions() }}</span>
          </div>
          <input
            type="range"
            min="5" max="15" step="1"
            [value]="quizNumQuestions()"
            (input)="quizNumQuestions.set(+$any($event.target).value)"
            class="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-orange-500"
          />
          <div class="flex justify-between text-[9px] font-black text-slate-300 uppercase mt-2">
            <span>5 min</span>
            <span>10 avg</span>
            <span>15 max</span>
          </div>
        </div>

        <!-- Time Limit -->
        <div>
          <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Time Limit Per Question (minutes)</label>
          <div class="flex items-center gap-3">
            <div class="flex-1 relative">
              <input
                type="number"
                min="5" max="120"
                [value]="quizTimeLimit() ?? ''"
                (input)="setQuizTimeLimit($any($event.target).value)"
                placeholder="No limit"
                class="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 font-black text-slate-800 focus:bg-white focus:border-orange-400/30 text-sm transition-all outline-none"
              />
            </div>
            <button
              (click)="quizTimeLimit.set(null)"
              [class]="'h-14 px-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ' +
                (quizTimeLimit() === null
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100')"
            >
              ∞ None
            </button>
          </div>
        </div>

        <!-- Summary Card -->
        <div class="p-5 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 flex items-center gap-5">
          <div class="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div class="text-xs font-bold text-orange-700 leading-relaxed">
            The AI will generate a <strong>{{ quizNumQuestions() }}-question {{ quizDifficulty() }}</strong> assessment
            <span *ngIf="quizTimeLimit()"> with a <strong>{{ quizTimeLimit() }}-minute</strong> limit per question</span>
            <span *ngIf="!quizTimeLimit()"> with <strong>no per-question timer</strong></span>.
            The recruiter will review the generated draft before sending it to the candidate.
          </div>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="px-10 pb-10 flex items-center gap-3">
        <button (click)="closeQuizModal()" class="flex-1 h-14 rounded-2xl font-black text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100">
          Cancel
        </button>
        <button
          (click)="launchQuiz()"
          [disabled]="quizLaunching()"
          class="flex-1 h-14 rounded-2xl font-black text-sm text-white bg-orange-500 hover:bg-orange-600 shadow-xl shadow-orange-500/25 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span *ngIf="!quizLaunching()">🚀 Launch Assessment</span>
          <span *ngIf="quizLaunching()" class="flex items-center gap-2">
            <span class="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full inline-block"></span>
            Generating...
          </span>
        </button>
      </div>

    </div>
  </div>
  <div *ngIf="quizInspectorApp()" class="fixed inset-0 z-[3100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
    <div class="absolute inset-0 bg-slate-900/70 backdrop-blur-xl" (click)="closeQuizInspector()"></div>

    <div class="relative bg-white w-full max-w-5xl max-h-[92vh] rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
      <div class="px-10 pt-10 pb-8 border-b border-slate-50 flex items-start justify-between gap-6">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-sky-50 text-sky-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border border-sky-100">
            Assessment Workspace
          </div>
          <h2 class="text-3xl font-black text-slate-900 tracking-tight leading-none">
            {{ quizInspectorMode() === 'report' ? 'Candidate Report' : 'Quiz Review' }}
          </h2>
          <p class="text-slate-400 font-bold text-xs mt-3">
            {{ quizInspectorApp()?.candidate?.first_name }} {{ quizInspectorApp()?.candidate?.last_name }}
            - {{ quizInspectorApp()?.job_offer?.title }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <span
            *ngIf="quizInspectorData()?.session?.status as quizStatus"
            [class]="'px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ' + getQuizStatusChipClass(quizStatus)"
          >
            {{ quizStatus }}
          </span>
          <button
            (click)="closeQuizInspector()"
            class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all border border-transparent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scrollbar px-10 py-8">
        <div *ngIf="quizInspectorLoading()" class="py-24 text-center">
          <div class="w-12 h-12 border-4 border-slate-100 border-t-sky-500 rounded-full animate-spin mx-auto"></div>
          <p class="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-5">Loading workspace</p>
        </div>

        <div *ngIf="!quizInspectorLoading() && quizInspectorError()" class="p-6 rounded-3xl bg-rose-50 border border-rose-100 text-rose-700 font-bold text-sm">
          {{ quizInspectorError() }}
        </div>

        <div *ngIf="!quizInspectorLoading() && !quizInspectorError() && quizInspectorData() as quiz">
          <ng-container *ngIf="quizInspectorMode() === 'review'; else reportMode">
            <div class="grid md:grid-cols-3 gap-4 mb-8">
              <div class="p-5 rounded-3xl border border-slate-100 bg-slate-50">
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Questions</div>
                <div class="text-3xl font-black text-slate-900">{{ quiz.progress?.questions_generated || quiz.questions?.length || 0 }}/{{ quiz.session?.num_questions }}</div>
              </div>
              <div class="p-5 rounded-3xl border border-slate-100 bg-slate-50">
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Difficulty</div>
                <div class="text-3xl font-black text-slate-900">{{ quiz.session?.difficulty_setting || 'mixed' }}</div>
              </div>
              <div class="p-5 rounded-3xl border border-slate-100 bg-slate-50">
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Time Limit</div>
                <div class="text-3xl font-black text-slate-900">{{ quiz.session?.time_limit || 'None' }}</div>
              </div>
            </div>

            <div class="space-y-6">
              <div
                *ngFor="let question of quiz.questions"
                class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm"
                [attr.draggable]="quiz.session?.status === 'review'"
                (dragstart)="onQuestionDragStart(question)"
                (dragover)="onQuestionDragOver($event)"
                (drop)="onQuestionDrop(question)"
              >
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                  <div>
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Question {{ question.question_number }}</div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <div class="text-sm font-black text-slate-900">{{ question.skill_targeted || 'General focus' }}</div>
                      <span
                        *ngIf="question.hr_approved"
                        class="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100"
                      >
                        Approved
                      </span>
                      <span
                        *ngIf="quiz.session?.status === 'review'"
                        class="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-200"
                      >
                        Drag To Reorder
                      </span>
                    </div>
                  </div>
                  <span class="px-4 py-2 rounded-2xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                    {{ question.difficulty }}
                  </span>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Question Text</label>
                    <textarea
                      [(ngModel)]="question.question_text"
                      rows="3"
                      class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:bg-white resize-y"
                    ></textarea>
                  </div>

                  <div>
                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Reference Answer</label>
                    <textarea
                      [(ngModel)]="question.reference_answer"
                      rows="4"
                      class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:bg-white resize-y"
                    ></textarea>
                  </div>

                  <div class="grid md:grid-cols-3 gap-4">
                    <div>
                      <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Follow-up Hint</label>
                      <input
                        [(ngModel)]="question.follow_up_hint"
                        class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Answer Length</label>
                      <input
                        type="number"
                        [(ngModel)]="question.estimated_answer_length"
                        class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Difficulty</label>
                      <select
                        [(ngModel)]="question.difficulty"
                        class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:bg-white"
                      >
                        <option value="easy">easy</option>
                        <option value="medium">medium</option>
                        <option value="hard">hard</option>
                      </select>
                    </div>
                  </div>

                  <div class="flex flex-wrap justify-end gap-3">
                    <button
                      *ngIf="quiz.session?.status === 'review'"
                      (click)="approveQuizQuestion(question)"
                      [disabled]="quizQuestionSavingId() === question.id"
                      class="h-12 px-6 rounded-2xl bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 disabled:opacity-60"
                    >
                      {{ quizQuestionSavingId() === question.id && !question.hr_approved ? 'Saving...' : (question.hr_approved ? 'Approved' : 'Approve As-Is') }}
                    </button>
                    <button
                      *ngIf="quiz.session?.status === 'review'"
                      (click)="regenerateQuizQuestion(question)"
                      [disabled]="quizQuestionRegeneratingId() === question.id"
                      class="h-12 px-6 rounded-2xl bg-amber-50 text-amber-700 font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100 disabled:opacity-60"
                    >
                      {{ quizQuestionRegeneratingId() === question.id ? 'Regenerating...' : 'Regenerate' }}
                    </button>
                    <button
                      *ngIf="quiz.session?.status === 'review'"
                      (click)="saveQuizQuestion(question)"
                      [disabled]="quizQuestionSavingId() === question.id"
                      class="h-12 px-6 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all disabled:opacity-60"
                    >
                      {{ quizQuestionSavingId() === question.id ? 'Saving...' : 'Save Question' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ng-container>

          <ng-template #reportMode>
            <div *ngIf="quiz.report; else pendingReport" class="space-y-8">
              <div class="grid md:grid-cols-3 gap-4">
                <div class="p-6 rounded-[2rem] border border-slate-100 bg-slate-50">
                  <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Overall Score</div>
                  <div class="text-4xl font-black" [ngStyle]="{'color': getAssessmentScoreColor(quiz.report.total_score)}">
                    {{ quiz.report.total_score | number:'1.0-0' }}%
                  </div>
                </div>
                <div class="p-6 rounded-[2rem] border border-slate-100 bg-slate-50">
                  <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Questions Scored</div>
                  <div class="text-4xl font-black text-slate-900">{{ quiz.progress?.answers_scored || 0 }}/{{ quiz.session?.num_questions || 0 }}</div>
                </div>
                <div class="p-6 rounded-[2rem] border border-slate-100 bg-slate-50">
                  <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Session Status</div>
                  <div class="text-3xl font-black text-slate-900">{{ quiz.session?.status }}</div>
                </div>
              </div>

              <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Narrative Summary</div>
                <p class="text-sm font-semibold text-slate-700 leading-7">{{ quiz.report.narrative_summary }}</p>
              </div>

              <div class="grid lg:grid-cols-2 gap-6">
                <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                  <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Confirmed Strengths</div>
                  <div class="space-y-3">
                    <div *ngFor="let item of quiz.report.confirmed_strengths" class="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                      <span class="font-black text-emerald-800 text-sm">{{ item.focus_area }}</span>
                      <span class="text-[10px] font-black uppercase tracking-widest text-emerald-600">{{ item.score | number:'1.0-0' }}%</span>
                    </div>
                  </div>
                </div>

                <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                  <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Critical Gaps</div>
                  <div class="space-y-3">
                    <div *ngFor="let item of quiz.report.critical_gaps" class="flex items-center justify-between rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3">
                      <span class="font-black text-rose-800 text-sm">{{ item.focus_area }}</span>
                      <span class="text-[10px] font-black uppercase tracking-widest text-rose-600">{{ item.score | number:'1.0-0' }}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <div *ngFor="let item of quiz.report.question_reports" class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                  <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
                    <div>
                      <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Question {{ item.question_number }}</div>
                      <div class="text-sm font-black text-slate-900">{{ item.question_text }}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{{ item.focus_area }}</div>
                      <div class="text-2xl font-black" [ngStyle]="{'color': getAssessmentScoreColor(item.score)}">{{ item.score | number:'1.0-0' }}%</div>
                    </div>
                  </div>
                  <div class="grid lg:grid-cols-2 gap-4 text-sm">
                    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Candidate Answer</div>
                      <p class="font-semibold text-slate-700 leading-6">{{ item.answer_text || 'No answer submitted.' }}</p>
                    </div>
                    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Scoring Reasoning</div>
                      <p class="font-semibold text-slate-700 leading-6">{{ item.reasoning || 'No reasoning available.' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ng-template #pendingReport>
              <div class="p-8 rounded-[2rem] border border-slate-100 bg-slate-50 text-center">
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Scoring In Progress</div>
                <p class="text-sm font-semibold text-slate-700">
                  Answers have not all been scored yet. Refresh this application again in a moment.
                </p>
              </div>
            </ng-template>
          </ng-template>
        </div>
      </div>

      <div
        *ngIf="!quizInspectorLoading() && !quizInspectorError() && quizInspectorMode() === 'review' && quizInspectorData()?.session?.status === 'review'"
        class="px-10 pb-10 pt-6 border-t border-slate-50 flex items-center justify-end gap-3"
      >
        <button
          (click)="closeQuizInspector()"
          class="h-12 px-6 rounded-2xl bg-slate-50 text-slate-500 font-black text-[10px] uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all"
        >
          Close
        </button>
        <button
          (click)="sendQuizToCandidate()"
          [disabled]="quizSending() || quizQuestionSavingId() || quizQuestionRegeneratingId() || quizReordering()"
          class="h-12 px-6 rounded-2xl bg-sky-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-sky-700 transition-all disabled:opacity-60"
        >
          {{ quizSending() ? 'Sending...' : 'Send To Candidate' }}
        </button>
    </div>
  </div>

  </div>

  <!-- Manual Quiz Results Modal (HR/Company) -->
  <div *ngIf="manualResultsApp()" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(20px); z-index: 5000; display: flex; align-items: center; justify-content: center; padding: 24px;">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" (click)="closeManualResultsModal()"></div>
      <div class="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in slide-in-from-bottom-8 duration-500">
         
         <div class="px-10 py-10 bg-white flex items-center justify-between border-b border-slate-50 shrink-0">
            <div class="flex items-center gap-6">
               <div class="w-16 h-16 rounded-[1.5rem] bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-indigo-600/20">
                  {{ manualResultsData()?.score | number:'1.0-0' }}%
               </div>
               <div>
                  <h2 class="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Technical Assessment Audit</h2>
                  <p class="text-xs text-slate-400 font-bold uppercase tracking-widest">Candidate performance evaluation report (HR View)</p>
               </div>
            </div>
            <button (click)="closeManualResultsModal()" class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all border border-transparent">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
         </div>

         <div class="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-10">
            <div *ngIf="loadingManualResults()" class="py-20 text-center">
               <div class="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
               <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Fetching candidate responses...</p>
            </div>

            <div *ngIf="!loadingManualResults() && manualResultsData()" class="space-y-12">
               <!-- Global Stats Card -->
               <div class="grid md:grid-cols-3 gap-6">
                  <div class="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 transition-hover hover:border-indigo-200">
                     <span class="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Quiz Theme</span>
                     <p class="text-lg font-black text-slate-900">{{ manualResultsData()?.quiz?.title || 'General Assessment' }}</p>
                  </div>
                  <div class="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 transition-hover hover:border-indigo-200">
                     <span class="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Duration Allocation</span>
                     <p class="text-lg font-black text-slate-900">{{ manualResultsData()?.quiz?.time_limit }} Minutes</p>
                  </div>
                  <div class="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 transition-hover hover:border-indigo-200">
                     <span class="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Submission Date</span>
                     <p class="text-lg font-black text-slate-900">{{ manualResultsData()?.completed_at | date:'mediumDate' }}</p>
                  </div>
               </div>

               <!-- Detailed Audit -->
               <div class="space-y-6">
                  <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Response Breakdown</h3>
                  
                  <div *ngFor="let q of manualResultsData()?.quiz?.questions; let qi = index" class="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                     <div class="flex items-start gap-6 relative z-10">
                        <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 transition-all duration-500"
                             [ngClass]="getAnswerForQuestion(q.id)?.is_correct ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'">
                           {{ qi + 1 }}
                        </div>
                        
                        <div class="flex-1 space-y-6">
                           <div>
                              <p class="text-lg font-bold text-slate-800 leading-snug group-hover:text-slate-900 transition-colors">{{ q.question_text }}</p>
                           </div>

                           <div class="grid sm:grid-cols-2 gap-4">
                              <div class="px-6 py-4 rounded-3xl border border-slate-100 bg-slate-50/50 flex items-center justify-between group-hover:bg-white transition-colors">
                                 <div class="flex flex-col">
                                    <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1.5">Candidate Choice</span>
                                    <span class="text-sm font-black" [ngClass]="getAnswerForQuestion(q.id)?.is_correct ? 'text-emerald-600' : 'text-rose-600'">
                                        Option {{ getAnswerForQuestion(q.id)?.selected_choice || 'N/A' }}
                                    </span>
                                 </div>
                                 <div *ngIf="getAnswerForQuestion(q.id)?.is_correct" class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                 </div>
                                  <div *ngIf="getAnswerForQuestion(q.id) && !getAnswerForQuestion(q.id)?.is_correct" class="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                 </div>
                              </div>

                              <div class="px-6 py-4 rounded-3xl border border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
                                 <div class="flex flex-col">
                                    <span class="text-[9px] font-black uppercase text-emerald-800 tracking-widest leading-none mb-1.5">Verified Correct</span>
                                    <span class="text-sm font-black text-emerald-900">Option {{ q.correct_choice }}</span>
                                 </div>
                                 <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   </div>
`,
  styles: [`
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
`]
})
export class ApplicantsComponent implements OnInit, OnDestroy {
  private readonly technicalPassScore = 50;
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  applicants = signal<any[]>([]);
  jobId = signal<string | null>(null);
  selectedApp = signal<any>(null);
  isSubscriptionInactive = signal(false);
  isCompanyDeactivated = signal(false);
  launchingId = signal<number | null>(null);
  rescoringId = signal<number | null>(null);
  confirmRejectApp = signal<any>(null);
  rejectingId = signal<number | null>(null);
  acceptingId = signal<number | null>(null);

  // Unified Quiz Modal State
  quizApp = signal<any>(null);
  quizDifficulty = signal<string>('mixed');
  quizNumQuestions = signal<number>(8);
  quizTimeLimit = signal<number | null>(null);
  quizLaunching = signal<boolean>(false);
  quizInspectorApp = signal<any>(null);
  quizInspectorMode = signal<'review' | 'report'>('review');
  quizInspectorData = signal<any | null>(null);
  quizInspectorLoading = signal<boolean>(false);
  quizInspectorError = signal<string | null>(null);
  quizQuestionSavingId = signal<string | null>(null);
  quizQuestionRegeneratingId = signal<string | null>(null);
  quizReordering = signal<boolean>(false);
  draggedQuestionId = signal<string | null>(null);
  quizSending = signal<boolean>(false);

  // Manual Quiz Results state
  manualResultsApp = signal<any>(null);
  manualResultsData = signal<any>(null);
  loadingManualResults = signal(false);
  // Public so template can access for loading state
  rescoringApplicationIds = signal<Set<number>>(new Set()); // Track apps being rescored

  viewManualResults(app: any) {
    if (!app) return;
    this.manualResultsApp.set(app);
    this.manualResultsData.set(null);
    this.loadingManualResults.set(true);
    this.cdr.detectChanges();
    this.notificationService.info('Fetching candidate report...');
    this.apiService.get<any>(`company/applications/${app.id}/manual-quiz/results`).subscribe({
      next: (res) => {
        this.loadingManualResults.set(false);
        if (res.success) {
          this.manualResultsData.set(res.data);
        } else {
          this.notificationService.error(res.message || 'Failed to load results');
          this.manualResultsApp.set(null);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingManualResults.set(false);
        const message =
          err?.error?.message ||
          err?.error?.error ||
          err?.message ||
          'Could not load technical results.';
        this.notificationService.error(message);
        this.manualResultsApp.set(null);
        this.cdr.detectChanges();
      }
    });
  }

  closeManualResultsModal() {
    this.manualResultsApp.set(null);
    this.manualResultsData.set(null);
    this.loadingManualResults.set(false);
  }

  openCv(event: Event, app: any) {
    event.preventDefault();
    event.stopPropagation();

    if (!app?.id) return;

    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      this.notificationService.error('Allow pop-ups to preview the CV.');
      return;
    }

    previewWindow.document.title = 'CV Preview';
    previewWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">Loading CV...</p>';

    this.apiService.getBlob(`company/applications/${app.id}/cv`).subscribe({
      next: (blob) => {
        if (!(blob instanceof Blob) || blob.size === 0) {
          previewWindow.close();
          this.notificationService.error('The CV file is empty or unavailable.');
          return;
        }

        const blobUrl = URL.createObjectURL(blob);
        previewWindow.location.replace(blobUrl);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      },
      error: () => {
        previewWindow.close();
        this.notificationService.error('Could not open this CV.');
      }
    });
  }

  getAnswerForQuestion(questionId: number) {
    // In the new structure, answers are nested inside questions
    const question = this.manualResultsData()?.quiz?.questions?.find((q: any) => q.id === questionId);
    return question?.answer || null;
  }

  searchQuery = '';
  statusFilter = signal<string>('all');

  // Interview logic


  isApplicantsLocked = computed(
    () => this.isSubscriptionInactive() || this.isCompanyDeactivated()
  );

  filteredApplicants = computed(() => {
    let list = [...this.applicants()];
    const q = this.searchQuery?.toLowerCase()?.trim();
    const sf = this.statusFilter();

    if (sf !== 'all') {
      list = list.filter(app => app.status === sf);
    }

    if (q) {
      list = list.filter(app => {
        const name = `${app.candidate?.first_name} ${app.candidate?.last_name}`.toLowerCase();
        const email = (app.candidate?.user?.email || '').toLowerCase();
        const title = (app.job_offer?.title || '').toLowerCase();
        const skills = (app.candidate?.skills || []).map((s: any) => s.name.toLowerCase()).join(' ');
        return name.includes(q) || email.includes(q) || title.includes(q) || skills.includes(q);
      });
    }

    return list.sort((a, b) => {
      const scoreA = a?.ai_match_score ?? 0;
      const scoreB = b?.ai_match_score ?? 0;

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      const appliedA = new Date(a?.applied_at || 0).getTime();
      const appliedB = new Date(b?.applied_at || 0).getTime();
      return appliedB - appliedA;
    });
  });

  ngOnInit() {
    this.loadSubscriptionStatus();
    this.loadCompanyAccessStatus();

    // Priority 1: jobId passed via navigation state (from interview form or dashboard)
    const stateJobId = this.toPositiveJobId(window.history.state?.jobId);
    if (stateJobId) {
      this.jobId.set(stateJobId);
      this.loadJobApplicants(stateJobId);
      return;
    }

    // Priority 2: route params (from /company/job-offers/:id/applicants)
    this.route.params.pipe(take(1)).subscribe(params => {
      const routeJobId = this.toPositiveJobId(params['id']);
      if (routeJobId) {
        this.jobId.set(routeJobId);
        this.loadJobApplicants(routeJobId);
      } else {
        // Priority 3: query params
        this.route.queryParams.pipe(take(1)).subscribe(qp => {
          const queryJobId = this.toPositiveJobId(qp['jobId']);
          if (queryJobId) {
            this.jobId.set(queryJobId);
            this.loadJobApplicants(queryJobId);
          } else {
            this.loadAllApplicants();
          }
        });
      }
    });
  }

  private toPositiveJobId(value: unknown): string | null {
    const num = Number(value);
    return (Number.isFinite(num) && num > 0) ? String(num) : null;
  }

  loadSubscriptionStatus() {
    this.apiService.get<any>('company/subscription').subscribe({
      next: (res) => {
        if (!res?.success) { this.isSubscriptionInactive.set(true); return; }
        this.isSubscriptionInactive.set(!this.isSubscriptionActiveNow(res?.data?.active));
      },
      error: () => this.isSubscriptionInactive.set(true)
    });
  }

  loadCompanyAccessStatus() {
    this.apiService.get<any>('company/profile').subscribe({
      next: (res) => {
        this.isCompanyDeactivated.set(res?.success && res?.data?.user?.is_active === false);
      },
      error: () => { }
    });
  }

  private isSubscriptionActiveNow(activeSub: any): boolean {
    if (!activeSub) return false;
    const rawStatus = activeSub.status;
    const isStatusActive = typeof rawStatus === 'boolean' ? rawStatus : String(rawStatus ?? '').trim().toLowerCase() === 'active';
    if (!isStatusActive) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = this.parseDateAtLocalStart(activeSub.end_date);
    return !end || end >= today;
  }

  private parseDateAtLocalStart(value: any): Date | null {
    if (!value) return null;
    const normalized = String(value).split('T')[0];
    const [year, month, day] = normalized.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private mergeApplicantsWithRescoringState(serverData: any[]): any[] {
    const rescoringIds = this.rescoringApplicationIds();
    if (rescoringIds.size === 0) {
      return serverData;
    }

    const localById = new Map(this.applicants().map((app: any) => [app.id, app]));
    return serverData.map((serverApp: any) => {
      if (!rescoringIds.has(serverApp.id)) {
        return serverApp;
      }
      return localById.get(serverApp.id) || serverApp;
    });
  }

  loadJobApplicants(id: string) {
    console.log('[Applicants] Loading job applicants for:', id);
    this.apiService.get<any>(`company/job-offers/${id}/applicants`).subscribe({
      next: (res) => {
        console.log('[Applicants] Job response:', res?.success, 'count:', res?.data?.length);
        if (res.success) {
          // DEBUG: Log first applicant's manual quiz data
          const firstApp = res.data?.[0];
          if (firstApp) {
            console.log('[DEBUG] First applicant manual quiz:', {
              manual_quiz: firstApp.manual_quiz,
              manualQuiz: firstApp.manualQuiz,
              manual_quiz_score: firstApp.manual_quiz_score,
              manual_quiz_status: firstApp.manual_quiz_status,
              manual_quiz_completed_at: firstApp.manual_quiz_completed_at
            });
          }
          this.applicants.set(this.mergeApplicantsWithRescoringState(res.data || []));
        }
      }
    });
  }

  loadAllApplicants() {
    console.log('[Applicants] Loading all applicants');
    this.apiService.get<any>('company/applicants').subscribe({
      next: (res) => {
        console.log('[Applicants] All response:', res?.success, 'count:', res?.data?.length);
        if (res.success) {
          // DEBUG: Log first applicant's manual quiz data
          const firstApp = res.data?.[0];
          if (firstApp) {
            console.log('[DEBUG] First applicant manual quiz:', {
              manual_quiz: firstApp.manual_quiz,
              manualQuiz: firstApp.manualQuiz,
              manual_quiz_score: firstApp.manual_quiz_score,
              manual_quiz_status: firstApp.manual_quiz_status,
              manual_quiz_completed_at: firstApp.manual_quiz_completed_at
            });
          }
          this.applicants.set(this.mergeApplicantsWithRescoringState(res.data || []));
        }
      }
    });
  }

  refreshApplicants() {
    const jobId = this.jobId();
    if (jobId) {
      this.loadJobApplicants(jobId);
      return;
    }
    this.loadAllApplicants();
  }

  viewCandidate(app: any) { this.selectedApp.set(app); }
  closeModal() { this.selectedApp.set(null); }

  openCV(url: string | undefined) {
    if (url) {
      window.open(url, '_blank');
    } else {
      this.notificationService.error('CV not found for this candidate.');
    }
  }

  private normalizeQuizStatus(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeScore(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private manualQuizRecord(app: any): any {
    return app?.manual_quiz ?? app?.manualQuiz ?? null;
  }

  private hasManualQuizEvidence(app: any): boolean {
    const quiz = this.manualQuizRecord(app);
    return !!(quiz && (quiz.id || quiz.status || quiz.started_at || quiz.completed_at));
  }

  private hasAiQuizEvidence(app: any): boolean {
    return !!(app?.ai_quiz_session_id || app?.ai_quiz_completed_at);
  }

  hasPassedManualQuiz(app: any): boolean {
    if (!app) return false;
    // CRITICAL: Only consider passed if the quiz was actually completed
    if (!app?.manual_quiz_completed_at) return false;
    const status = this.normalizeQuizStatus(app.manual_quiz_status);
    if (status === 'passed') return true;
    if (status !== 'completed') return false;
    const score = this.normalizeScore(app.manual_quiz_score);
    return score !== null && score >= this.technicalPassScore;
  }

  hasPassedAiQuiz(app: any): boolean {
    if (!app) return false;
    if (!this.hasAiQuizEvidence(app)) return false;
    const status = this.normalizeQuizStatus(app.ai_quiz_status);
    if (status === 'passed') return true;
    if (status !== 'completed') return false;
    const score = this.normalizeScore(app.ai_quiz_score);
    return score !== null && score >= this.technicalPassScore;
  }

  hasPassedTechnicalQuiz(app: any): boolean {
    return this.hasPassedManualQuiz(app) || this.hasPassedAiQuiz(app);
  }

  getTechnicalScore(app: any): number | null {
    if (this.hasPassedManualQuiz(app)) {
      return this.normalizeScore(app?.manual_quiz_score);
    }
    if (this.hasPassedAiQuiz(app)) {
      return this.normalizeScore(app?.ai_quiz_score);
    }
    return null;
  }

  shouldShowTechnicalColumn(): boolean {
    return this.filteredApplicants().some((app) => this.hasPassedTechnicalQuiz(app));
  }

  openTechnicalReport(app: any) {
    if (!this.hasPassedTechnicalQuiz(app)) return;

    if (this.hasPassedManualQuiz(app)) {
      this.viewManualResults(app);
      return;
    }

    this.navigateToQuizWorkspace(app);
  }

  onTechnicalCellClick(event: Event, app: any) {
    event.stopPropagation();
    if (!this.hasPassedTechnicalQuiz(app)) return;
    this.openTechnicalReport(app);
  }

  private clearRescoreLoadingState(appId: number): void {
    this.rescoringApplicationIds.update(ids => {
      const next = new Set(ids);
      next.delete(appId);
      return next;
    });
    if (this.rescoringId() === appId) {
      this.rescoringId.set(null);
    }
  }

  private applyAiRescoreResult(appId: number, payload: any): void {
    const aiFields = {
      ai_error: payload?.ai_error ?? null,
      ai_match_score: payload?.ai_match_score ?? null,
      ai_degree_score: payload?.ai_degree_score ?? null,
      ai_semantic_score: payload?.ai_semantic_score ?? null,
      ai_skill_score: payload?.ai_skill_score ?? null,
      ai_experience_score: payload?.ai_experience_score ?? null,
      ai_confidence_score: payload?.ai_confidence_score ?? null,
      ai_explanation: payload?.ai_explanation ?? null,
      ai_scored_at: payload?.ai_scored_at ?? null
    };

    this.applicants.update(applications =>
      applications.map(a => (a.id === appId ? { ...a, ...aiFields } : a))
    );

    if (this.selectedApp()?.id === appId) {
      this.selectedApp.set({
        ...this.selectedApp(),
        ...aiFields
      });
    }
  }

  rescoreApplication(app: any) {
    if (!app?.id) {
      console.error('[Reparse AI] No app provided');
      return;
    }

    const appId = app.id;
    console.log('[Reparse AI] Starting for application:', appId);

    const originalScore = Number(app.ai_match_score);
    const hasOriginalScore = Number.isFinite(originalScore);
    const appSnapshot = { ...app };

    this.rescoringApplicationIds.update(ids => {
      const newIds = new Set(ids);
      newIds.add(appId);
      return newIds;
    });
    this.rescoringId.set(appId);

    this.applicants.update(applications => {
      return applications.map(a => {
        if (a.id === appId) {
          console.log('[Reparse AI] Clearing scores for app:', a.id);
          return {
            ...a,
            ai_error: null,
            ai_match_score: null,
            ai_degree_score: null,
            ai_semantic_score: null,
            ai_skill_score: null,
            ai_experience_score: null,
            ai_confidence_score: null,
            ai_explanation: null,
            ai_scored_at: null
          };
        }
        return a;
      });
    });

    if (this.selectedApp()?.id === appId) {
      this.selectedApp.set({
        ...this.selectedApp(),
        ai_error: null,
        ai_match_score: null,
        ai_degree_score: null,
        ai_semantic_score: null,
        ai_skill_score: null,
        ai_experience_score: null,
        ai_confidence_score: null,
        ai_explanation: null,
        ai_scored_at: null
      });
    }

    console.log('[Reparse AI] Calling API endpoint...');
    this.apiService.post<any>(`company/applications/${appId}/ai-rescore`, {}).subscribe({
      next: (res) => {
        console.log('[Reparse AI] API response:', res);
        if (!res?.success) {
          this.notificationService.error(res?.message || 'Failed to re-run AI scoring.');
          this.applyAiRescoreResult(appId, appSnapshot);
          this.clearRescoreLoadingState(appId);
          return;
        }

        const updatedScores = res?.data;
        if (updatedScores) {
          this.applyAiRescoreResult(appId, updatedScores);
        } else {
          // Keep a single HTTP refresh fallback if backend did not return score payload.
          this.refreshApplicants();
        }

        this.clearRescoreLoadingState(appId);

        const newScore = Number(updatedScores?.ai_match_score);
        const scoreStayedSame = hasOriginalScore && Number.isFinite(newScore) && Math.abs(newScore - originalScore) <= 0.001;

        if (updatedScores?.ai_error) {
          this.notificationService.error(updatedScores.ai_error);
        } else if (scoreStayedSame) {
          this.notificationService.info('AI rescoring completed. Match score remained the same.');
        } else {
          this.notificationService.success(res?.message || 'AI re-scoring completed.');
        }
      },
      error: (err) => {
        console.error('[Reparse AI] API error:', err);
        const message = err?.error?.message || err?.message || 'Failed to start AI re-scoring.';
        this.notificationService.error(message);

        this.applyAiRescoreResult(appId, appSnapshot);
        this.clearRescoreLoadingState(appId);
      }
    });
  }

  getScoreColor(score: number): string {
    if (score == null) return '#94a3b8';
    if (score >= 0.75) return '#10b981';
    if (score >= 0.55) return '#3b82f6';
    if (score >= 0.35) return '#f59e0b';
    return '#ef4444';
  }

  getScoreLabel(score: number): string {
    if (score == null) return 'N/A';
    if (score >= 0.75) return 'Optimal';
    if (score >= 0.55) return 'Qualified';
    if (score >= 0.35) return 'Average';
    return 'Weak';
  }

  // Helper for template calculations
  min(a: number, b: number): number {
    return Math.min(a || 0, b);
  }

  private normalizeStatusValue(status: string | null | undefined): string {
    return String(status || '').trim().toLowerCase();
  }

  getStatusDotColor(status: string): string {
    switch (this.normalizeStatusValue(status)) {
      case 'accepted':
      case 'hired':
        return 'bg-emerald-500';
      case 'rejected':
      case 'declined':
        return 'bg-rose-500';
      case 'interview':
      case 'interviewed':
      case 'shortlisted':
        return 'bg-violet-500';
      case 'pending':
        return 'bg-amber-400';
      default: return 'bg-slate-300';
    }
  }

  getStatusBgColor(status: string): string {
    switch (this.normalizeStatusValue(status)) {
      case 'accepted':
      case 'hired':
        return 'bg-emerald-500';
      case 'rejected':
      case 'declined':
        return 'bg-rose-500';
      case 'interview':
      case 'interviewed':
      case 'shortlisted':
        return 'bg-violet-500';
      case 'pending':
        return 'bg-amber-400';
      default: return 'bg-slate-400';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (this.normalizeStatusValue(status)) {
      case 'accepted':
      case 'hired':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'rejected':
      case 'declined':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'interview':
      case 'interviewed':
      case 'shortlisted':
        return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
      case 'pending':
        return 'bg-amber-400/20 text-amber-300 border-amber-400/30';
      default: return 'bg-slate-400/20 text-slate-300 border-slate-400/30';
    }
  }

  hasAnyInterview(app: any): boolean {
    return !!(app.interviews && app.interviews.length > 0);
  }

  startQuiz(app: any) {
    if (app?.ai_quiz_restricted) {
      this.notificationService.info('AI Assessments are not included in your current plan. Please upgrade to access this feature.');
      return;
    }
    // Reset config to defaults and open the modal
    this.quizDifficulty.set('mixed');
    this.quizNumQuestions.set(8);
    this.quizTimeLimit.set(null);
    this.quizLaunching.set(false);
    this.quizApp.set(app);
    // Close the candidate detail modal if open
    this.selectedApp.set(null);
  }

  getQuizStatus(app: any): string {
    return String(app?.ai_quiz_status || '').toLowerCase();
  }

  getQuizActionLabel(app: any): string {
    switch (this.getQuizStatus(app)) {
      case 'generating': return 'Generating';
      case 'review': return 'Review Quiz';
      case 'ready': return 'View Quiz';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Full Report';
      case 'failed': return 'Retry Quiz';
      default: return 'QUIZZ';
    }
  }

  getQuizActionClass(app: any): string {
    switch (this.getQuizStatus(app)) {
      case 'generating':
        return 'px-5 h-12 rounded-2xl bg-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest border border-slate-200 flex items-center gap-2';
      case 'review':
        return 'px-5 h-12 rounded-2xl bg-amber-50 text-amber-700 font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100 flex items-center gap-2';
      case 'ready':
      case 'in_progress':
        return 'px-5 h-12 rounded-2xl bg-sky-50 text-sky-700 font-black text-[10px] uppercase tracking-widest hover:bg-sky-100 transition-all border border-sky-100 flex items-center gap-2';
      case 'completed':
        return 'px-5 h-12 rounded-2xl bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center gap-2';
      case 'failed':
        return 'px-5 h-12 rounded-2xl bg-rose-50 text-rose-600 font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 flex items-center gap-2';
      default:
        return 'px-5 h-12 rounded-2xl bg-orange-50 text-orange-600 font-black text-[10px] uppercase tracking-widest hover:bg-orange-100 transition-all border border-orange-100 flex items-center gap-2';
    }
  }

  getQuizStatusChipClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'review':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'ready':
        return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'in_progress':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'failed':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  }

  getAssessmentScoreColor(score: number | null | undefined): string {
    const value = Number(score ?? 0);
    if (value >= 75) return '#059669';
    if (value >= 50) return '#2563eb';
    if (value >= 35) return '#d97706';
    return '#dc2626';
  }

  navigateToQuizWorkspace(app: any) {
    if (!app?.id) return;
    this.quizApp.set(null);
    this.quizInspectorApp.set(null);
    this.selectedApp.set(null);
    this.router.navigate(
      ['/company/applications', app.id, 'assessment'],
      { state: { application: app } }
    );
  }

  handleQuizAction(app: any) {
    const status = this.getQuizStatus(app);
    if (status === 'generating' || status === 'review' || status === 'ready' || status === 'in_progress' || status === 'completed') {
      this.navigateToQuizWorkspace(app);
      return;
    }
    this.startQuiz(app);
  }

  openQuizInspector(app: any, mode: 'review' | 'report') {
    this.quizInspectorApp.set(app);
    this.quizInspectorMode.set(mode);
    this.quizInspectorData.set(null);
    this.quizInspectorError.set(null);
    this.quizInspectorLoading.set(true);
    this.quizQuestionSavingId.set(null);
    this.quizQuestionRegeneratingId.set(null);
    this.quizReordering.set(false);
    this.draggedQuestionId.set(null);
    this.quizSending.set(false);
    this.quizApp.set(null);
    this.selectedApp.set(null);

    this.fetchQuizInspectorData();
  }

  fetchQuizInspectorData() {
    const app = this.quizInspectorApp();
    const mode = this.quizInspectorMode();
    if (!app) return;

    const endpoint = mode === 'report'
      ? `company/applications/${app.id}/quiz/report`
      : `company/applications/${app.id}/quiz`;

    this.apiService.get<any>(endpoint).subscribe({
      next: (res) => {
        this.quizInspectorLoading.set(false);
        this.quizInspectorData.set(res?.data ?? res);
      },
      error: (err) => {
        this.quizInspectorLoading.set(false);
        this.quizInspectorError.set(
          err?.error?.error || err?.error?.message || 'Failed to load quiz data.'
        );
      }
    });
  }

  closeQuizInspector() {
    if (this.quizSending() || this.quizQuestionSavingId() || this.quizQuestionRegeneratingId() || this.quizReordering()) return;
    this.quizInspectorApp.set(null);
    this.quizInspectorData.set(null);
    this.quizInspectorError.set(null);
    this.quizQuestionSavingId.set(null);
    this.quizQuestionRegeneratingId.set(null);
    this.quizReordering.set(false);
    this.draggedQuestionId.set(null);
    this.quizSending.set(false);
  }

  saveQuizQuestion(question: any) {
    const app = this.quizInspectorApp();
    if (!app || !question?.id || this.quizQuestionSavingId()) return;

    this.quizQuestionSavingId.set(String(question.id));
    this.apiService.patch<any>(`company/applications/${app.id}/quiz/questions/${question.id}`, {
      question_text: question.question_text,
      reference_answer: question.reference_answer,
      follow_up_hint: question.follow_up_hint,
      estimated_answer_length: question.estimated_answer_length,
      difficulty: question.difficulty,
    }).subscribe({
      next: (res) => {
        this.quizQuestionSavingId.set(null);
        const updated = res?.data?.question;
        if (updated && this.quizInspectorData()?.questions) {
          const nextQuestions = this.quizInspectorData().questions.map((item: any) =>
            item.id === updated.id ? { ...item, ...updated } : item
          );
          this.quizInspectorData.set({
            ...this.quizInspectorData(),
            questions: nextQuestions,
          });
        }
        this.notificationService.success('Question updated.');
      },
      error: (err) => {
        this.quizQuestionSavingId.set(null);
        const message = err?.error?.error || err?.error?.message || 'Failed to update question.';
        this.notificationService.error(message);
      }
    });
  }

  approveQuizQuestion(question: any) {
    const app = this.quizInspectorApp();
    if (!app || !question?.id || this.quizQuestionSavingId()) return;

    this.quizQuestionSavingId.set(String(question.id));
    this.apiService.patch<any>(`company/applications/${app.id}/quiz/questions/${question.id}`, {
      hr_approved: true,
    }).subscribe({
      next: (res) => {
        this.quizQuestionSavingId.set(null);
        const updated = res?.data?.question;
        if (updated && this.quizInspectorData()?.questions) {
          const nextQuestions = this.quizInspectorData().questions.map((item: any) =>
            item.id === updated.id ? { ...item, ...updated } : item
          );
          this.quizInspectorData.set({
            ...this.quizInspectorData(),
            questions: nextQuestions,
          });
        }
        this.notificationService.success('Question approved.');
      },
      error: (err) => {
        this.quizQuestionSavingId.set(null);
        const message = err?.error?.error || err?.error?.message || 'Failed to approve question.';
        this.notificationService.error(message);
      }
    });
  }

  regenerateQuizQuestion(question: any) {
    const app = this.quizInspectorApp();
    if (!app || !question?.id || this.quizQuestionRegeneratingId()) return;

    this.quizQuestionRegeneratingId.set(String(question.id));
    this.apiService.post<any>(`company/applications/${app.id}/quiz/questions/${question.id}/regenerate`, {}).subscribe({
      next: (res) => {
        this.quizQuestionRegeneratingId.set(null);
        this.notificationService.info(res?.message || `Regenerating question ${question.question_number}...`);
        this.quizInspectorLoading.set(true);
        setTimeout(() => this.fetchQuizInspectorData(), 1800);
      },
      error: (err) => {
        this.quizQuestionRegeneratingId.set(null);
        const message = err?.error?.error || err?.error?.message || 'Failed to regenerate question.';
        this.notificationService.error(message);
      }
    });
  }

  onQuestionDragStart(question: any) {
    this.draggedQuestionId.set(String(question?.id || ''));
  }

  onQuestionDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onQuestionDrop(targetQuestion: any) {
    const draggedId = this.draggedQuestionId();
    if (!draggedId || !targetQuestion?.id || draggedId === String(targetQuestion.id) || this.quizReordering()) {
      this.draggedQuestionId.set(null);
      return;
    }

    const current = this.quizInspectorData();
    const questions = [...(current?.questions || [])];
    const fromIndex = questions.findIndex((item: any) => String(item.id) === draggedId);
    const toIndex = questions.findIndex((item: any) => String(item.id) === String(targetQuestion.id));
    if (fromIndex === -1 || toIndex === -1) {
      this.draggedQuestionId.set(null);
      return;
    }

    const [moved] = questions.splice(fromIndex, 1);
    questions.splice(toIndex, 0, moved);
    const normalized = questions.map((item: any, index: number) => ({
      ...item,
      question_number: index + 1,
    }));

    this.quizInspectorData.set({
      ...current,
      questions: normalized,
    });
    this.draggedQuestionId.set(null);
    this.persistQuizOrder(normalized);
  }

  persistQuizOrder(questions: any[]) {
    const app = this.quizInspectorApp();
    if (!app || this.quizReordering()) return;

    this.quizReordering.set(true);
    this.apiService.post<any>(`company/applications/${app.id}/quiz/reorder`, {
      question_ids: questions.map((item: any) => item.id),
    }).subscribe({
      next: (res) => {
        this.quizReordering.set(false);
        const reordered = res?.data?.questions;
        if (reordered) {
          this.quizInspectorData.set({
            ...this.quizInspectorData(),
            questions: reordered,
          });
        }
        this.notificationService.success('Question order updated.');
      },
      error: (err) => {
        this.quizReordering.set(false);
        const message = err?.error?.error || err?.error?.message || 'Failed to reorder questions.';
        this.notificationService.error(message);
        this.fetchQuizInspectorData();
      }
    });
  }

  sendQuizToCandidate() {
    const app = this.quizInspectorApp();
    if (!app || this.quizSending()) return;

    this.quizSending.set(true);
    this.apiService.post<any>(`company/applications/${app.id}/quiz/send`, {}).subscribe({
      next: (res) => {
        this.quizSending.set(false);
        this.notificationService.success(res?.message || 'Quiz sent to candidate.');
        this.closeQuizInspector();
        this.refreshApplicants();
      },
      error: (err) => {
        this.quizSending.set(false);
        const message = err?.error?.error || err?.error?.message || 'Failed to send quiz.';
        this.notificationService.error(message);
      }
    });
  }

  closeQuizModal() {
    if (this.quizLaunching()) return;
    this.quizApp.set(null);
  }

  setQuizTimeLimit(value: string) {
    const n = parseInt(value, 10);
    this.quizTimeLimit.set(Number.isFinite(n) && n > 0 ? n : null);
  }

  getDifficultyActiveClass(d: string): string {
    switch (d) {
      case 'easy': return 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20';
      case 'medium': return 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20';
      case 'hard': return 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20';
      case 'mixed': return 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20';
      default: return 'bg-slate-800 text-white border-slate-800';
    }
  }

  launchQuiz() {
    const app = this.quizApp();
    if (!app || this.quizLaunching()) return;

    this.quizLaunching.set(true);

    const payload: any = {
      num_questions: this.quizNumQuestions(),
      difficulty: this.quizDifficulty(),
    };
    if (this.quizTimeLimit() !== null) {
      payload.time_limit = this.quizTimeLimit();
    }

    this.apiService.post<any>(`company/applications/${app.id}/start-quiz`, payload).subscribe({
      next: (res) => {
        this.quizLaunching.set(false);
        this.quizApp.set(null);
        const name = `${app.candidate?.first_name} ${app.candidate?.last_name}`;
        if (res?.message) {
          this.notificationService.success(res.message);
        } else {
          this.notificationService.success(`Assessment for ${name} is being generated.`);
        }
        this.navigateToQuizWorkspace({
          ...app,
          ai_quiz_status: res?.session?.status || 'generating',
        });
      },
      error: (err) => {
        this.quizLaunching.set(false);
        const msg = err?.error?.error || err?.error?.message || 'Failed to launch assessment. Please try again.';
        this.notificationService.error(msg);
      }
    });
  }

  isDecisionBlocked(app: any): boolean {
    return false; // Enable buttons at all times
  }

  ngOnDestroy() {}

  rejectCandidate(app: any) {
    if (!app) return;

    this.confirmRejectApp.set(null);
    this.rejectingId.set(app.id);

    this.apiService.post<any>(`company/applications/${app.id}/reject`, {}).subscribe({
      next: (res) => {
        this.rejectingId.set(null);
        if (res.success) {
          this.notificationService.success(
            `${app.candidate?.first_name} ${app.candidate?.last_name}'s application has been rejected. They have been notified.`
          );
          // Update local state
          const updated = this.applicants().map(a => {
            if (a.id === app.id) {
              return { ...a, status: 'rejected' };
            }
            return a;
          });
          this.applicants.set(updated);
          if (this.selectedApp()?.id === app.id) {
            this.selectedApp.set({ ...this.selectedApp(), status: 'rejected' });
          }
        } else {
          this.notificationService.error(res.message || 'Failed to reject application');
        }
      },
      error: (err) => {
        this.rejectingId.set(null);
        this.notificationService.error(err.error?.message || 'Failed to reject application');
      }
    });
  }

  acceptCandidate(app: any) {
    if (!app) return;

    this.acceptingId.set(app.id);

    this.apiService.post<any>(`company/applications/${app.id}/accept`, {}).subscribe({
      next: (res) => {
        this.acceptingId.set(null);
        if (res.success) {
          this.notificationService.success(
            `${app.candidate?.first_name} ${app.candidate?.last_name}'s application has been accepted. They have been notified.`
          );
          // Update local state
          const updated = this.applicants().map(a => {
            if (a.id === app.id) {
              return { ...a, status: 'accepted' };
            }
            return a;
          });
          this.applicants.set(updated);
          if (this.selectedApp()?.id === app.id) {
            this.selectedApp.set({ ...this.selectedApp(), status: 'accepted' });
          }
        } else {
          this.notificationService.error(res.message || 'Failed to accept application');
        }
      },
      error: (err) => {
        this.acceptingId.set(null);
        this.notificationService.error(err.error?.message || 'Failed to accept application');
      }
    });
  }

  openRejectModal(app: any) {
    this.confirmRejectApp.set(app);
  }

  private normalizeInterviewField(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private collectApplicationInterviews(app: any): any[] {
    const list: any[] = [];

    if (Array.isArray(app?.interviews)) {
      list.push(...app.interviews.filter(Boolean));
    }

    if (Array.isArray(app?.interview_list)) {
      list.push(...app.interview_list.filter(Boolean));
    }

    if (app?.interview) list.push(app.interview);
    if (app?.current_interview) list.push(app.current_interview);

    return list;
  }

  private isDecisionEligibleInterview(interview: any): boolean {
    const type = this.normalizeInterviewField(interview?.interview_type || interview?.type);
    const mode = this.normalizeInterviewField(interview?.interview_mode || interview?.mode);
    const scheduledAt = interview?.scheduled_at || interview?.scheduledAt;

    const allowedTypes = ['test_psychotechnique', 'test_rh_video', 'test_rh_telephonique'];
    const allowedModes = ['online', 'presentiel', 'in_person', 'onsite'];

    return !!scheduledAt && allowedTypes.includes(type) && allowedModes.includes(mode);
  }

  hasCompletedHrInterview(app: any): boolean {
    return this.collectApplicationInterviews(app).some((interview) => this.isDecisionEligibleInterview(interview));
  }

  canShowHrDecisionActions(app: any): boolean {
    const status = this.normalizeInterviewField(app?.status);
    if (status === 'accepted' || status === 'rejected') return false;
    return this.hasCompletedHrInterview(app);
  }

  navigateToSchedule(app: any) {
    this.router.navigate(['/company/schedule-interview'], {
      state: {
        applicationId: app.id,
        jobId: app.job_offer_id
      }
    });
  }
}
