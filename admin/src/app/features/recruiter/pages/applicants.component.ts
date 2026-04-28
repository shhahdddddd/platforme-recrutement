import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { computed } from '@angular/core';

@Component({
  selector: 'app-recruiter-applicants',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 pb-20 font-['Outfit']">
      <div class="max-w-[1300px] mx-auto px-6 py-12">
        
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 class="text-4xl font-black text-slate-900 tracking-tight mb-2">Applicants</h1>
            <p class="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Department applicants ranked by AI match score</p>
          </div>
          <div class="flex-1 max-w-md">
            <div class="relative group">
              <input 
                type="text" 
                [(ngModel)]="searchQuery"
                (input)="onSearchChange()"
                placeholder="Search by candidate name or email..." 
                class="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border border-slate-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold text-sm outline-none"
              >
              <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <select 
              (change)="onJobFilterChange($event)"
              [value]="selectedJobId() || ''"
              class="h-12 px-4 rounded-2xl bg-white border border-slate-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-xs uppercase tracking-widest outline-none"
            >
              <option value="">All Job Offers</option>
              <option *ngFor="let job of jobOffers()" [value]="job.id">{{ job.title }}</option>
            </select>
            <span class="px-4 h-12 flex items-center bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-2xl tracking-widest border border-blue-100">
              Total: {{ filteredApplicants().length }}
            </span>
          </div>
          <a routerLink="/recruiter/dashboard" class="h-12 px-6 rounded-2xl bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center gap-3">
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
             Dashboard
          </a>
        </div>

        <div class="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/30 border border-slate-100 overflow-hidden">
          <div class="overflow-x-auto hide-scrollbar">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50/40">
                  <th class="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Candidate</th>
                  <th class="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap text-center">AI Match Score</th>
                  <th class="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap text-center">Technical Result</th>
                  <th class="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Score Breakdown</th>
                  <th class="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Applied Date</th>
                  <th class="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-blue-600 whitespace-nowrap text-center">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr *ngFor="let app of filteredApplicants()" class="hover:bg-blue-50/30 transition-colors group">
                  <td class="px-6 py-5 cursor-pointer" (click)="viewCandidate(app)">
                    <div class="flex items-center gap-4">
                      <div class="relative shrink-0">
                         <div *ngIf="!app.candidate?.picture" class="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold text-base shadow-lg shadow-slate-900/20 uppercase">
                           {{ app.candidate?.first_name?.[0] }}{{ app.candidate?.last_name?.[0] }}
                         </div>
                         <img *ngIf="app.candidate?.picture" 
                              [src]="app.candidate.picture" 
                              class="w-11 h-11 rounded-xl object-cover shadow-lg shadow-slate-900/20" 
                              alt="Profile" />
                      </div>
                      <div>
                        <div class="font-black text-slate-900 group-hover:text-blue-600 transition-colors text-sm">
                          {{ app.candidate?.first_name }} {{ app.candidate?.last_name }}
                        </div>
                        <div class="text-xs text-slate-400 font-semibold">{{ app.candidate?.user?.email }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-5">
                    <ng-container *ngIf="app.ai_match_score != null; else noScore">
                      <div class="flex flex-col items-center gap-1.5 min-w-[80px]">
                        <div class="text-2xl font-black leading-none" [ngStyle]="{ color: getScoreColor(app.ai_match_score) }">
                          {{ (app.ai_match_score * 100) | number:'1.0-0' }}%
                        </div>
                        <span class="text-[9px] font-black uppercase tracking-widest" [ngStyle]="{ color: getScoreColor(app.ai_match_score) }">
                          Match Score
                        </span>
                      </div>
                    </ng-container>
                    <ng-template #noScore>
                      <div class="flex flex-col items-center gap-1 text-center">
                        <div *ngIf="app.ai_error; else pending" class="text-[10px] text-rose-500 font-bold">AI Error</div>
                        <ng-template #pending>
                          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Processing</div>
                        </ng-template>
                      </div>
                    </ng-template>
                  </td>

                  <td class="px-6 py-5">
                    <div class="flex flex-col items-center gap-2 min-w-[100px]">
                      <!-- Both quizzes completed -->
                      <ng-container *ngIf="hasFinishedManualQuiz(app) && hasFinishedAiQuiz(app); else singleQuiz">
                        <div class="flex flex-col items-center gap-1">
                          <div (click)="openTechnicalReport(app)" class="cursor-pointer group/score flex items-center gap-2">
                            <div class="text-xl font-black text-slate-900 group-hover/score:text-indigo-600 transition-colors">
                              {{ normalizeScore(app?.manual_quiz_score) | number:'1.0-0' }}%
                            </div>
                            <span class="text-[8px] font-black uppercase text-slate-400 tracking-widest">Manual</span>
                          </div>
                          <div (click)="openTechnicalReport(app)" class="cursor-pointer group/score flex items-center gap-2">
                            <div class="text-xl font-black text-violet-600 group-hover/score:text-violet-700 transition-colors">
                              {{ normalizeScore(app?.ai_quiz_score) | number:'1.0-0' }}%
                            </div>
                            <span class="text-[8px] font-black uppercase text-violet-400 tracking-widest">AI</span>
                          </div>
                        </div>
                      </ng-container>
                      <!-- Only one quiz completed -->
                      <ng-template #singleQuiz>
                        <ng-container *ngIf="getTechnicalScore(app) !== null; else techNotFinished">
                          <div (click)="onTechnicalCellClick($event, app)" class="cursor-pointer group/score flex flex-col items-center gap-1">
                            <div class="text-2xl font-black leading-none" [class]="hasFinishedAiQuiz(app) ? 'text-violet-600 group-hover/score:text-violet-700' : 'text-slate-900 group-hover/score:text-indigo-600'">
                              {{ getTechnicalScore(app) | number:'1.0-0' }}%
                            </div>
                            <span class="text-[9px] font-black uppercase tracking-widest" [class]="hasFinishedAiQuiz(app) ? 'text-violet-400 group-hover/score:text-violet-500' : 'text-slate-400 group-hover/score:text-indigo-400'">
                              {{ hasFinishedAiQuiz(app) ? 'AI Quiz' : 'Manual Quiz' }}
                            </span>
                          </div>
                        </ng-container>
                      </ng-template>
                      <!-- No quiz completed -->
                      <ng-template #techNotFinished>
                        <div *ngIf="isManualQuizInProgress(app) || isAiQuizInProgress(app)" class="px-3 py-1 rounded-lg bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-100">
                          In Progress
                        </div>
                        <div *ngIf="!isManualQuizInProgress(app) && !isAiQuizInProgress(app)" class="text-[10px] text-slate-400 font-bold">
                          Haven't taken quiz yet
                        </div>
                      </ng-template>
                    </div>
                  </td>

                  <td class="px-6 py-5">
                    <div *ngIf="app.ai_match_score != null; else noBreakdown" class="flex flex-col gap-1.5 min-w-[140px]">
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">Semantic</span>
                        <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div class="h-full rounded-full bg-violet-500 transition-all" [style.width]="((app.ai_semantic_score ?? 0) * 100) + '%'"></div>
                        </div>
                        <span class="text-[10px] font-black text-slate-600 w-8 text-right">{{ ((app.ai_semantic_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">Skills</span>
                        <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div class="h-full rounded-full bg-blue-500 transition-all" [style.width]="((app.ai_skill_score ?? 0) * 100) + '%'"></div>
                        </div>
                        <span class="text-[10px] font-black text-slate-600 w-8 text-right">{{ ((app.ai_skill_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">Exp.</span>
                        <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div class="h-full rounded-full bg-emerald-500 transition-all" [style.width]="((app.ai_experience_score ?? 0) * 100) + '%'"></div>
                        </div>
                        <span class="text-[10px] font-black text-slate-600 w-8 text-right">{{ ((app.ai_experience_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">Degree</span>
                        <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div class="h-full rounded-full bg-amber-500 transition-all" [style.width]="((app.ai_degree_score ?? 0) * 100) + '%'"></div>
                        </div>
                        <span class="text-[10px] font-black text-slate-600 w-8 text-right">{{ ((app.ai_degree_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                      </div>
                    </div>
                    <ng-template #noBreakdown>
                      <span class="text-[10px] text-slate-300 font-bold">-</span>
                    </ng-template>
                  </td>

                  <td class="px-6 py-5 whitespace-nowrap text-slate-500 font-medium text-sm">
                    {{ app.applied_at | date:'mediumDate' }}
                  </td>

                  <td class="px-6 py-5 text-center">
                    <div class="flex items-center justify-center gap-2 flex-nowrap whitespace-nowrap min-w-[380px]">
                      <button *ngIf="app.id" type="button" (click)="openCv($event, app)" class="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center hover:bg-violet-100 transition-all border border-violet-100 shadow-sm" title="View CV">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </button>

                      <button 
                        (click)="generateAiQuizz(app)" 
                        class="px-3 h-9 rounded-xl bg-orange-50 text-orange-600 font-black text-[10px] uppercase tracking-widest hover:bg-orange-100 transition-all border border-orange-100 shadow-sm"
                      >AI Quiz</button>

                      <button 
                        *ngIf="!isManualQuizInProgress(app)"
                        (click)="navigateToManualQuiz(app)"
                        class="px-3 h-9 rounded-xl bg-indigo-50 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 shadow-sm"
                      >Manual Quiz</button>
                      
                      <div *ngIf="isManualQuizInProgress(app)" class="px-2 h-9 rounded-xl bg-amber-50 text-amber-700 font-black text-[9px] flex items-center uppercase tracking-widest border border-amber-100">In Progress</div>

                      <button 
                        *ngIf="app.id && resolveActionState(app) !== 'accepted'"
                        (click)="confirmAcceptApp.set(app)" 
                        class="px-3 h-9 rounded-xl bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm ml-1"
                      >Accept</button>
                      
                      <button 
                        *ngIf="app.id && resolveActionState(app) !== 'accepted'"
                        (click)="confirmRejectApp.set(app)" 
                        class="px-3 h-9 rounded-xl bg-rose-50 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 hover:text-rose-600 transition-all border border-rose-100 shadow-sm"
                      >Reject</button>

                      <div
                        *ngIf="resolveActionState(app) === 'accepted'"
                        class="px-3 h-9 rounded-xl bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest border border-emerald-100 flex items-center"
                      >Hired</div>
                    </div>
                  </td>
                </tr>

                <!-- Empty State -->
                <tr *ngIf="filteredApplicants().length === 0">
                  <td colspan="5" class="px-8 py-20 text-center">
                    <div class="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <h3 class="text-xl font-black text-slate-900 mb-2">No applications found</h3>
                    <p class="text-slate-500 font-medium">As soon as candidates apply to your department offers, they will appear here.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Candidate Profile Modal (Premium Design) -->
      <div *ngIf="selectedApp()" class="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 overflow-hidden">
        <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-all duration-500" (click)="closeModal()"></div>
        
        <div class="bg-white sm:rounded-[2.5rem] shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden flex flex-col h-full sm:h-[85vh] animate-in zoom-in-95 duration-300">
            
            <!-- Dynamic Header Background -->
            <div class="absolute top-0 left-0 w-full h-48 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 opacity-90">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] flex items-center justify-center pointer-events-none">
                    <div class="w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                </div>
            </div>

            <!-- Modal Header -->
            <div class="relative px-8 pt-10 pb-6 flex items-start justify-between shrink-0">
                <div class="flex items-center gap-8">
                    <div class="relative group">
                        <div class="absolute -inset-1 bg-white/20 rounded-[2rem] blur group-hover:blur-md transition-all"></div>
                        <div *ngIf="!selectedApp()?.candidate?.picture" class="relative w-28 h-28 rounded-[2rem] bg-white text-indigo-700 flex items-center justify-center font-black text-4xl shadow-2xl uppercase">
                            {{ selectedApp()?.candidate?.first_name?.[0] }}{{ selectedApp()?.candidate?.last_name?.[0] }}
                        </div>
                        <img *ngIf="selectedApp()?.candidate?.picture" 
                             [src]="selectedApp().candidate.picture" 
                             class="relative w-28 h-28 rounded-[2rem] object-cover shadow-2xl border-4 border-white/20" 
                             alt="Profile" />
                        <div *ngIf="selectedApp()?.candidate?.user?.is_online" class="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full shadow-lg"></div>
                    </div>
                    <div class="pt-2">
                        <div class="flex items-center gap-3">
                            <h2 class="text-4xl font-black text-white tracking-tight drop-shadow-sm">{{ selectedApp()?.candidate?.first_name }} {{ selectedApp()?.candidate?.last_name }}</h2>
                            <span class="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-white text-[10px] font-black uppercase tracking-[0.2em] border border-white/30">
                                {{ selectedApp()?.status || 'Pending' }}
                            </span>
                        </div>
                        <div class="flex flex-wrap items-center gap-4 mt-3">
                            <span class="text-indigo-100 text-sm font-bold flex items-center gap-1.5 bg-indigo-900/40 px-3 py-1.5 rounded-xl border border-white/10">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                                {{ selectedApp()?.candidate?.university || 'University' }}
                            </span>
                            <span class="text-indigo-100 text-sm font-bold flex items-center gap-1.5 bg-indigo-900/40 px-3 py-1.5 rounded-xl border border-white/10">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                {{ selectedApp()?.candidate?.location || 'Remote' }}
                            </span>
                        </div>
                    </div>
                </div>
                <button (click)="closeModal()" class="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white flex items-center justify-center transition-all border border-white/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>

            <!-- Profile Tabs -->
            <div class="relative px-8 flex gap-10 border-b border-slate-100 shrink-0 bg-white shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
                <button 
                  (click)="activeTab.set('profile')"
                  class="py-5 text-[11px] font-black uppercase tracking-widest transition-all relative group"
                  [ngClass]="activeTab() === 'profile' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'"
                >
                  Profile Overview
                  <div *ngIf="activeTab() === 'profile'" class="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full shadow-[0_-4px_10px_rgba(79,70,229,0.3)]"></div>
                </button>
                <button 
                  (click)="activeTab.set('ai')"
                  class="py-5 text-[11px] font-black uppercase tracking-widest transition-all relative group flex items-center gap-2"
                  [ngClass]="activeTab() === 'ai' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'"
                >
                  AI Match Report
                  <span *ngIf="selectedApp()?.ai_match_score" class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  <div *ngIf="activeTab() === 'ai'" class="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full shadow-[0_-4px_10px_rgba(79,70,229,0.3)]"></div>
                </button>
                <button 
                  (click)="activeTab.set('technical')"
                  class="py-5 text-[11px] font-black uppercase tracking-widest transition-all relative group"
                  [ngClass]="activeTab() === 'technical' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'"
                >
                  Technical Assessment
                  <div *ngIf="activeTab() === 'technical'" class="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full shadow-[0_-4px_10px_rgba(79,70,229,0.3)]"></div>
                </button>
            </div>

            <!-- Modal Content Area -->
            <div class="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
                <!-- Profile Tab Content -->
                <div *ngIf="activeTab() === 'profile'" class="p-8 space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- Contact Details -->
                        <div class="space-y-4">
                            <h3 class="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                Contact Information
                            </h3>
                            <div class="grid grid-cols-1 gap-3">
                                <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-indigo-100 transition-colors">
                                    <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                    </div>
                                    <div>
                                        <div class="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Direct Email</div>
                                        <div class="font-bold text-slate-900 break-all">{{ selectedApp()?.candidate?.user?.email }}</div>
                                    </div>
                                </div>
                                <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-emerald-100 transition-colors">
                                    <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                    </div>
                                    <div>
                                        <div class="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Mobile Line</div>
                                        <div class="font-bold text-slate-900">{{ selectedApp()?.candidate?.phone || 'Not provided' }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Education Summary -->
                        <div class="space-y-4">
                            <h3 class="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                Education Background
                            </h3>
                            <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div class="flex items-start gap-4">
                                    <div class="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                                    </div>
                                    <div class="flex-1">
                                        <div class="font-black text-slate-950 text-lg leading-tight">{{ selectedApp()?.candidate?.university }}</div>
                                        <div class="text-indigo-600 font-bold text-sm mt-1 uppercase tracking-wide">{{ selectedApp()?.candidate?.diploma }}</div>
                                        <div class="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded-lg mt-3 uppercase tracking-widest">
                                            {{ selectedApp()?.candidate?.start_year }} - {{ selectedApp()?.candidate?.end_year || 'Present' }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Bio Section -->
                    <div *ngIf="selectedApp()?.candidate?.bio" class="space-y-4">
                        <h3 class="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <div class="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            Professional Biography
                        </h3>
                        <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm leading-relaxed text-slate-600 font-medium italic relative overflow-hidden">
                            <div class="absolute top-0 left-0 w-1 h-full bg-indigo-600 opacity-20"></div>
                            <svg class="absolute top-4 right-4 text-slate-100" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017V14H15.017C13.9124 14 13.017 13.1046 13.017 12V6C13.017 4.89543 13.9124 4 15.017 4H21.017C22.1216 4 23.017 4.89543 23.017 6V12C23.017 14.3912 21.9121 16.5161 20.1989 17.9181L21.017 21H14.017ZM1.01705 21L1.01705 18C1.01705 16.8954 1.91248 16 3.01705 16H6.01705V14H2.01705C0.912484 14 0.0170517 13.1046 0.0170517 12V6C0.0170517 4.89543 0.912484 4 2.01705 4H8.01705C9.12162 4 10.0171 4.89543 10.0171 6V12C10.0171 14.3912 8.91218 16.5161 7.19894 17.9181L8.01705 21H1.01705Z"></path></svg>
                            "{{ selectedApp()?.candidate?.bio }}"
                        </div>
                    </div>

                    <!-- Skills Cloud -->
                    <div *ngIf="selectedApp()?.candidate?.skills?.length" class="space-y-6 pb-10">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                Verified Expertise & Tech Stack
                            </h3>
                            <span class="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                {{ selectedApp()?.candidate?.skills?.length }} Skills
                            </span>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <div *ngFor="let skill of selectedApp()?.candidate?.skills" 
                                 class="px-5 py-2.5 rounded-2xl bg-white border border-slate-100 text-slate-700 font-black text-xs shadow-sm shadow-slate-200/40 hover:scale-105 hover:shadow-md hover:border-indigo-200 hover:text-indigo-700 transition-all cursor-default flex items-center gap-2 group">
                                <div class="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-indigo-500 transition-colors"></div>
                                {{ skill.name }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- AI Analysis Tab Content -->
                <div *ngIf="activeTab() === 'ai'" class="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    
                    <!-- Premium AI Matching Dashboard -->
                    <div *ngIf="selectedApp()?.ai_match_score != null" class="space-y-8">
                        <div class="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-[80px] -mr-32 -mt-32 opacity-60"></div>
                            
                            <div class="relative flex flex-col md:flex-row items-center gap-10">
                                <!-- Big Matching Radial -->
                                <div class="relative w-48 h-48 flex items-center justify-center shrink-0">
                                    <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle class="text-slate-100" stroke-width="8" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50"></circle>
                                        <circle [ngStyle]="{ color: getScoreColor(selectedApp()?.ai_match_score) }" 
                                                stroke-width="8" 
                                                [attr.stroke-dasharray]="(selectedApp()?.ai_match_score * 251.2) + ', 251.2'" 
                                                stroke-linecap="round" 
                                                stroke="currentColor" 
                                                fill="transparent" 
                                                r="40" cx="50" cy="50"
                                                class="transition-all duration-1000 ease-out"></circle>
                                    </svg>
                                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                                        <div class="text-5xl font-black tracking-tighter" [ngStyle]="{ color: getScoreColor(selectedApp()?.ai_match_score) }">
                                            {{ ((selectedApp()?.ai_match_score ?? 0) * 100) | number:'1.0-0' }}%
                                        </div>
                                        <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Match Potential</div>
                                    </div>
                                </div>

                                <div class="flex-1 space-y-6">
                                    <div>
                                        <div class="flex items-center justify-between mb-2">
                                            <h3 class="text-2xl font-black text-slate-900 tracking-tight">AI Matching Insight</h3>
                                            <button 
                                                (click)="rescoreAi(selectedApp())"
                                                class="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 flex items-center justify-center transition-all border border-slate-100"
                                                title="Re-run analysis"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                                            </button>
                                        </div>
                                        <p class="text-slate-500 font-medium leading-relaxed">Our AI parsed the candidate's CV against the job requirements. This score reflects semantic similarity, technical skill match, and relevant experience density.</p>
                                    </div>

                                    <!-- Score Progress Bars -->
                                    <div class="grid grid-cols-1 gap-4">
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                                <span class="text-violet-600">Semantic Relevance</span>
                                                <span class="text-slate-900">{{ ((selectedApp()?.ai_semantic_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                                            </div>
                                            <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div class="h-full bg-violet-500 relative transition-all duration-1000 ease-out" [style.width]="((selectedApp()?.ai_semantic_score ?? 0) * 100) + '%'">
                                                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-shimmer"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                                <span class="text-blue-600">Technical Skills Match</span>
                                                <span class="text-slate-900">{{ ((selectedApp()?.ai_skill_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                                            </div>
                                            <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div class="h-full bg-blue-500 relative transition-all duration-1000 ease-out" [style.width]="((selectedApp()?.ai_skill_score ?? 0) * 100) + '%'">
                                                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-shimmer"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                                <span class="text-emerald-600">Experience Density</span>
                                                <span class="text-slate-900">{{ ((selectedApp()?.ai_experience_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                                            </div>
                                            <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div class="h-full bg-emerald-500 relative transition-all duration-1000 ease-out" [style.width]="((selectedApp()?.ai_experience_score ?? 0) * 100) + '%'">
                                                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-shimmer"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="space-y-1.5">
                                            <div class="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                                <span class="text-amber-600">Education Background Match</span>
                                                <span class="text-slate-900">{{ ((selectedApp()?.ai_degree_score ?? 0) * 100) | number:'1.0-0' }}%</span>
                                            </div>
                                            <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div class="h-full bg-amber-500 relative transition-all duration-1000 ease-out" [style.width]="((selectedApp()?.ai_degree_score ?? 0) * 100) + '%'">
                                                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-shimmer"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- AI Narrative Summary -->
                        <div *ngIf="selectedApp()?.ai_explanation?.summary" class="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                           <div class="absolute top-0 right-0 p-8 text-white/10 group-hover:scale-110 transition-transform">
                               <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                           </div>
                           <h3 class="text-white/60 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Executive AI Summary</h3>
                           <p class="relative z-10 text-xl font-bold leading-relaxed tracking-tight">"{{ selectedApp()?.ai_explanation?.summary }}"</p>
                           <div class="mt-8 flex items-center gap-2 text-white/80">
                               <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                               </div>
                               <span class="text-xs font-black uppercase tracking-widest">Calculated by recruitment-intelligence-v3</span>
                           </div>
                        </div>
                    </div>

                    <!-- AI Processing Section -->
                    <div *ngIf="selectedApp()?.ai_match_score == null && !selectedApp()?.ai_error" class="rounded-[3rem] border border-dashed border-indigo-200 bg-white py-20 px-10 text-center flex flex-col items-center">
                        <div class="relative w-20 h-20 mb-8">
                            <div class="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-20"></div>
                            <div class="relative w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100">
                                <svg class="animate-spin text-indigo-600" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
                            </div>
                        </div>
                        <h4 class="text-2xl font-black text-slate-900 tracking-tight mb-2">AI Agent is Analyzing...</h4>
                        <p class="text-slate-500 font-medium max-w-xs leading-relaxed">Our advanced neural matching agent is currently parsing the CV and cross-referencing industry skills.</p>
                        <div class="mt-8 flex gap-2">
                            <div class="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                            <div class="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                            <div class="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        </div>
                    </div>

                    <div *ngIf="selectedApp()?.ai_match_score == null && selectedApp()?.ai_error" class="rounded-[2.5rem] bg-rose-50 border border-rose-100 p-10 text-center">
                        <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        </div>
                        <h4 class="text-xl font-black text-rose-900 mb-2">Analysis Interrupted</h4>
                        <p class="text-rose-700 font-medium mb-8">{{ selectedApp()?.ai_error }}</p>
                        <button 
                            (click)="rescoreAi(selectedApp())"
                            [disabled]="rescoringId() === selectedApp()?.id"
                            class="px-8 py-4 rounded-2xl bg-rose-600 text-white font-black text-sm uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all disabled:opacity-50"
                        >
                            Retry Analysis
                        </button>
                    </div>
                </div>

                <!-- Technical Assessment Tab Content -->
                <div *ngIf="activeTab() === 'technical'" class="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    
                    <!-- Scoring Summary - Both Quizzes -->
                    <div *ngIf="hasFinishedManualQuiz(selectedApp()) && hasFinishedAiQuiz(selectedApp())" class="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/50">
                        <div class="flex flex-col md:flex-row items-center gap-10">
                            <div class="flex gap-4">
                                <div class="w-36 h-36 rounded-[2rem] bg-slate-900 text-white flex flex-col items-center justify-center shrink-0 shadow-2xl">
                                    <span class="text-3xl font-black">{{ normalizeScore(selectedApp()?.manual_quiz_score) | number:'1.0-0' }}%</span>
                                    <span class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">Manual Quiz</span>
                                </div>
                                <div class="w-36 h-36 rounded-[2rem] bg-violet-600 text-white flex flex-col items-center justify-center shrink-0 shadow-2xl">
                                    <span class="text-3xl font-black">{{ normalizeScore(selectedApp()?.ai_quiz_score) | number:'1.0-0' }}%</span>
                                    <span class="text-[9px] font-black uppercase tracking-[0.2em] text-violet-200 mt-1">AI Quiz</span>
                                </div>
                            </div>
                            <div class="flex-1">
                                <h3 class="text-2xl font-black text-slate-900 tracking-tight mb-2">Technical Assessment Complete</h3>
                                <p class="text-slate-500 font-medium leading-relaxed">The candidate has completed both technical assessments. Review their detailed responses to gauge proficiency across different evaluation methods.</p>
                                <div class="flex gap-3 mt-6">
                                    <button 
                                        (click)="viewManualResults(selectedApp())"
                                        class="flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all"
                                    >
                                        Review Manual Report
                                    </button>
                                    <button 
                                        (click)="viewAiResults(selectedApp())"
                                        class="flex items-center gap-3 px-6 py-3 rounded-2xl bg-violet-600 text-white font-black text-xs uppercase tracking-widest hover:bg-violet-700 shadow-xl shadow-violet-100 transition-all"
                                    >
                                        Review AI Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Scoring Summary - Single Quiz -->
                    <div *ngIf="getTechnicalScore(selectedApp()) !== null && !(hasFinishedManualQuiz(selectedApp()) && hasFinishedAiQuiz(selectedApp()))" class="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/50">
                        <div class="flex flex-col md:flex-row items-center gap-10">
                            <div class="w-40 h-40 rounded-[2.5rem] bg-slate-900 text-white flex flex-col items-center justify-center shrink-0 shadow-2xl" [class.bg-violet-600]="hasFinishedAiQuiz(selectedApp())">
                                <span class="text-4xl font-black">{{ getTechnicalScore(selectedApp()) | number:'1.0-0' }}%</span>
                                <span class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1" [class.text-violet-200]="hasFinishedAiQuiz(selectedApp())">{{ hasFinishedAiQuiz(selectedApp()) ? 'AI Quiz Result' : 'Manual Quiz Result' }}</span>
                            </div>
                            <div class="flex-1">
                                <h3 class="text-2xl font-black text-slate-900 tracking-tight mb-2">Technical Assessment Outcome</h3>
                                <p class="text-slate-500 font-medium leading-relaxed">The candidate has completed their {{ hasFinishedAiQuiz(selectedApp()) ? 'AI-generated' : 'manual' }} technical evaluation. You can review their detailed response breakdown and technical explanations to gauge their proficiency level.</p>
                                <button 
                                    (click)="openTechnicalReport(selectedApp())"
                                    class="mt-6 flex items-center gap-3 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    Review Full Audit Report
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- No Results State -->
                    <div *ngIf="getTechnicalScore(selectedApp()) === null" class="rounded-[2.5rem] bg-white border border-slate-100 p-12 text-center flex flex-col items-center">
                        <div class="w-24 h-24 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-8 border border-slate-100">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        </div>
                        <h4 class="text-xl font-black text-slate-900 mb-2">No Technical Results Yet</h4>
                        <p class="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed mb-10">This candidate hasn't completed their technical quiz or is currently in the middle of an assessment session.</p>
                        
                        <div class="flex flex-wrap justify-center gap-4">
                            <button 
                                (click)="generateAiQuizz(selectedApp())"
                                class="px-8 py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
                            >Generate AI Quiz</button>
                            <button 
                                *ngIf="!isManualQuizInProgress(selectedApp())"
                                (click)="navigateToManualQuiz(selectedApp())"
                                class="px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >Schedule Manual Test</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Action Footer -->
            <div class="p-8 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                <button (click)="closeModal()" class="px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Dismiss</button>
                <div class="flex items-center gap-4">
                    <button 
                        *ngIf="selectedApp()?.id && resolveActionState(selectedApp()) !== 'accepted'"
                        (click)="confirmRejectApp.set(selectedApp())" 
                        class="px-8 py-4 rounded-2xl bg-rose-50 text-rose-600 font-black text-[11px] uppercase tracking-widest border border-rose-100 hover:bg-rose-100 transition-all"
                    >Reject Applicant</button>
                    <button 
                        *ngIf="selectedApp()?.id && resolveActionState(selectedApp()) !== 'accepted'"
                        (click)="confirmAcceptApp.set(selectedApp())" 
                        class="px-8 py-4 rounded-2xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all"
                    >Accept Applicant</button>
                    <div *ngIf="resolveActionState(selectedApp()) === 'accepted'" class="px-8 py-4 rounded-2xl bg-emerald-50 text-emerald-600 font-black text-[11px] uppercase tracking-widest border border-emerald-100">Hired</div>
                    <div *ngIf="selectedApp()?.status === 'rejected'" class="px-8 py-4 rounded-2xl bg-rose-50 text-rose-600 font-black text-[11px] uppercase tracking-widest border border-rose-100">Application Archived</div>
                </div>
            </div>
        </div>
      </div>

      <!-- Accept Confirmation Modal -->
      <div *ngIf="confirmAcceptApp()" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="confirmAcceptApp.set(null)"></div>
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
          <div class="p-8 text-center">
            <div class="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><circle cx="12" cy="12" r="10"/><path d="M8 12.5 10.5 15 16 9.5"/></svg>
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-2">Accept Application?</h3>
            <p class="text-slate-500 text-sm font-medium leading-relaxed">
              Accept <strong class="text-slate-700">{{ confirmAcceptApp()?.candidate?.first_name }} {{ confirmAcceptApp()?.candidate?.last_name }}</strong>'s application for <strong class="text-slate-700">{{ confirmAcceptApp()?.job_offer?.title }}</strong>?
            </p>
            <p class="text-slate-400 text-xs font-bold mt-3">
              The candidate will be notified immediately.
            </p>
          </div>
          <div class="px-8 pb-8 flex gap-3">
            <button 
              (click)="confirmAcceptApp.set(null)" 
              class="flex-1 h-12 rounded-2xl font-black text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
            >Cancel</button>
            <button 
              (click)="acceptCandidate(confirmAcceptApp())" 
              class="flex-1 h-12 rounded-2xl font-black text-sm text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
            >Yes, Accept</button>
          </div>
        </div>
      </div>

      <!-- Reject Confirmation Modal -->
      <div *ngIf="confirmRejectApp()" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
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
              class="flex-1 h-12 rounded-2xl font-black text-sm text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/30 transition-all disabled:opacity-50"
            >Yes, Reject</button>
          </div>
        </div>
      </div>

      <!-- Manual Quiz Results Modal (Recruiter) -->
      <div *ngIf="manualResultsApp()" class="fixed inset-0 z-[5000] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" (click)="manualResultsApp.set(null)"></div>
        <div id="print-area" class="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in slide-in-from-bottom-8 duration-500">
           
           <div class="px-10 py-10 bg-white flex items-center justify-between border-b border-slate-50 shrink-0">
              <div class="flex items-center gap-6">
                 <div class="w-16 h-16 rounded-[1.5rem] bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-indigo-600/20">
                    {{ manualResultsData()?.score | number:'1.0-0' }}%
                 </div>
                 <div>
                    <h2 class="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Technical Assessment Audit</h2>
                    <p class="text-xs text-slate-400 font-bold uppercase tracking-widest">Candidate performance evaluation report</p>
                 </div>
              </div>
              <div class="flex items-center gap-3">
                 <button (click)="manualResultsApp.set(null)" class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all border border-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                 </button>
              </div>
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

                             <div *ngIf="q.explanation" class="px-6 py-4 rounded-[1.5rem] bg-indigo-50/30 border border-indigo-50">
                                <span class="text-[9px] font-black uppercase text-indigo-400 tracking-widest block mb-2">Audit Insight</span>
                                <p class="text-xs font-semibold text-slate-600 leading-relaxed italic">{{ q.explanation }}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <!-- AI Quiz Configuration Modal -->
      <div *ngIf="aiQuizConfigApp()" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="closeAiQuizConfig()"></div>
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
          <div class="p-8">
            <div class="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-2 text-center">Configure AI Quiz</h3>
            <p class="text-slate-500 text-sm font-medium leading-relaxed text-center mb-6">
              Set the number of questions for <strong class="text-slate-700">{{ aiQuizConfigApp()?.candidate?.first_name }} {{ aiQuizConfigApp()?.candidate?.last_name }}</strong>'s AI assessment.
            </p>

            <div class="mb-6">
              <label class="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Number of Questions (Max 6)</label>
              <div class="flex items-center gap-4">
                <input
                  type="range"
                  min="3"
                  max="6"
                  step="1"
                  [value]="aiQuizNumQuestions()"
                  (input)="aiQuizNumQuestions.set(+($any($event).target.value))"
                  class="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <span class="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 font-black text-lg flex items-center justify-center border border-orange-100">
                  {{ aiQuizNumQuestions() }}
                </span>
              </div>
              <div class="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1">
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
              </div>
            </div>

            <div class="bg-slate-50 rounded-2xl p-4 mb-6">
              <div class="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><path d="M12 16v-4"/><path d="M12 8h.01"/><circle cx="12" cy="12" r="10"/></svg>
                <p class="text-xs text-slate-500 font-medium">The RAG system will generate questions based on the job description and company knowledge base.</p>
              </div>
            </div>
          </div>

          <div class="flex gap-3 p-6 bg-slate-50 border-t border-slate-100">
            <button
              (click)="closeAiQuizConfig()"
              class="flex-1 h-12 rounded-2xl font-black text-sm text-slate-600 bg-white hover:bg-slate-100 transition-all border border-slate-200"
            >Cancel</button>
            <button
              (click)="confirmAiQuizGeneration()"
              class="flex-1 h-12 rounded-2xl font-black text-sm text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30 transition-all"
            >Generate Quiz</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .hide-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .hide-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgb(226, 232, 240);
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgb(203, 213, 225);
    }
    @keyframes shimmer {
      0% { transform: translateX(-100%) skewX(-12deg); }
      100% { transform: translateX(200%) skewX(-12deg); }
    }
    .animate-shimmer {
      animation: shimmer 2s infinite linear;
    }
  `]
})
export class RecruiterApplicantsComponent implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);

  applicants = signal<any[]>([]);
  jobOffers = signal<any[]>([]);
  selectedJobId = signal<string | null>(null);
  searchQuery = '';
  selectedApp = signal<any>(null);
  activeTab = signal<'profile' | 'ai' | 'technical'>('profile');
  confirmAcceptApp = signal<any>(null);
  confirmRejectApp = signal<any>(null);
  acceptingId = signal<number | null>(null);
  rejectingId = signal<number | null>(null);
  rescoringId = signal<number | null>(null);
  currentUser = computed(() => this.authService.getCurrentUser() as any);

  // Manual Quiz Results state
  manualResultsApp = signal<any>(null);
  manualResultsData = signal<any>(null);
  loadingManualResults = signal(false);

  // AI Quiz Configuration
  aiQuizConfigApp = signal<any>(null);
  aiQuizNumQuestions = signal<number>(6);
  filteredApplicants = computed(() => {
    let list = this.applicants();

    if (this.selectedJobId()) {
      list = list.filter(a => String(a.job_offer_id) === String(this.selectedJobId()));
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(a =>
        a.candidate?.first_name?.toLowerCase().includes(q) ||
        a.candidate?.last_name?.toLowerCase().includes(q) ||
        a.candidate?.user?.email?.toLowerCase().includes(q)
      );
    }

    return list;
  });

  // Signal that recomputes when filteredApplicants changes
  showTechnicalColumn = computed(() => {
    const applicants = this.filteredApplicants();
    if (!applicants || applicants.length === 0) return false;
    return applicants.some(app => this.hasFinishedAnyQuiz(app));
  });
  ngOnInit(): void {
    this.loadJobOffers();

    const stateJobId = window.history.state?.jobId;
    if (stateJobId) {
      this.selectedJobId.set(stateJobId);
      this.loadAllApplicants();
    } else {
      this.route.params.subscribe(params => {
        if (params['id']) {
          this.selectedJobId.set(params['id']);
        }
        this.loadAllApplicants();
      });
    }
  }

  onJobFilterChange(event: any): void {
    this.selectedJobId.set(event.target.value || null);
  }

  onSearchChange(): void {
    // Computed property handles search automatically
  }

  private loadJobOffers(): void {
    this.apiService.get<any>('company/job-offers').subscribe({
      next: (res) => {
        if (res.success) this.jobOffers.set(res.data || []);
      }
    });
  }

  private loadAllApplicants(): void {
    this.apiService.get<any>('company/applicants').subscribe({
      next: (res) => {
        if (res.success) this.applicants.set(res.data || []);
      }
    });
  }

  // ─── Utility normalizers ────────────────────────────────────────────────────

  private normalizeQuizStatus(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  normalizeScore(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private toPositiveNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  private normalizeEmail(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private manualQuizRecord(app: any): any {
    return app?.manual_quiz ?? app?.manualQuiz ?? null;
  }

  /**
   * Convert any value to a flat array of objects.
   * Handles: real arrays, Laravel Collection objects ({"0":{...},"1":{...}}),
   * single objects, and null/undefined.
   */
  private toFlatArray(val: any): any[] {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'object' && val.constructor === Object) {
      // Laravel Collection serialized as {"0": {...}, "1": {...}}
      return Object.values(val).filter((v: any) => v && typeof v === 'object');
    }
    return [];
  }

  // ─── Interview collection ────────────────────────────────────────────────────

  private collectInterviews(app: any): any[] {
    const collected: any[] = [];
    if (!app) return collected;

    const sources = [
      app.interviews,
      app.interview_list,
      app.interviewList,
      app.candidate?.interviews,
      app.candidate?.interview_list,
      app.job_offer?.interviews,
      app.jobOffer?.interviews
    ];

    for (const source of sources) {
      // Restore compatibility with Laravel's object-based collections
      const asArray = this.toFlatArray(source);
      if (asArray.length > 0) {
        collected.push(...asArray);
      }
    }

    if (app.interview) collected.push(app.interview);
    if (app.current_interview) collected.push(app.current_interview);
    if (app.candidate?.interview) collected.push(app.candidate.interview);

    // Flat payload fallback — only when an explicit interview_type field exists
    const typeAlias = app.interview_type || app.interviewType;
    const modeAlias = app.interview_mode || app.interviewMode;
    if (typeAlias) {
      collected.push({
        interview_type: typeAlias,
        interview_mode: modeAlias,
        recruiter_id: app.interview_recruiter_id || app.recruiter_id,
        scheduled_at: app.interview_scheduled_at || app.scheduled_at || app.interview_launched_at,
        status: app.interview_status || app.status
      });
    }

    return collected;
  }

  private currentRecruiterId(): number | null {
    const currentUser = this.currentUser();
    const directIds = [
      this.toPositiveNumber(currentUser?.profile?.id),
      this.toPositiveNumber(currentUser?.profile?.recruiter_id),
      this.toPositiveNumber(currentUser?.recruiter?.id),
      this.toPositiveNumber((currentUser as any)?.recruiter_id),
    ];

    for (const id of directIds) {
      if (id) return id;
    }

    return null;
  }

  private assignedInterviewForCurrentRecruiter(app: any): any | null {
    const recruiterId = this.currentRecruiterId();
    if (!recruiterId) return null;

    const interviews = this.collectInterviews(app).filter((item: any) => {
      const assignedRecruiterId = this.toPositiveNumber(
        item?.recruiter_id || item?.interview_recruiter_id || item?.recruiter?.id
      );

      return assignedRecruiterId === recruiterId;
    });

    if (!interviews.length) return null;

    interviews.sort((a: any, b: any) => {
      const left = new Date(a?.scheduled_at || a?.created_at || 0).getTime();
      const right = new Date(b?.scheduled_at || b?.created_at || 0).getTime();
      return right - left;
    });

    return interviews[0] ?? null;
  }

  private normalizeInterviewField(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
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
    const interview = this.assignedInterviewForCurrentRecruiter(app);
    return !!interview && this.isDecisionEligibleInterview(interview);
  }

  /**
   * Returns true only when interview_type is one of the known technical identifiers.
   * Mode is intentionally NOT required — both online and in-person technical
   * interviews should trigger the quiz flow.
   */
  private isTechnicalInterviewRecord(interview: any): boolean {
    const type = String(interview?.interview_type || interview?.type || '').trim().toLowerCase();
    const technicalTypes = ['test_technique', 'technical', 'technique', 'tech', 'technical_test'];
    return technicalTypes.includes(type);
  }

  // ─── Technical interview detection ──────────────────────────────────────────

  /**
   * Returns true when the applicant has a real technical interview record
   * OR when a quiz has already been started/completed (meaning the phase was
   * previously triggered). The raw-JSON scan has been intentionally removed
   * to prevent false positives from job description text.
   */
  hasTechnicalOnlineInterview(app: any): boolean {
    const interviews = this.collectInterviews(app);
    if (interviews.some(i => this.isTechnicalInterviewRecord(i))) return true;

    // Quiz already started or completed → we're in the technical phase
    const manualQuiz = this.manualQuizRecord(app);
    const manualStatus = this.normalizeQuizStatus(app?.manual_quiz_status || manualQuiz?.status);
    if (manualStatus && manualStatus !== 'none' && manualStatus !== '') return true;

    const aiStatus = this.normalizeQuizStatus(app?.ai_quiz_status);
    if (aiStatus && aiStatus !== 'none' && aiStatus !== '') return true;

    return false;
  }

  getTechnicalInterview(app: any): any {
    const currentUser = this.currentUser();
    const currentUserId = this.toPositiveNumber(currentUser?.id);
    const currentUserEmail = this.normalizeEmail(currentUser?.email);
    const candidateRecruiterIds = new Set<number>();
    const candidateRecruiterUserIds = new Set<number>();

    const directIds = [
      this.toPositiveNumber(currentUser?.profile?.id),
      this.toPositiveNumber(currentUser?.profile?.recruiter_id),
      this.toPositiveNumber(currentUser?.recruiter?.id),
      this.toPositiveNumber((currentUser as any)?.recruiter_id),
    ];
    for (const id of directIds) {
      if (id) candidateRecruiterIds.add(id);
    }

    const directUserIds = [
      this.toPositiveNumber(currentUser?.profile?.user_id),
      this.toPositiveNumber(currentUser?.recruiter?.user_id),
      currentUserId,
    ];
    for (const id of directUserIds) {
      if (id) candidateRecruiterUserIds.add(id);
    }

    const jobRecruiters = app?.job_offer?.recruiters || app?.jobOffer?.recruiters;
    if (Array.isArray(jobRecruiters)) {
      for (const recruiter of jobRecruiters) {
        const recruiterUserId = this.toPositiveNumber(recruiter?.user_id || recruiter?.user?.id);
        const recruiterId = this.toPositiveNumber(recruiter?.id);
        const recruiterEmail = this.normalizeEmail(recruiter?.user?.email);
        const sameUser = !!(currentUserId && recruiterUserId && recruiterUserId === currentUserId);
        const sameEmail = !!(currentUserEmail && recruiterEmail && recruiterEmail === currentUserEmail);
        if ((sameUser || sameEmail) && recruiterId) candidateRecruiterIds.add(recruiterId);
        if (recruiterUserId && (sameUser || sameEmail)) candidateRecruiterUserIds.add(recruiterUserId);
      }
    }

    const isScoped =
      candidateRecruiterIds.size > 0 ||
      candidateRecruiterUserIds.size > 0 ||
      !!currentUserId ||
      !!currentUserEmail;

    const interviews = this.collectInterviews(app);
    const technicalRecords = interviews.filter((item: any) => this.isTechnicalInterviewRecord(item));
    if (!technicalRecords.length) return null;

    technicalRecords.sort((a: any, b: any) => {
      const left = new Date(a?.scheduled_at || a?.created_at || 0).getTime();
      const right = new Date(b?.scheduled_at || b?.created_at || 0).getTime();
      return right - left;
    });

    if (!isScoped) return technicalRecords[0];

    const scopedTechnical = technicalRecords.filter((item: any) => {
      const assignedRecruiterId = this.toPositiveNumber(
        item?.recruiter_id || item?.interview_recruiter_id || item?.recruiter?.id
      );
      if (assignedRecruiterId && candidateRecruiterIds.has(assignedRecruiterId)) return true;
      if (assignedRecruiterId && candidateRecruiterUserIds.has(assignedRecruiterId)) return true;

      const assignedRecruiterUserId = this.toPositiveNumber(
        item?.recruiter?.user_id || item?.recruiter?.user?.id
      );
      if (assignedRecruiterUserId && candidateRecruiterUserIds.has(assignedRecruiterUserId)) return true;

      const assignedRecruiterEmail = this.normalizeEmail(item?.recruiter?.user?.email);
      if (currentUserEmail && assignedRecruiterEmail && assignedRecruiterEmail === currentUserEmail) return true;

      return false;
    });

    return scopedTechnical.length ? scopedTechnical[0] : technicalRecords[0];
  }

  // ─── Quiz state helpers ──────────────────────────────────────────────────────

  isManualQuizInProgress(app: any): boolean {
    const status = this.normalizeQuizStatus(app?.manual_quiz_status || this.manualQuizRecord(app)?.status);
    return ['ready', 'in_progress'].includes(status);
  }

  isAiQuizInProgress(app: any): boolean {
    const status = this.normalizeQuizStatus(app?.ai_quiz_status);
    return ['ready', 'in_progress', 'generating'].includes(status);
  }

  hasFinishedManualQuiz(app: any): boolean {
    const status = this.normalizeQuizStatus(app?.manual_quiz_status || this.manualQuizRecord(app)?.status);
    // Only consider finished if status explicitly indicates completion
    if (['completed', 'passed', 'failed', 'done', 'submitted'].includes(status)) return true;
    // Check for completion timestamp as backup
    return !!(app?.manual_quiz_completed_at || this.manualQuizRecord(app)?.completed_at);
  }

  hasFinishedAiQuiz(app: any): boolean {
    const status = this.normalizeQuizStatus(app?.ai_quiz_status);
    // Only consider finished if status explicitly indicates completion
    if (['completed', 'passed', 'failed', 'done', 'submitted'].includes(status)) return true;
    // Check for completion timestamp as backup
    return !!app?.ai_quiz_completed_at;
  }

  hasFinishedAnyQuiz(app: any): boolean {
    const manualStatus = this.normalizeQuizStatus(app?.manual_quiz_status || this.manualQuizRecord(app)?.status);
    const aiStatus = this.normalizeQuizStatus(app?.ai_quiz_status);

    // Strict completion checks - only status or timestamp, not just score existence
    const isManualFinished = ['completed', 'passed', 'failed', 'done', 'submitted'].includes(manualStatus) ||
                             !!(app?.manual_quiz_completed_at || this.manualQuizRecord(app)?.completed_at);
    const isAiFinished = ['completed', 'passed', 'failed', 'done', 'submitted'].includes(aiStatus) ||
                         !!app?.ai_quiz_completed_at;

    return isManualFinished || isAiFinished;
  }

  hasVisibleTechnicalResult(app: any): boolean {
    return this.hasTechnicalOnlineInterview(app) && this.hasFinishedAnyQuiz(app);
  }

  hasTechnicalScore(app: any): boolean {
    return this.getTechnicalScore(app) !== null;
  }

  getTechnicalScore(app: any): number | null {
    if (this.hasFinishedManualQuiz(app)) {
      const s = this.normalizeScore(app?.manual_quiz_score);
      if (s !== null) return s;
    }
    if (this.hasFinishedAiQuiz(app)) {
      const s = this.normalizeScore(app?.ai_quiz_score);
      if (s !== null) return s;
    }
    return null;
  }


  // ─── Action state resolver ───────────────────────────────────────────────────

  /**
   * Terminal states (accepted / rejected) always take priority.
   * Then check for a real technical interview record.
   * Falls back to pending otherwise.
   */
  resolveActionState(app: any): string {
    const status = this.normalizeQuizStatus(app?.status);

    if (status === 'accepted') return 'accepted';
    if (status === 'rejected') return 'rejected';

    if (this.hasTechnicalOnlineInterview(app)) return 'interview';

    return status || 'pending';
  }

  // ─── Navigation & actions ────────────────────────────────────────────────────

  navigateToManualQuiz(app: any): void {
    const interview = this.getTechnicalInterview(app);
    this.router.navigate(['/recruiter/assessment-setup'], {
      state: { applicationId: app.id, duration: interview?.duration_minutes }
    });
  }

  viewCandidate(app: any): void {
    this.selectedApp.set(app);
  }

  closeModal(): void {
    this.selectedApp.set(null);
  }

  openCv(event: Event, app: any): void {
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

  rescoreAi(app: any): void {
    if (!app) return;
    this.rescoringId.set(app.id);
    this.notificationService.info('Re-triggering AI parsing agent...');
    
    this.apiService.post<any>(`company/applications/${app.id}/ai-rescore`, {}).subscribe({
      next: (res) => {
        this.rescoringId.set(null);
        if (res.success) {
          this.notificationService.success('AI re-scoring queued successfully!');
          // Refresh data
          this.loadAllApplicants();
          // Update modal local state to show "Processing"
          if (this.selectedApp()?.id === app.id) {
            this.selectedApp.set({ ...this.selectedApp(), ai_match_score: null, ai_error: null });
          }
        } else {
          this.notificationService.error(res.message || 'Failed to trigger re-scoring');
        }
      },
      error: (err) => {
        this.rescoringId.set(null);
        this.notificationService.error(err.error?.message || 'Error communicating with AI service');
      }
    });
  }

  generateAiQuizz(app: any): void {
    if (!app) return;
    // Open configuration modal
    this.aiQuizConfigApp.set(app);
    this.aiQuizNumQuestions.set(6); // Default to 6
  }

  confirmAiQuizGeneration(): void {
    const app = this.aiQuizConfigApp();
    if (!app) return;

    this.notificationService.info('Generating AI Quiz questions based on JD...');
    this.apiService.post<any>(`company/applications/${app.id}/start-ai-quiz`, {
      num_questions: this.aiQuizNumQuestions()
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success('AI Quiz generation started!');
          this.aiQuizConfigApp.set(null);
          // Navigate to the assessment workspace
          this.router.navigate(['/recruiter/applications', app.id, 'assessment']);
        } else {
          this.notificationService.error(res.message || 'Failed to generate quiz');
        }
      },
      error: (err) => {
        this.notificationService.error(err.error?.error || err.error?.message || 'Error triggering AI agent');
      }
    });
  }

  closeAiQuizConfig(): void {
    this.aiQuizConfigApp.set(null);
  }

  openTechnicalReport(app: any): void {
    if (!this.hasVisibleTechnicalResult(app)) return;
    if (this.hasFinishedManualQuiz(app)) {
      this.viewManualResults(app);
      return;
    }
    if (this.hasFinishedAiQuiz(app)) {
      this.router.navigate(['/company/applications', app.id, 'assessment']);
    }
  }

  onTechnicalCellClick(event: Event, app: any): void {
    event.stopPropagation();
    if (!this.hasVisibleTechnicalResult(app)) return;
    this.openTechnicalReport(app);
  }

  viewManualResults(app: any): void {
    if (!app) return;
    this.manualResultsApp.set(app);
    this.loadingManualResults.set(true);
    this.notificationService.info('Fetching candidate report...');
    this.apiService.get<any>(`company/applications/${app.id}/manual-quiz/results`).subscribe({
      next: (res) => {
        this.loadingManualResults.set(false);
        if (res.success) this.manualResultsData.set(res.data);
      },
      error: (err) => {
        this.loadingManualResults.set(false);
        const message = err?.error?.message || err?.error?.error || err?.message || 'Could not load technical results.';
        this.notificationService.error(message);
        this.manualResultsApp.set(null);
      }
    });
  }

  viewAiResults(app: any): void {
    if (!app) return;
    this.router.navigate(['/company/applications', app.id, 'assessment']);
  }

  getAnswerForQuestion(questionId: number): any {
    const question = this.manualResultsData()?.quiz?.questions?.find((q: any) => q.id === questionId);
    return question?.answer || null;
  }

  acceptCandidate(app: any): void {
    if (!app) return;
    this.confirmAcceptApp.set(null);
    this.acceptingId.set(app.id);

    this.apiService.post<any>(`company/applications/${app.id}/accept`, {}).subscribe({
      next: (res) => {
        this.acceptingId.set(null);
        if (res.success) {
          this.notificationService.success(
            `${app.candidate?.first_name} ${app.candidate?.last_name}'s application has been accepted.`
          );
          this.applicants.set(
            this.applicants().map(a => a.id === app.id ? { ...a, status: 'accepted' } : a)
          );
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

  rejectCandidate(app: any): void {
    if (!app) return;
    this.confirmRejectApp.set(null);
    this.rejectingId.set(app.id);

    this.apiService.post<any>(`company/applications/${app.id}/reject`, {}).subscribe({
      next: (res) => {
        this.rejectingId.set(null);
        if (res.success) {
          this.notificationService.success(
            `${app.candidate?.first_name} ${app.candidate?.last_name}'s application has been rejected.`
          );
          this.applicants.set(
            this.applicants().map(a => a.id === app.id ? { ...a, status: 'rejected' } : a)
          );
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

  getScoreColor(score: number): string {
    if (score == null) return '#94a3b8';
    if (score >= 0.75) return '#10b981';
    if (score >= 0.55) return '#3b82f6';
    if (score >= 0.35) return '#f59e0b';
    return '#ef4444';
  }
}
