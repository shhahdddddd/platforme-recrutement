import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-quiz-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#f8fafc] pb-20 font-['Outfit']">
      <div class="max-w-[1400px] mx-auto px-6 py-12">
        <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 mb-10">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-sky-50 text-sky-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-sky-100">
              Assessment Workspace
            </div>
            <h1 class="text-4xl font-black text-slate-900 tracking-tight leading-none">
              {{ candidateName() }}
            </h1>
            <p class="text-slate-500 font-semibold mt-3 max-w-3xl text-sm sm:text-base">
              {{ jobTitle() }} | Live generation, review, editing, and final delivery.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <span
              *ngIf="sessionStatus()"
              [class]="'px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest ' + getQuizStatusChipClass(sessionStatus())"
            >
              {{ sessionStatus() }}
            </span>
            <span
              *ngIf="autoRefreshActive()"
              class="px-4 py-3 rounded-2xl border border-sky-100 bg-sky-50 text-sky-700 text-[10px] font-black uppercase tracking-widest"
            >
              Auto Refreshing
            </span>
            <a
              [routerLink]="backLink()"
              class="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xs shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-3 border border-slate-100 uppercase tracking-widest"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Applicants
            </a>
            <button
              (click)="loadWorkspace()"
              class="h-12 px-4 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
              title="Refresh workspace data"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              Refresh
            </button>

            <!-- Send to Candidate Button (Top) -->
            <button
              *ngIf="(sessionStatus() === 'review' || sessionStatus() === 'ready') && !quizAlreadySent()"
              (click)="sendQuizToCandidate()"
              [disabled]="quizSending() || questionSavingId() || questionRegeneratingId() || quizReordering()"
              class="h-12 px-6 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-60 shadow-xl shadow-emerald-500/20 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              {{ quizSending() ? 'Sending...' : (sessionStatus() === 'ready' ? 'Resend to Candidate' : 'Send to Candidate') }}
            </button>
          </div>
        </div>

        <div *ngIf="loading()" class="py-32 text-center">
          <div class="w-14 h-14 border-4 border-slate-100 border-t-sky-500 rounded-full animate-spin mx-auto"></div>
          <p class="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-5">Loading workspace</p>
        </div>

        <div *ngIf="!loading() && error()" class="p-6 rounded-3xl bg-rose-50 border border-rose-100 text-rose-700 font-bold text-sm">
          {{ error() }}
        </div>

        <ng-container *ngIf="!loading() && !error() && session() as currentSession">
          <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Questions</div>
              <div class="text-3xl font-black text-slate-900">
                {{ progress()?.questions_generated || questions().length || 0 }}/{{ currentSession.num_questions || 0 }}
              </div>
            </div>
            <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Difficulty</div>
              <div class="text-3xl font-black text-slate-900">{{ currentSession.difficulty_setting || 'mixed' }}</div>
            </div>
            <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Time Limit</div>
              <div class="text-3xl font-black text-slate-900">{{ currentSession.time_limit || 'None' }}</div>
            </div>
            <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Candidate State</div>
              <div class="text-3xl font-black text-slate-900">{{ currentSession.status }}</div>
            </div>
          </div>

          <div
            *ngIf="sessionStatus() === 'generating'"
            class="mb-8 p-6 rounded-[2rem] bg-gradient-to-r from-sky-50 to-white border border-sky-100 text-slate-700"
          >
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div class="text-[10px] font-black uppercase tracking-widest text-sky-600 mb-2">RAG In Progress</div>
                <p class="text-sm font-semibold leading-7">
                  This page refreshes automatically while the pipeline generates questions. New cards appear here as soon as each question is stored.
                </p>
              </div>
              <div class="px-5 py-4 rounded-2xl bg-white border border-sky-100 text-center min-w-[180px]">
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Generated So Far</div>
                <div class="text-3xl font-black text-sky-700">
                  {{ progress()?.questions_generated || questions().length || 0 }}
                </div>
              </div>
            </div>
          </div>

          <div
            *ngIf="sessionStatus() === 'failed'"
            class="mb-8 p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-700"
          >
            <div class="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-2">Generation Failed</div>
            <p class="text-sm font-semibold leading-7">
              {{ sessionError() || 'The assessment stopped before all questions were generated. Relaunch it from the applicants list after checking the AI worker logs.' }}
            </p>
          </div>

          <div *ngIf="questions().length || pendingSlots().length" class="space-y-6">
            <div
              *ngFor="let question of questions(); trackBy: trackByQuestionId"
              class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm"
              [attr.draggable]="sessionStatus() === 'review'"
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
                      *ngIf="question.generation_mode === 'job_description_fallback'"
                      class="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest border border-amber-100"
                    >
                      Job Description Fallback
                    </span>
                    <span
                      *ngIf="sessionStatus() === 'review'"
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

              <div class="space-y-5">

                <!-- Question text -->
                <div>
                  <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Question Text</label>
                  <textarea
                    [(ngModel)]="question.question_text"
                    [readonly]="sessionStatus() !== 'review'"
                    rows="3"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:bg-white resize-y"
                  ></textarea>
                </div>

                <!-- MCQ Choices (A–D) -->
                <div *ngIf="question.choices_labeled?.length">
                  <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Answer Choices</label>
                  <div class="grid sm:grid-cols-2 gap-3">
                    <div
                      *ngFor="let choice of question.choices_labeled"
                      class="flex items-start gap-3 p-4 rounded-2xl border-2 transition-all relative group"
                      [ngClass]="choice.label === question.correct_choice
                        ? 'border-emerald-300 bg-emerald-50'
                        : (sessionStatus() === 'review' ? 'border-slate-100 bg-white hover:border-sky-200' : 'border-slate-100 bg-slate-50')"
                    >
                      <!-- Label badge (clickable to set as correct in review mode) -->
                      <button
                        *ngIf="sessionStatus() === 'review'"
                        (click)="question.correct_choice = choice.label"
                        title="Set as correct answer"
                        class="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all"
                        [ngClass]="choice.label === question.correct_choice
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-110'
                          : 'bg-slate-100 text-slate-400 hover:bg-sky-100 hover:text-sky-600'"
                      >{{ choice.label }}</button>
                      
                      <span
                        *ngIf="sessionStatus() !== 'review'"
                        class="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black"
                        [ngClass]="choice.label === question.correct_choice
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-600'"
                      >{{ choice.label }}</span>

                      <!-- Choice text (editable in review mode) -->
                      <div class="flex-1">
                        <input
                          *ngIf="sessionStatus() === 'review'"
                          [(ngModel)]="choice.text"
                          class="w-full bg-transparent border-none outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-300"
                          placeholder="Enter choice text..."
                        />
                        <span *ngIf="sessionStatus() !== 'review'" class="text-sm font-semibold text-slate-800 leading-6 pt-0.5 flex-1">{{ choice.text }}</span>
                      </div>

                      <!-- Correct tick -->
                      <svg
                        *ngIf="choice.label === question.correct_choice"
                        class="flex-shrink-0 w-5 h-5 text-emerald-500 mt-0.5"
                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
                      ><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </div>
                </div>

                <!-- No choices yet (old question or still generating) -->
                <div
                  *ngIf="!question.choices_labeled?.length"
                  class="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 text-sm font-semibold text-center"
                >
                  Choices not yet available — regenerate to get MCQ format.
                </div>

                <!-- Explanation (correct answer rationale) — HR edit -->
                <div *ngIf="question.explanation || sessionStatus() === 'review'">
                  <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Explanation / Rationale</label>
                  <textarea
                    *ngIf="sessionStatus() === 'review'"
                    [(ngModel)]="question.explanation"
                    rows="2"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:bg-white resize-y"
                    placeholder="Provide reasoning for the correct answer..."
                  ></textarea>
                  <p *ngIf="sessionStatus() !== 'review' && question.explanation" class="text-sm font-semibold text-slate-700 leading-7 bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3">
                    {{ question.explanation }}
                  </p>
                </div>

                <!-- Bottom row: follow-up hint + difficulty -->
                <div class="grid md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Follow-up Hint</label>
                    <input
                      [(ngModel)]="question.follow_up_hint"
                      [readonly]="sessionStatus() !== 'review'"
                      class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Difficulty</label>
                    <select
                      [(ngModel)]="question.difficulty"
                      [disabled]="sessionStatus() !== 'review'"
                      class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-300 focus:bg-white"
                    >
                      <option value="easy">easy</option>
                      <option value="medium">medium</option>
                      <option value="hard">hard</option>
                    </select>
                  </div>
                </div>

                <!-- Action buttons (review mode only) -->
                <div *ngIf="sessionStatus() === 'review' || sessionStatus() === 'ready'" class="flex flex-wrap justify-end gap-3 pt-1">
                  <button
                    (click)="approveQuizQuestion(question)"
                    [disabled]="questionSavingId() === question.id"
                    class="h-12 px-6 rounded-2xl bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 disabled:opacity-60"
                  >
                    {{ questionSavingId() === question.id && !question.hr_approved ? 'Saving...' : (question.hr_approved ? 'Approved ✓' : 'Approve As-Is') }}
                  </button>
                  <button
                    type="button"
                    (click)="onRegenerateClick(question)"
                    [disabled]="questionRegeneratingId() === question.id || sessionStatus() === 'ready'"
                    class="h-12 px-6 rounded-2xl bg-amber-50 text-amber-700 font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100 disabled:opacity-60"
                  >
                    {{ questionRegeneratingId() === question.id ? 'Regenerating...' : (sessionStatus() === 'ready' ? 'Already Sent' : 'Regenerate') }}
                  </button>
                  <button
                    (click)="deleteQuizQuestion(question)"
                    [disabled]="deletingQuestionId() === question.id"
                    class="h-12 px-6 rounded-2xl bg-rose-50 text-rose-600 font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 disabled:opacity-60"
                  >
                    {{ deletingQuestionId() === question.id ? 'Deleting...' : 'Delete Question' }}
                  </button>
                  <button
                    (click)="saveQuizQuestion(question)"
                    [disabled]="questionSavingId() === question.id"
                    class="h-12 px-6 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all disabled:opacity-60"
                  >
                    {{ questionSavingId() === question.id ? 'Saving...' : 'Save Question' }}
                  </button>
                </div>
              </div>
            </div>

            <div
              *ngFor="let slot of pendingSlots()"
              class="p-6 rounded-[2rem] border border-dashed border-sky-200 bg-sky-50/50"
            >
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 border-4 border-sky-100 border-t-sky-500 rounded-full animate-spin"></div>
                <div>
                  <div class="text-[10px] font-black uppercase tracking-widest text-sky-600 mb-1">Generating</div>
                  <div class="text-sm font-black text-slate-900">Question {{ slot }}</div>
                  <p class="text-sm font-semibold text-slate-500 mt-1">The RAG pipeline is still working on this slot.</p>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="report()" class="mt-10 space-y-8">
            <div class="grid md:grid-cols-3 gap-4">
              <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Overall Score</div>
                <div class="text-4xl font-black" [ngStyle]="{'color': getAssessmentScoreColor(report()?.total_score)}">
                  {{ report()?.total_score | number:'1.0-0' }}%
                </div>
              </div>
              <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Questions Scored</div>
                <div class="text-4xl font-black text-slate-900">{{ reportProgress()?.answers_scored || 0 }}/{{ reportSession()?.num_questions || 0 }}</div>
              </div>
              <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Session Status</div>
                <div class="text-3xl font-black text-slate-900">{{ reportSession()?.status }}</div>
              </div>
            </div>

            <div class="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Narrative Summary</div>
              <p class="text-sm font-semibold text-slate-700 leading-7">{{ report()?.narrative_summary }}</p>
            </div>

            <div class="space-y-6">
              <div *ngFor="let item of report()?.question_reports || []" class="p-8 rounded-[2.5rem] border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                <!-- Header: Question + Score -->
                <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-3">
                      <span class="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                        Question {{ item.question_number }}
                      </span>
                      <span class="px-3 py-1 rounded-full bg-sky-50 text-sky-600 text-[10px] font-black uppercase tracking-widest border border-sky-100">
                        {{ item.focus_area }}
                      </span>
                    </div>
                    <h3 class="text-xl font-black text-slate-900 leading-tight">{{ item.question_text }}</h3>
                  </div>
                  <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center min-w-[120px]">
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Score</div>
                    <div class="text-3xl font-black" [ngStyle]="{'color': getAssessmentScoreColor(item.score)}">
                      {{ item.score | number:'1.0-0' }}%
                    </div>
                  </div>
                </div>

                <!-- MCQ Detail (if choices exist) -->
                <div *ngIf="item.choices?.length" class="mb-8">
                  <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Assessment Analysis</label>
                  <div class="grid sm:grid-cols-2 gap-4">
                    <div
                      *ngFor="let choiceText of item.choices; let i = index"
                      class="flex items-start gap-4 p-5 rounded-2xl border-2 transition-all"
                      [ngClass]="{
                        'border-emerald-500 bg-emerald-50': (['A','B','C','D'][i] === item.correct_choice),
                        'border-rose-500 bg-rose-50': (['A','B','C','D'][i] === item.selected_choice && item.selected_choice !== item.correct_choice),
                        'border-slate-100 bg-slate-50 opacity-60': (['A','B','C','D'][i] !== item.correct_choice && (item.selected_choice === null || ['A','B','C','D'][i] !== item.selected_choice))
                      }"
                    >
                      <!-- Label -->
                      <span
                        class="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black"
                        [ngClass]="{
                          'bg-emerald-500 text-white': (['A','B','C','D'][i] === item.correct_choice),
                          'bg-rose-500 text-white': (['A','B','C','D'][i] === item.selected_choice && item.selected_choice !== item.correct_choice),
                          'bg-slate-200 text-slate-500': (['A','B','C','D'][i] !== item.correct_choice && ['A','B','C','D'][i] !== item.selected_choice)
                        }"
                      >
                        {{ ['A','B','C','D'][i] }}
                      </span>
                      
                      <div class="flex-1 pt-0.5">
                        <div class="text-sm font-bold text-slate-800 leading-relaxed">{{ choiceText }}</div>
                        <div class="mt-2 flex items-center gap-2">
                          <span *ngIf="['A','B','C','D'][i] === item.correct_choice" class="text-[9px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                             Correct Answer
                          </span>
                          <span *ngIf="['A','B','C','D'][i] === item.selected_choice" class="text-[9px] font-black uppercase tracking-wider text-slate-500 italic">
                             Candidate Selection
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Rationale / Explanation -->
                <div class="space-y-4">
                  <div *ngIf="item.explanation" class="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">AI Rationale</div>
                    <p class="text-sm font-semibold text-slate-700 leading-7">
                      {{ item.explanation }}
                    </p>
                  </div>
                  
                  <div *ngIf="!item.choices?.length" class="grid lg:grid-cols-2 gap-4">
                    <div class="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                      <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Candidate Answer</div>
                      <p class="font-semibold text-slate-700 leading-6">{{ item.answer_text || 'No answer submitted.' }}</p>
                    </div>
                    <div class="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                      <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Scoring Reasoning</div>
                      <p class="font-semibold text-slate-700 leading-6">{{ item.reasoning || 'No reasoning available.' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            *ngIf="(sessionStatus() === 'review' || sessionStatus() === 'ready') && !quizAlreadySent()"
            class="mt-10 px-10 py-8 rounded-[2rem] bg-white border border-slate-100 shadow-sm flex items-center justify-end gap-3"
          >
            <button
              (click)="sendQuizToCandidate()"
              [disabled]="quizSending() || questionSavingId() || questionRegeneratingId() || quizReordering()"
              class="h-12 px-6 rounded-2xl bg-sky-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-sky-700 transition-all disabled:opacity-60"
            >
              {{ quizSending() ? 'Sending...' : (sessionStatus() === 'ready' ? 'Resend To Candidate' : 'Send To Candidate') }}
            </button>
          </div>
        </ng-container>
      </div>
    </div>
  `,
})
export class QuizWorkspaceComponent implements OnInit, OnDestroy {
  private readonly apiService = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  applicationId = signal<number | null>(null);
  applicationSummary = signal<any | null>(window.history.state?.application ?? null);
  quizData = signal<any | null>(null);
  reportData = signal<any | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  questionSavingId = signal<string | null>(null);
  questionRegeneratingId = signal<string | null>(null);
  deletingQuestionId = signal<string | null>(null);
  quizReordering = signal<boolean>(false);
  draggedQuestionId = signal<string | null>(null);
  quizSending = signal<boolean>(false);
  autoRefreshActive = signal<boolean>(false);
  awaitingQuestionRefresh = signal<boolean>(false);

  readonly session = computed(() => this.quizData()?.session ?? this.reportData()?.session ?? null);
  readonly progress = computed(() => this.quizData()?.progress ?? this.reportData()?.progress ?? null);
  readonly questions = computed(() => this.quizData()?.questions ?? []);
  readonly report = computed(() => this.reportData()?.report ?? null);
  readonly sessionStatus = computed(() => String(this.session()?.status || '').toLowerCase());
  readonly quizAlreadySent = computed(() => {
    const app = this.quizData()?.application;
    return app?.ai_quiz_sent_at != null;
  });
  readonly sessionError = computed(() =>
    this.quizData()?.application?.quiz_error ||
    this.reportData()?.application?.quiz_error ||
    null
  );
  readonly reportSession = computed(() => this.reportData()?.session ?? null);
  readonly reportProgress = computed(() => this.reportData()?.progress ?? null);
  readonly candidateName = computed(() => {
    const app = this.applicationSummary();
    const first = app?.candidate?.first_name || '';
    const last = app?.candidate?.last_name || '';
    return `${first} ${last}`.trim() || `Candidate #${this.applicationId() ?? ''}`;
  });
  readonly jobTitle = computed(() => {
    return (
      this.applicationSummary()?.job_offer?.title ||
      this.quizData()?.application?.job_title ||
      this.reportData()?.application?.job_title ||
      this.session()?.job_title ||
      'Assessment'
    );
  });
  readonly backLink = computed(() => {
    return this.router.url.includes('/recruiter/') ? '/recruiter/applicants' : '/company/applicants';
  });

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const applicationId = Number(this.route.snapshot.paramMap.get('applicationId'));
    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      this.error.set('Invalid application id.');
      this.loading.set(false);
      return;
    }

    this.applicationId.set(applicationId);
    this.loadWorkspace();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadWorkspace(showSpinner = true): void {
    const applicationId = this.applicationId();
    if (!applicationId) return;

    if (showSpinner) {
      this.loading.set(true);
    }
    this.error.set(null);

    this.apiService.get<any>(`company/applications/${applicationId}/quiz`).subscribe({
      next: (res) => {
        const payload = res?.data ?? res;
        this.quizData.set(payload);
        this.loading.set(false);

        if (this.sessionStatus() === 'completed') {
          this.loadReport(false);
        } else {
          this.reportData.set(null);
        }

        if (this.awaitingQuestionRefresh() && this.sessionStatus() === 'review' && this.questions().length === (this.session()?.num_questions || 0)) {
          this.awaitingQuestionRefresh.set(false);
          this.questionRegeneratingId.set(null);
        }

        if (this.shouldPoll()) {
          this.startPolling();
        } else {
          this.stopPolling();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || err?.error?.message || 'Failed to load the assessment workspace.');
      }
    });
  }

  loadReport(showSpinner = false): void {
    const applicationId = this.applicationId();
    if (!applicationId) return;

    if (showSpinner) {
      this.loading.set(true);
    }

    this.apiService.get<any>(`company/applications/${applicationId}/quiz/report`).subscribe({
      next: (res) => {
        this.reportData.set(res?.data ?? res);
        if (showSpinner) {
          this.loading.set(false);
        }
      },
      error: () => {
        if (showSpinner) {
          this.loading.set(false);
        }
      }
    });
  }

  shouldPoll(): boolean {
    return this.sessionStatus() === 'generating' || this.awaitingQuestionRefresh();
  }

  startPolling(): void {
    if (this.pollTimer) {
      this.autoRefreshActive.set(true);
      return;
    }
    this.autoRefreshActive.set(true);
    this.pollTimer = setInterval(() => this.loadWorkspace(false), 3000);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.autoRefreshActive.set(false);
  }

  pendingSlots(): number[] {
    const expected = Number(this.session()?.num_questions || 0);
    const actual = this.questions().length;
    const missing = Math.max(expected - actual, 0);
    return Array.from({ length: missing }, (_, index) => actual + index + 1);
  }

  trackByQuestionId(_: number, question: any): string {
    return String(question?.id || '');
  }

  getQuizStatusChipClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'generating':
        return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'review':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'ready':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
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

  saveQuizQuestion(question: any): void {
    const applicationId = this.applicationId();
    if (!applicationId || !question?.id || this.questionSavingId()) return;

    this.questionSavingId.set(String(question.id));
    
    // Extract choice text for saving
    const choices = (question.choices_labeled || []).map((c: any) => c.text);

    this.apiService.patch<any>(`company/applications/${applicationId}/quiz/questions/${question.id}`, {
      question_text: question.question_text,
      follow_up_hint: question.follow_up_hint,
      difficulty: question.difficulty,
      choices: choices,
      correct_choice: question.correct_choice,
      explanation: question.explanation,
    }).subscribe({
      next: (res) => {
        this.questionSavingId.set(null);
        this.replaceQuestionInState(res?.data?.question);
        this.notificationService.success('Question updated.');
      },
      error: (err) => {
        this.questionSavingId.set(null);
        this.notificationService.error(err?.error?.error || err?.error?.message || 'Failed to update question.');
      }
    });
  }

  deleteQuizQuestion(question: any): void {
    const applicationId = this.applicationId();
    if (!applicationId || !question?.id || this.deletingQuestionId()) return;

    if (!confirm('Are you sure you want to remove this question? This will reorder the remaining questions.')) {
      return;
    }

    this.deletingQuestionId.set(String(question.id));
    this.apiService.delete<any>(`company/applications/${applicationId}/quiz/questions/${question.id}`).subscribe({
      next: () => {
        this.deletingQuestionId.set(null);
        this.notificationService.success('Question removed.');
        this.loadWorkspace(false);
      },
      error: (err) => {
        this.deletingQuestionId.set(null);
        this.notificationService.error(err?.error?.error || err?.error?.message || 'Failed to delete question.');
      }
    });
  }

  approveQuizQuestion(question: any): void {
    const applicationId = this.applicationId();
    if (!applicationId || !question?.id || this.questionSavingId()) return;

    this.questionSavingId.set(String(question.id));
    this.apiService.patch<any>(`company/applications/${applicationId}/quiz/questions/${question.id}`, {
      hr_approved: true,
    }).subscribe({
      next: (res) => {
        this.questionSavingId.set(null);
        this.replaceQuestionInState(res?.data?.question);
        this.notificationService.success('Question approved.');
      },
      error: (err) => {
        this.questionSavingId.set(null);
        this.notificationService.error(err?.error?.error || err?.error?.message || 'Failed to approve question.');
      }
    });
  }

  onRegenerateClick(question: any): void {
    alert('Regenerate button clicked! Question: ' + JSON.stringify(question?.id));
    console.log('>>> onRegenerateClick called with:', question);
    this.regenerateQuizQuestion(question);
  }

  regenerateQuizQuestion(question: any): void {
    console.log('>>> regenerateQuizQuestion called:', question);
    const applicationId = this.applicationId();
    const questionId = String(question?.id || '');
    
    // Only block if this specific question is already regenerating
    if (!applicationId || !questionId || this.questionRegeneratingId() === questionId) {
      console.log('Regenerate blocked:', { applicationId, questionId, currentRegeneratingId: this.questionRegeneratingId() });
      return;
    }
    
    console.log('Regenerate proceeding:', { applicationId, questionId });

    this.questionRegeneratingId.set(questionId);
    this.awaitingQuestionRefresh.set(true);
    this.apiService.post<any>(`company/applications/${applicationId}/quiz/questions/${question.id}/regenerate`, {}).subscribe({
      next: (res) => {
        this.notificationService.info(res?.message || `Regenerating question ${question.question_number}...`);
        this.startPolling();
        this.loadWorkspace(false);
      },
      error: (err) => {
        this.questionRegeneratingId.set(null);
        this.awaitingQuestionRefresh.set(false);
        this.notificationService.error(err?.error?.error || err?.error?.message || 'Failed to regenerate question.');
      }
    });
  }

  onQuestionDragStart(question: any): void {
    this.draggedQuestionId.set(String(question?.id || ''));
  }

  onQuestionDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onQuestionDrop(targetQuestion: any): void {
    const draggedId = this.draggedQuestionId();
    if (!draggedId || !targetQuestion?.id || draggedId === String(targetQuestion.id) || this.quizReordering()) {
      this.draggedQuestionId.set(null);
      return;
    }

    const current = this.quizData();
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

    this.quizData.set({
      ...current,
      questions: normalized,
    });
    this.draggedQuestionId.set(null);
    this.persistQuizOrder(normalized);
  }

  persistQuizOrder(questions: any[]): void {
    const applicationId = this.applicationId();
    if (!applicationId || this.quizReordering()) return;

    this.quizReordering.set(true);
    this.apiService.post<any>(`company/applications/${applicationId}/quiz/reorder`, {
      question_ids: questions.map((item: any) => item.id),
    }).subscribe({
      next: (res) => {
        this.quizReordering.set(false);
        const reordered = res?.data?.questions;
        if (reordered) {
          this.quizData.set({
            ...this.quizData(),
            questions: reordered,
          });
        }
        this.notificationService.success('Question order updated.');
      },
      error: (err) => {
        this.quizReordering.set(false);
        this.notificationService.error(err?.error?.error || err?.error?.message || 'Failed to reorder questions.');
        this.loadWorkspace(false);
      }
    });
  }

  sendQuizToCandidate(): void {
    const applicationId = this.applicationId();
    if (!applicationId || this.quizSending()) return;

    this.quizSending.set(true);
    this.apiService.post<any>(`company/applications/${applicationId}/quiz/send`, {}).subscribe({
      next: (res) => {
        this.quizSending.set(false);
        this.notificationService.success(res?.message || 'Quiz sent to candidate.');
        this.loadWorkspace(false);
      },
      error: (err) => {
        this.quizSending.set(false);
        this.notificationService.error(err?.error?.error || err?.error?.message || 'Failed to send quiz.');
      }
    });
  }

  private replaceQuestionInState(updated: any): void {
    if (!updated || !this.quizData()?.questions) return;
    const nextQuestions = this.quizData().questions.map((item: any) =>
      item.id === updated.id ? { ...item, ...updated } : item
    );
    this.quizData.set({
      ...this.quizData(),
      questions: nextQuestions,
    });
  }

  goBack(): void {
    this.router.navigate(['/company/applicants']);
  }
}
