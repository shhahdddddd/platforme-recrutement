import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';

interface ManualQuestion {
  question_text: string;
  choices: string[];
  correct_choice: string;
  explanation: string;
  difficulty: string;
  category: string;
  points: number;
}

@Component({
  selector: 'app-manual-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8FAFC] pb-20 font-['Outfit']">
      
      <!-- Top Navigation Bar -->
      <nav class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 h-20 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-4 no-print">
          <a [routerLink]="['/recruiter/applicants']" class="p-2 truncate rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </a>
          <div class="h-6 w-px bg-slate-200 mx-2"></div>
          <div>
            <h1 class="text-xl font-black text-slate-900 leading-tight">Assessment Setup</h1>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Technical Alignment & Customs</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <button 
            (click)="saveQuiz()"
            [disabled]="isSaving()"
            class="h-12 px-8 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-60"
          >
            {{ isSaving() ? 'Saving Changes...' : 'Publish Quiz' }}
            <svg *ngIf="!isSaving()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <div *ngIf="isSaving()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          </button>
        </div>
      </nav>

      <div class="max-w-[1100px] mx-auto px-6 py-12">
        
        <!-- Quiz Info Banner -->
        <div class="bg-indigo-600 rounded-[2.5rem] p-10 mb-12 shadow-2xl shadow-indigo-600/20 flex flex-col md:flex-row items-center gap-10 text-white overflow-hidden relative">
          <div class="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
          <div class="absolute -left-20 -top-20 w-80 h-80 bg-indigo-500/30 rounded-full blur-3xl"></div>
          
          <div class="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center shrink-0 border border-white/30">
             <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 22 4-10 4 10"/><path d="M12 2v10"/></svg>
          </div>

          <div class="flex-1 space-y-6 relative z-10 w-full">
            <div class="grid md:grid-cols-2 gap-8">
              <div class="space-y-3">
                <label class="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Session Identifier</label>
                <input 
                  [(ngModel)]="quizTitle"
                  class="w-full bg-white/10 border border-white/20 rounded-2xl h-14 px-6 text-xl font-bold placeholder:text-white/40 outline-none focus:bg-white/20 transition-all"
                  placeholder="Enter Quiz Title..."
                >
              </div>
              <div class="space-y-3">
                <label class="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Time Limit (Min)</label>
                <div class="flex items-center gap-3">
                   <input 
                    type="number"
                    [(ngModel)]="timeLimit"
                    class="w-24 bg-white/10 border border-white/20 rounded-2xl h-14 px-6 text-xl font-bold outline-none focus:bg-white/20 transition-all text-center"
                   >
                   <p class="text-sm font-medium text-indigo-100">Applicants will have this duration to complete the assessment.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Questions Configuration -->
        <div class="space-y-10">
          <div 
            *ngFor="let q of questions; let i = index" 
            (click)="activeQuestionIndex.set(i)"
            class="bg-white rounded-[3rem] shadow-xl shadow-slate-200/60 border-2 overflow-hidden group transition-all duration-500 transform"
            [ngClass]="activeQuestionIndex() === i ? 'border-indigo-600 scale-[1.01] shadow-2xl shadow-indigo-600/10' : 'border-slate-50 hover:border-slate-200'"
          >
            <!-- Question Header/Metas -->
            <div class="bg-slate-50/50 border-b border-slate-100 px-10 py-6 flex flex-wrap items-center justify-between gap-6" [ngClass]="{'bg-indigo-50/20': activeQuestionIndex() === i}">
               <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg transition-all duration-500" 
                       [ngClass]="activeQuestionIndex() === i ? 'bg-indigo-600 text-white scale-110' : 'bg-slate-900 text-white'">
                    {{ i + 1 }}
                  </div>
                  <div>
                    <span class="block text-[10px] font-black uppercase tracking-widest transition-colors" [ngClass]="activeQuestionIndex() === i ? 'text-indigo-600' : 'text-slate-400'">Section Slot</span>
                    <span class="text-sm font-bold text-slate-700">Multiple Choice Question</span>
                  </div>
               </div>

               <div class="flex items-center gap-3">
                  <!-- Category -->
                  <div class="relative group/cat">
                    <select 
                      [(ngModel)]="q.category"
                      class="h-10 pl-4 pr-10 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    >
                       <option value="General">General</option>
                       <option value="Technical">Technical</option>
                       <option value="Social">Social</option>
                       <option value="Problem Solving">Problem Solving</option>
                       <option value="Language">Language</option>
                    </select>
                    <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>

                  <!-- Difficulty -->
                  <div class="flex p-1 bg-white border border-slate-200 rounded-xl">
                    <button 
                      *ngFor="let d of ['easy', 'medium', 'hard']"
                      (click)="q.difficulty = d"
                      class="h-8 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                      [ngClass]="q.difficulty === d ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-slate-600'"
                    >
                      {{ d }}
                    </button>
                  </div>

                  <!-- Points -->
                  <div class="flex items-center gap-2 px-3 h-10 bg-white border border-slate-200 rounded-xl">
                    <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Point:</span>
                    <input 
                      type="number"
                      [(ngModel)]="q.points"
                      class="w-8 text-center font-black text-slate-900 bg-transparent border-none outline-none"
                    >
                  </div>

                  <button 
                    (click)="removeQuestion(i); $event.stopPropagation()"
                    *ngIf="questions.length > 1"
                    class="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
               </div>
            </div>

            <div class="p-10 space-y-10">
               <!-- Question Text Content -->
               <div class="space-y-4">
                 <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400">Question Content</label>
                 <textarea 
                    [(ngModel)]="q.question_text"
                    rows="3"
                    class="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-8 text-xl font-bold text-slate-800 placeholder:text-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all resize-none shadow-inner"
                    placeholder="E.g. What is the complexity of a binary search algorithm in an ordered list?"
                 ></textarea>
               </div>

               <!-- Choices Mapping -->
               <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400">Response Options</label>
                    <span class="text-[10px] font-bold text-indigo-500">Pick the correct answer by clicking the label</span>
                  </div>
                  
                  <div class="grid sm:grid-cols-2 gap-5 text-slate-400">
                    <div 
                      *ngFor="let choice of q.choices; let ci = index; trackBy: trackByIndex"
                      (click)="setCorrectChoice(q, ci, $event)"
                      class="group/choice flex items-center gap-4 p-5 rounded-3xl border-2 transition-all relative overflow-hidden cursor-pointer"
                      [ngClass]="getChoiceLabel(ci) === q.correct_choice ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-lg shadow-indigo-600/10 ring-2 ring-indigo-500/20' : 'border-slate-50 bg-slate-50 hover:border-slate-200'"
                    >
                      <div 
                        class="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-all shrink-0"
                        [ngClass]="getChoiceLabel(ci) === q.correct_choice ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'bg-white border border-slate-200 text-slate-400'"
                      >
                        {{ getChoiceLabel(ci) }}
                      </div>
                      <input 
                        [(ngModel)]="q.choices[ci]"
                        (click)="$event.stopPropagation()"
                        class="flex-1 bg-transparent border-none font-bold outline-none placeholder:text-slate-300 cursor-text"
                        [placeholder]="'Option ' + getChoiceLabel(ci) + '...'"
                      >
                      <button 
                        *ngIf="q.choices.length > 2"
                        type="button"
                        (click)="removeChoice(q, ci); $event.stopPropagation()"
                        class="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all opacity-0 group-hover/choice:opacity-100"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </div>

                    <button 
                      *ngIf="q.choices.length < 5"
                      (click)="addChoice(q)"
                      class="flex items-center gap-4 p-5 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all font-black text-[10px] uppercase tracking-widest group/add"
                    >
                      <div class="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center group-hover/add:border-indigo-300 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                      </div>
                      Add Response Slot
                    </button>
                  </div>
               </div>

               <!-- Explanation Field -->
               <div class="pt-10 border-t border-slate-50 flex flex-col md:flex-row gap-10">
                  <div class="flex-1 space-y-4">
                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400">Answer Explanation (Optional)</label>
                    <textarea 
                      [(ngModel)]="q.explanation"
                      rows="2"
                      placeholder="Help candidate understand why this is the correct answer..."
                      class="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-300 transition-all font-semibold text-sm text-slate-700 outline-none resize-none"
                    ></textarea>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <!-- FAB: Add Question -->
        <div class="mt-16 flex justify-center">
           <button 
             (click)="addQuestion()"
             class="group h-20 px-12 rounded-[2.5rem] bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:shadow-2xl hover:shadow-indigo-600/30 hover:-translate-y-1 transition-all flex items-center gap-5 shadow-2xl shadow-slate-900/20"
           >
              <div class="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              </div>
              Append New Question
           </button>
        </div>

        <!-- Premium Delete Modal -->
        <div *ngIf="showDeleteModal()" class="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="closeDeleteModal()"></div>
           
           <div class="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-10 overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500">
              <div class="absolute -right-10 -top-10 w-40 h-40 bg-rose-50 rounded-full blur-3xl opacity-50"></div>
              
              <div class="relative space-y-8 text-center">
                 <div class="w-20 h-20 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                 </div>
                 
                 <div class="space-y-3">
                    <h3 class="text-2xl font-black text-slate-900 tracking-tight">Remove Question?</h3>
                    <p class="text-slate-500 font-bold text-sm leading-relaxed px-4">
                       This action will permanently delete this question slot and its associated response options. This cannot be undone.
                    </p>
                 </div>
                 
                 <div class="flex flex-col gap-3 pt-4">
                    <button 
                       (click)="confirmDelete()"
                       class="w-full h-16 rounded-2xl bg-rose-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-500/30 hover:bg-rose-600 transition-all active:scale-95"
                    >
                       Confirm Deletion
                    </button>
                    <button 
                       (click)="closeDeleteModal()"
                       class="w-full h-16 rounded-2xl bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                    >
                       Cancel
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class ManualQuizComponent implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  applicationId = signal<string | null>(null);
  quizTitle = 'Screening Assessment';
  timeLimit = 15;
  isSaving = signal(false);
  questions: ManualQuestion[] = [this.createEmptyQuestion()];

  // Modal signals
  showDeleteModal = signal(false);
  indexToDelete = signal<number | null>(null);
  activeQuestionIndex = signal<number | null>(0);

  ngOnInit(): void {
    const id = window.history.state?.applicationId;
    const stateDuration = window.history.state?.duration;

    if (stateDuration) {
      this.timeLimit = Number(stateDuration);
    }

    if (id) {
      this.applicationId.set(id);
      this.loadExistingQuiz(id);
    } else {
      // Fallback: try to get from URL params if direct navigation happened
      // (though route is now /assessment-setup, old users might have old URLs)
      const paramId = this.route.snapshot.paramMap.get('id');
      if (paramId) {
        this.applicationId.set(paramId);
        this.loadExistingQuiz(paramId);
      }
    }
  }

  loadExistingQuiz(id: string) {
    this.apiService.get<any>(`company/applications/${id}/manual-quiz`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.quizTitle = res.data.title || this.quizTitle;
          this.timeLimit = res.data.time_limit || this.timeLimit;
          if (res.data.questions?.length) {
            this.questions = res.data.questions.map((q: any) => ({
              question_text: q.question_text,
              choices: q.choices,
              correct_choice: q.correct_choice,
              explanation: q.explanation,
              difficulty: q.difficulty,
              category: q.category || 'General',
              points: q.points || 1
            }));
          }
        }
      }
    });
  }

  createEmptyQuestion(): ManualQuestion {
    return {
      question_text: '',
      choices: ['', ''],
      correct_choice: 'A',
      explanation: '',
      difficulty: 'medium',
      category: 'General',
      points: 1
    };
  }

  addQuestion() {
    this.questions.push(this.createEmptyQuestion());
    // Auto-scroll to bottom after a small delay
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  }

  removeQuestion(index: number) {
    this.indexToDelete.set(index);
    this.showDeleteModal.set(true);
  }

  confirmDelete() {
    const index = this.indexToDelete();
    if (index !== null) {
      this.questions.splice(index, 1);
      this.notificationService.info('Question removed from the assessment.');
    }
    this.closeDeleteModal();
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.indexToDelete.set(null);
  }

  addChoice(question: ManualQuestion) {
    if (question.choices.length < 5) {
      question.choices.push('');
    }
  }

  removeChoice(question: ManualQuestion, index: number) {
    const label = this.getChoiceLabel(index);
    if (question.choices.length > 2) {
      question.choices.splice(index, 1);
      if (question.correct_choice === label) {
        question.correct_choice = 'A';
      }
    }
  }

  getChoiceLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  setCorrectChoice(question: ManualQuestion, index: number, event: Event) {
    event.stopPropagation();
    question.correct_choice = this.getChoiceLabel(index);
    this.notificationService.info(`Correct answer set to option ${question.correct_choice}.`);
  }

  trackByIndex(index: number, item: any) {
    return index;
  }

  saveQuiz() {
    const id = this.applicationId();
    if (!id) return;

    if (!this.quizTitle.trim()) {
      this.notificationService.error('Please enter a quiz title.');
      return;
    }

    const invalidQ = this.questions.find(q => !q.question_text.trim() || q.choices.some(c => !c.trim()));
    if (invalidQ) {
      this.notificationService.error('Incomplete question slots. Please fill all fields or remove empty slots.');
      return;
    }

    this.isSaving.set(true);
    this.apiService.post<any>(`company/applications/${id}/manual-quiz`, {
      title: this.quizTitle,
      time_limit: this.timeLimit,
      questions: this.questions
    }).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        if (res.success) {
          this.notificationService.success('Quiz published successfully.');
          this.router.navigate(['/recruiter/applicants']);
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        this.notificationService.error(err.status === 403 ? 'You do not have permission to manage this quiz.' : 'Network error. Please try again.');
      }
    });
  }
}
