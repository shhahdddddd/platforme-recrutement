import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-interview-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-[#F8FAFC] pb-20">
      <!-- Premium Header Area -->
      <div class="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div class="max-w-5xl mx-auto px-6 h-24 flex items-center justify-between">
          <div class="flex items-center gap-6">
            <button (click)="goBack()" 
                    class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all border border-transparent active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
	            <div>
	              <div class="flex items-center gap-2 mb-1">
	                <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">Schedule</span>
	                <span class="text-slate-300">/</span>
	                <span class="text-slate-500 font-bold text-xs uppercase tracking-widest">RH Action</span>
	              </div>
	              <h1 class="text-xl font-black text-slate-900 tracking-tight">Interview Scheduling</h1>
	            </div>
          </div>

          <div class="flex items-center gap-3">
             <button (click)="goBack()" class="px-6 h-12 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all text-xs uppercase tracking-widest">Cancel</button>
	             <button 
	                (click)="submit()" 
	                [disabled]="isSubmitting() || !application()"
	                class="px-8 h-12 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-[0.1em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-3 active:scale-95">
	                <svg *ngIf="!isSubmitting()" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
	                <svg *ngIf="isSubmitting()" class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"/></svg>
	                {{ isSubmitting() ? 'Saving...' : 'Schedule Interview' }}
	             </button>
          </div>
        </div>
      </div>

      <div class="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        <!-- Left Column: Applicant Card -->
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <div *ngIf="isLoadingApp()" class="animate-pulse space-y-6">
              <div class="w-24 h-24 bg-slate-100 rounded-3xl"></div>
              <div class="h-6 bg-slate-100 rounded-full w-3/4"></div>
              <div class="h-4 bg-slate-100 rounded-full w-1/2"></div>
            </div>

            <div *ngIf="!isLoadingApp() && application()" class="space-y-8">
              <div class="relative inline-block">
                <div *ngIf="!application().candidate?.picture" class="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-black text-3xl shadow-xl">
                    {{ application().candidate?.first_name?.[0] }}{{ application().candidate?.last_name?.[0] }}
                </div>
                <img *ngIf="application().candidate?.picture" [src]="application().candidate.picture" class="w-24 h-24 rounded-[2rem] object-cover shadow-xl" />
                <div class="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-white shadow-lg flex items-center justify-center text-blue-600 border border-slate-50">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              </div>

              <div>
                <h2 class="text-3xl font-black text-slate-900 tracking-tight mb-2 leading-none">
                  {{ application().candidate?.first_name }} <br/>
                  <span class="text-blue-600">{{ application().candidate?.last_name }}</span>
                </h2>
                <div class="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="13" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  {{ application().job_offer?.title }}
                </div>
              </div>

              <div class="pt-8 border-t border-slate-50 space-y-4">
                 <div class="flex items-center gap-4 group">
                    <div class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <span class="text-xs font-bold text-slate-600 truncate">{{ application().candidate?.user?.email }}</span>
                 </div>
                 <div class="flex items-center gap-4 group">
                    <div class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </div>
                    <span class="text-xs font-bold text-slate-600">{{ application().candidate?.phone || 'Not provided' }}</span>
                 </div>
              </div>
            </div>
          </div>


        </div>

        <!-- Right Column: Form -->
        <div class="lg:col-span-2 space-y-10">
          
          <div class="space-y-12">
            
            <!-- Step 1: Modality -->
            <section>
              <div class="flex items-center gap-4 mb-8">
                 <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/20">01</div>
                 <h3 class="text-lg font-black text-slate-900 tracking-tight">Interview Modality</h3>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <label class="group relative cursor-pointer">
                    <input type="radio" name="mode" [(ngModel)]="form.interview_mode" value="online" class="peer sr-only">
                    <div class="p-6 rounded-3xl border-2 border-slate-100 bg-white hover:border-blue-200 transition-all peer-checked:border-blue-600 peer-checked:bg-blue-50/30">
                       <div class="flex items-center gap-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform peer-checked:bg-blue-600 peer-checked:text-white">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                          </div>
                          <div>
                             <p class="font-black text-slate-900 leading-none mb-1 uppercase text-[10px] tracking-widest">Online</p>
                             <p class="text-xs font-bold text-slate-500">Video conference or call</p>
                          </div>
                       </div>
                       <div class="absolute top-4 right-4 text-blue-600 opacity-0 peer-checked:opacity-100">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                       </div>
                    </div>
                 </label>

                 <label class="group relative cursor-pointer">
                    <input type="radio" name="mode" [(ngModel)]="form.interview_mode" value="presentiel" class="peer sr-only">
                    <div class="p-6 rounded-3xl border-2 border-slate-100 bg-white hover:border-blue-200 transition-all peer-checked:border-blue-600 peer-checked:bg-blue-50/30">
                       <div class="flex items-center gap-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform peer-checked:bg-blue-600 peer-checked:text-white">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                          </div>
                          <div>
                             <p class="font-black text-slate-900 leading-none mb-1 uppercase text-[10px] tracking-widest">In-person</p>
                             <p class="text-xs font-bold text-slate-500">Meeting at our office</p>
                          </div>
                       </div>
                       <div class="absolute top-4 right-4 text-blue-600 opacity-0 peer-checked:opacity-100">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                       </div>
                    </div>
                 </label>
              </div>
            </section>

            <!-- Step 2: Evaluation Type -->
            <section>
              <div class="flex items-center gap-4 mb-8">
                 <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/20">02</div>
                 <h3 class="text-lg font-black text-slate-900 tracking-tight">Evaluation Type</h3>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <label *ngFor="let type of interviewTypes" class="group relative cursor-pointer">
                    <input type="radio" name="type" [(ngModel)]="form.interview_type" [value]="type.value" class="peer sr-only">
                    <div class="p-6 rounded-3xl border-2 border-slate-100 bg-white hover:border-blue-200 transition-all peer-checked:border-blue-600 peer-checked:bg-blue-50/30">
                       <div class="space-y-3">
                          <div class="flex items-center justify-between">
                             <span class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 transition-colors peer-checked:bg-blue-600 peer-checked:text-white">
                                <svg *ngIf="type.value === 'test_technique'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                                <svg *ngIf="type.value === 'test_rh_telephonique'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                <svg *ngIf="type.value === 'test_rh_video'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                                <svg *ngIf="type.value === 'test_psychotechnique'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 0-9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/><path d="M12 9v4"/></svg>
                             </span>
                             <div class="w-6 h-6 rounded-full border-2 border-slate-100 peer-checked:border-blue-600 peer-checked:bg-blue-600 flex items-center justify-center text-white scale-0 transition-transform peer-checked:scale-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                             </div>
                          </div>
                          <div>
                             <p class="font-black text-slate-900 leading-none mb-1 uppercase text-[10px] tracking-widest">{{ type.label }}</p>
                             <p class="text-xs font-bold text-slate-500 leading-tight">{{ type.desc }}</p>
                          </div>
                       </div>
                    </div>
                 </label>
              </div>
            </section>

            <!-- Step 3: Assign Expert -->
            <section class="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div>
                  <div class="flex items-center gap-4 mb-6">
                     <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/20">03</div>
                     <h3 class="text-lg font-black text-slate-900 tracking-tight">Assign an Expert</h3>
                  </div>
                  
                  <div class="relative group">
                     <!-- Custom Premium Dropdown -->
                     <button (click)="recruiterDropdownOpen.set(!recruiterDropdownOpen())"
                             type="button"
                             class="w-full h-[68px] bg-white border-2 border-slate-100 rounded-[1.5rem] px-8 flex items-center justify-between transition-all outline-none hover:border-blue-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10"
                             [class.border-blue-600]="recruiterDropdownOpen()"
                             [class.ring-4]="recruiterDropdownOpen()"
                             [class.ring-blue-500_10]="recruiterDropdownOpen()">
                        <div class="flex items-center gap-3 overflow-hidden">
                           <div *ngIf="selectedRecruiter()" class="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-[10px] shrink-0">
                              {{ selectedRecruiter().full_name[0] }}
                           </div>
                           <span *ngIf="!selectedRecruiter()" class="font-black text-sm text-slate-400">Select an expert...</span>
                           <div *ngIf="selectedRecruiter()" class="flex flex-col items-start overflow-hidden">
                              <span class="font-black text-sm text-slate-900 leading-none mb-1 truncate w-full">{{ selectedRecruiter().full_name }}</span>
                              <span class="text-[10px] font-bold text-slate-400 truncate w-full">{{ selectedRecruiter().user?.email }}</span>
                           </div>
                        </div>
                        <div class="text-slate-400 transition-transform duration-300" [class.rotate-180]="recruiterDropdownOpen()">
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                     </button>

                     <!-- Dropdown Menu -->
                     <div *ngIf="recruiterDropdownOpen()" 
                          class="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-[2rem] shadow-2xl shadow-slate-200/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                        <div class="max-h-[300px] overflow-y-auto p-3 space-y-1 custom-scrollbar">
                           <button *ngFor="let r of recruiters()" 
                                   (click)="interviewRecruiterId.set(r.id); recruiterDropdownOpen.set(false)"
                                   class="w-full p-4 rounded-3xl flex items-center gap-4 hover:bg-slate-50 transition-all text-left relative group/item">
                              <div class="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center font-black text-sm group-hover/item:bg-blue-600 group-hover/item:text-white transition-all">
                                 {{ r.full_name[0] }}
                              </div>
                              <div class="flex-1 overflow-hidden">
                                 <p class="font-black text-slate-900 text-sm leading-none mb-1 truncate">{{ r.full_name }}</p>
                                 <p class="text-[10px] font-bold text-slate-400 truncate">{{ r.user?.email }}</p>
                              </div>
                              <div *ngIf="interviewRecruiterId() === r.id" class="text-blue-600">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              </div>
                           </button>
                        </div>
                     </div>
                  </div>

               </div>
            </section>

            <!-- Step 4: Notes -->
            <section>
              <div class="flex items-center gap-4 mb-6">
                 <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/20">04</div>
                 <h3 class="text-lg font-black text-slate-900 tracking-tight">Instructions & Notes</h3>
              </div>
              <textarea 
                [(ngModel)]="form.notes"
                rows="5" 
                placeholder="Ex: Please bring your CV and an ID. For the technical test, prepare your development environment..."
                class="w-full bg-white border-2 border-slate-100 rounded-[2.5rem] p-10 font-bold text-slate-700 hover:border-blue-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none leading-relaxed"></textarea>
            </section>

          </div>

          <!-- Final Footer Button -->
          <div class="pt-10 border-t border-slate-100 flex flex-col items-center">
	             <div class="mb-10 text-center space-y-2">
	                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 animate-pulse">Assignment Complete</p>
	                <p class="text-xs font-bold text-slate-400 max-w-md">The assigned recruiter will be notified to schedule the interview. They will set the date, time, and duration.</p>
	             </div>
	             <button 
	                (click)="submit()" 
	                [disabled]="isSubmitting() || !application()"
	                class="w-full max-w-xl py-8 rounded-[2.5rem] bg-blue-600 text-white font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-4 active:scale-[0.98]">
	                Assign Expert
	                <svg *ngIf="!isSubmitting()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
	                <svg *ngIf="isSubmitting()" class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"/></svg>
             </button>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
  `]
})
export class InterviewScheduleComponent implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  application = signal<any>(null);
  isLoadingApp = signal(true);
  isSubmitting = signal(false);
  recruiters = signal<any[]>([]);
  recruiterDropdownOpen = signal(false);
  jobId = signal<string | null>(null);
  interviewRecruiterId = signal<number | null>(null);

  selectedRecruiter = computed(() => {
    return this.recruiters().find(r => r.id === this.interviewRecruiterId());
  });

  form = {
    interview_type: 'test_rh_telephonique',
    interview_mode: 'online',
    notes: ''
  };

  readonly interviewTypes = [
    { value: 'test_rh_telephonique', label: 'HR Phone Call', desc: 'First exploratory contact' },
    { value: 'test_rh_video', label: 'HR Video', desc: 'In-depth motivation interview' },
    { value: 'test_technique', label: 'Technical Test', desc: 'Expert hard skills evaluation' },
    { value: 'test_psychotechnique', label: 'Psychometric', desc: 'Logic & personality tests' }
  ];

  ngOnInit() {
    const applicationId = history.state.applicationId;
    const jobId = history.state.jobId;

    if (jobId) {
      this.jobId.set(jobId);
    }

    if (applicationId) {
      this.loadApplicationData(String(applicationId));
    } else {
      this.navigateBackToApplicants();
    }
  }

  loadApplicationData(id: string) {
    this.isLoadingApp.set(true);
    this.apiService.get<any>('company/applicants').subscribe({
      next: (res) => {
        if (res.success) {
          const app = res.data.find((a: any) => String(a.id) === id);
          if (app) {
            this.application.set(app);
            if (app.job_offer?.department_id) {
              this.loadRecruiters(app.job_offer.department_id);
            } else {
              this.loadRecruiters();
            }
          } else {
            this.notificationService.error('Application not found');
            this.navigateBackToApplicants();
          }
        }
        this.isLoadingApp.set(false);
      },
      error: () => {
        this.notificationService.error('Error while loading');
        this.isLoadingApp.set(false);
        this.navigateBackToApplicants();
      }
    });
  }

  loadRecruiters(departmentId?: number) {
    let url = 'company/recruiters';
    if (departmentId) {
      url += `?department_id=${departmentId}`;
    }
    this.apiService.get<any>(url).subscribe({
      next: (res) => { if (res.success) this.recruiters.set(res.data); }
    });
  }

  goBack() {
    this.navigateBackToApplicants();
  }

  private navigateBackToApplicants() {
    const jobId = this.jobId();
    const basePath = '/company/applicants';
    
    if (jobId) {
      this.router.navigate([basePath], { state: { jobId } });
    } else {
      this.router.navigate([basePath]);
    }
  }

  submit() {
    if (this.isSubmitting() || !this.application()) return;

    if (!this.interviewRecruiterId()) {
      this.notificationService.warning('Please assign a recruiter for this interview.');
      return;
    }

    this.isSubmitting.set(true);
    const appId = this.application().id;

    // Only assign recruiter - date/time will be set by recruiter later
    const payload = {
        interview_type: this.form.interview_type,
        interview_mode: this.form.interview_mode,
        interview_recruiter_id: this.interviewRecruiterId(),
        notes: this.form.notes
    };

    this.apiService.post<any>(`company/applications/${appId}/assign-recruiter`, payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success('Expert assigned successfully. The recruiter has been notified to schedule the interview.');
          this.navigateBackToApplicants();
        } else {
          this.notificationService.error(res.message || 'Error assigning expert');
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Server error while scheduling the interview');
        this.isSubmitting.set(false);
      }
    });
  }
}
