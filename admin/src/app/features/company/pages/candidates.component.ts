import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

type AttendanceType = 'remote' | 'onsite' | 'hybrid';

interface Candidate {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  start_date?: string;
  attendance?: AttendanceType | null;
  attendance_schedule?: {
    days: string[];
    start_time: string;
    end_time: string;
  } | null;
  avatar?: string;
  job_offer_title?: string;
  accepted_at?: string;
}

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[#f8fafc] pb-20 font-['Outfit']">
      <div class="max-w-[1400px] mx-auto px-6 py-12">

        <!-- Premium Header -->
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
          <div>
            <h1 class="text-5xl font-black text-slate-900 tracking-tight leading-none">
              Accepted <span class="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Interns</span>
            </h1>
            <p class="text-slate-500 font-semibold mt-4 max-w-2xl text-base sm:text-lg italic">
              Manage attendance schedules and working arrangements for your hired interns.
            </p>
          </div>
          <div class="flex items-center gap-3">
             <button (click)="loadCandidates()" class="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
             </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="bg-white rounded-[2.5rem] p-5 border border-slate-100 mb-10 flex flex-col md:flex-row items-center gap-6">
          <div class="flex-1 relative w-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="absolute left-7 top-1/2 -translate-y-1/2 text-slate-300"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              (ngModelChange)="filterCandidates()"
              placeholder="Search by intern name, position, or job title..." 
              class="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] pl-18 pr-7 py-5 font-bold text-slate-800 focus:bg-white focus:border-blue-500/20 text-base transition-all outline-none" 
            />
          </div>
          <div class="flex items-center gap-2 px-2 overflow-x-auto w-full md:w-auto">
             <button 
               *ngFor="let type of ['all', 'remote', 'onsite', 'hybrid']"
               (click)="attendanceFilter.set(type); filterCandidates()"
               [class]="'px-6 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ' + (attendanceFilter() === type ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100')"
             >
               {{ type }}
             </button>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading()" class="flex flex-col items-center justify-center py-24">
          <div class="w-14 h-14 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p class="text-slate-500 text-base mt-5 font-bold uppercase tracking-widest">Loading interns...</p>
        </div>

        <!-- Candidates Table -->
        <div *ngIf="!isLoading()" class="bg-white rounded-[3rem] border border-slate-100 overflow-hidden relative min-h-[600px]">
          <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50/50">
                  <th class="px-12 py-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Intern</th>
                  <th class="px-10 py-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Attendance</th>
                  <th class="px-10 py-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Schedule</th>
                  <th class="px-12 py-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr *ngFor="let candidate of filteredCandidates()" class="hover:bg-slate-50/80 transition-all group">
                  <td class="px-12 py-10">
                    <div class="flex items-center gap-6">
                      <div class="relative">
                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xl shrink-0 transition-transform group-hover:-rotate-3 duration-500">
                          {{ getInitials(candidate) }}
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white bg-blue-500"></div>
                      </div>
                      <div>
                        <div class="font-black text-slate-900 group-hover:text-blue-600 transition-colors text-lg leading-none mb-2">
                          {{ candidate.first_name }} {{ candidate.last_name }}
                        </div>
                        <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{{ candidate.email }}</div>
                        <div *ngIf="candidate.job_offer_title" class="text-[11px] text-blue-600 font-bold uppercase tracking-widest mt-1.5">{{ candidate.job_offer_title }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-10 py-10">
                    <div class="relative" [class.z-20]="attendanceMenuCandidateId() === candidate.id">
                      <button
                        type="button"
                        (click)="toggleAttendanceMenu(candidate, $event)"
                        class="w-full min-w-[220px] px-4 py-3 rounded-2xl border-2 transition-all text-left shadow-sm hover:shadow-md focus:outline-none focus:ring-4"
                        [ngClass]="getAttendanceButtonClass(candidate.attendance)"
                      >
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex items-center gap-3 min-w-0">
                            <span
                              class="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0"
                              [ngClass]="getAttendanceBadgeClass(candidate.attendance)"
                            >
                              {{ getAttendanceShortLabel(candidate.attendance) }}
                            </span>
                            <div class="min-w-0">
                              <div class="text-[12px] font-black uppercase tracking-widest text-slate-800 truncate">
                                {{ getAttendanceLabel(candidate.attendance) }}
                              </div>
                              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                                {{ candidate.attendance ? 'Arrangement selected' : 'Pick arrangement' }}
                              </div>
                            </div>
                          </div>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="text-slate-400 transition-transform"
                            [class.rotate-180]="attendanceMenuCandidateId() === candidate.id"
                          >
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        </div>
                      </button>

                      <div
                        *ngIf="attendanceMenuCandidateId() === candidate.id"
                        class="absolute left-0 right-0 mt-2 rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden z-30"
                        (click)="$event.stopPropagation()"
                      >
                        <button
                          type="button"
                          class="w-full px-4 py-3 text-left transition-colors border-b border-slate-100"
                          [ngClass]="getAttendanceOptionClass(candidate.attendance, 'remote')"
                          (click)="selectAttendance(candidate, 'remote', $event)"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="min-w-0">
                              <div class="text-[12px] font-black uppercase tracking-widest">Remote</div>
                              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Work from anywhere</div>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          class="w-full px-4 py-3 text-left transition-colors border-b border-slate-100"
                          [ngClass]="getAttendanceOptionClass(candidate.attendance, 'onsite')"
                          (click)="selectAttendance(candidate, 'onsite', $event)"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="min-w-0">
                              <div class="text-[12px] font-black uppercase tracking-widest">On-site</div>
                              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Office based</div>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          class="w-full px-4 py-3 text-left transition-colors border-b border-slate-100"
                          [ngClass]="getAttendanceOptionClass(candidate.attendance, 'hybrid')"
                          (click)="selectAttendance(candidate, 'hybrid', $event)"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="min-w-0">
                              <div class="text-[12px] font-black uppercase tracking-widest">Hybrid</div>
                              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Split schedule</div>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          class="w-full px-4 py-3 text-left transition-colors"
                          [ngClass]="getAttendanceOptionClass(candidate.attendance, 'none')"
                          (click)="selectAttendance(candidate, 'none', $event)"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="min-w-0">
                              <div class="text-[12px] font-black uppercase tracking-widest">No selection</div>
                              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clear arrangement</div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </td>
                  <td class="px-10 py-10">
                    <div *ngIf="candidate.attendance === 'hybrid' && candidate.attendance_schedule">
                      <div class="text-[12px] font-black text-slate-900 uppercase tracking-wider mb-1.5">{{ candidate.attendance_schedule.days.join(', ') }}</div>
                      <div class="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{{ candidate.attendance_schedule.start_time }} - {{ candidate.attendance_schedule.end_time }}</div>
                    </div>
                    <span *ngIf="candidate.attendance !== 'hybrid' || !candidate.attendance_schedule" class="text-[11px] text-slate-300 font-bold italic uppercase tracking-widest">-</span>
                  </td>
                  <td class="px-12 py-10 text-right">
                    <button 
                      *ngIf="candidate.attendance === 'hybrid'"
                      (click)="openScheduleModal(candidate)"
                      class="h-14 px-8 rounded-3xl bg-purple-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-purple-700 transition-all flex items-center gap-2 group active:scale-95 ml-auto">
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                       {{ candidate.attendance_schedule ? 'Edit' : 'Set' }} Schedule
                    </button>
                    <span *ngIf="candidate.attendance !== 'hybrid'" class="text-[11px] text-slate-300 font-bold italic uppercase tracking-widest">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Empty State -->
          <div *ngIf="filteredCandidates().length === 0" class="py-48 text-center">
            <div class="w-24 h-24 mx-auto mb-8 bg-slate-100 rounded-3xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 class="text-3xl font-black text-slate-900 mb-3">No accepted interns</h3>
            <p class="text-slate-500 font-bold uppercase text-[11px] tracking-widest">Accept job applications to see interns here</p>
          </div>
        </div>
      </div>

      <!-- Schedule Modal -->
      <div *ngIf="showScheduleModal()" class="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 transition-all animate-in fade-in duration-300">
        <div class="absolute inset-0 bg-slate-900/70 backdrop-blur-xl" (click)="showScheduleModal.set(false)"></div>
        
        <div class="relative bg-white w-full max-w-2xl max-h-[92vh] rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl shadow-slate-900/30">
          <div class="relative px-10 py-10 bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-between shrink-0 overflow-hidden border-b border-purple-100">
            <div class="absolute inset-0 overflow-hidden">
              <div class="absolute -top-32 -right-32 w-80 h-80 bg-purple-200/40 rounded-full blur-3xl"></div>
              <div class="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-200/40 rounded-full blur-3xl"></div>
            </div>
            <div class="relative z-10">
              <div class="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border border-purple-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Schedule Configuration
              </div>
              <h3 class="text-3xl font-black text-slate-900 tracking-tight">
                {{ selectedCandidate?.attendance_schedule ? 'Edit' : 'Set' }} Hybrid Schedule
              </h3>
              <p class="text-[12px] text-slate-500 font-bold uppercase tracking-widest mt-2">{{ selectedCandidate?.first_name }} {{ selectedCandidate?.last_name }}</p>
            </div>
            <button (click)="showScheduleModal.set(false)" class="relative z-10 w-14 h-14 rounded-2xl bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-all border border-slate-200 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="flex-1 p-10 overflow-y-auto custom-scrollbar space-y-8">
            <!-- Working Days -->
            <div>
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <label class="text-[13px] font-black uppercase tracking-widest text-slate-700">Working Days</label>
              </div>
              <div class="flex flex-wrap gap-3">
                <button 
                  *ngFor="let day of weekDays"
                  (click)="toggleDay(day)"
                  class="px-6 py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest border-2 transition-all hover:scale-105 relative overflow-hidden"
                  [class.bg-gradient-to-br]="selectedDays().includes(day)"
                  [class.from-purple-500]="selectedDays().includes(day)"
                  [class.to-indigo-500]="selectedDays().includes(day)"
                  [class.border-transparent]="selectedDays().includes(day)"
                  [class.text-white]="selectedDays().includes(day)"
                  [class.shadow-xl]="selectedDays().includes(day)"
                  [class.shadow-purple-300]="selectedDays().includes(day)"
                  [class.bg-white]="!selectedDays().includes(day)"
                  [class.border-slate-200]="!selectedDays().includes(day)"
                  [class.text-slate-600]="!selectedDays().includes(day)"
                  [class.hover:bg-slate-50]="!selectedDays().includes(day)">
                  <span class="relative z-10">{{ day }}</span>
                  <div *ngIf="selectedDays().includes(day)" class="absolute inset-0 bg-white/10"></div>
                </button>
              </div>
            </div>

            <!-- Time Range -->
            <div>
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <label class="text-[13px] font-black uppercase tracking-widest text-slate-700">Working Hours</label>
              </div>
              <div class="grid grid-cols-2 gap-6">
                <div class="relative">
                  <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Start Time</label>
                  <div class="relative">
                    <input 
                      type="time" 
                      [(ngModel)]="scheduleStartTime"
                      class="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 text-base font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all bg-white">
                    <div class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    </div>
                  </div>
                </div>
                <div class="relative">
                  <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">End Time</label>
                  <div class="relative">
                    <input 
                      type="time" 
                      [(ngModel)]="scheduleEndTime"
                      class="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 text-base font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all bg-white">
                    <div class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Schedule Preview -->
            <div *ngIf="selectedDays().length > 0" class="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border-2 border-purple-100">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </div>
                <label class="text-[13px] font-black uppercase tracking-widest text-purple-900">Schedule Preview</label>
              </div>
              <div class="space-y-3">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-white text-purple-600 flex items-center justify-center font-black text-sm border border-purple-200">
                    {{ selectedDays().length }}
                  </div>
                  <span class="text-[13px] font-bold text-slate-700">days selected:</span>
                  <span class="text-[13px] font-black text-purple-700 uppercase tracking-wider">{{ selectedDays().join(', ') }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-white text-indigo-600 flex items-center justify-center border border-indigo-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  </div>
                  <span class="text-[13px] font-bold text-slate-700">Time:</span>
                  <span class="text-[13px] font-black text-indigo-700 uppercase tracking-wider">{{ scheduleStartTime }} - {{ scheduleEndTime }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="p-10 border-t border-slate-100 flex justify-end gap-4 shrink-0 bg-slate-50/50">
            <button 
              (click)="showScheduleModal.set(false)"
              class="px-8 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200">
              Cancel
            </button>
            <button 
              (click)="saveSchedule()"
              [disabled]="selectedDays().length === 0"
              [class.opacity-50]="selectedDays().length === 0"
              [class.cursor-not-allowed]="selectedDays().length === 0"
              class="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[12px] font-black uppercase tracking-widest rounded-2xl hover:from-purple-700 hover:to-indigo-700 shadow-xl shadow-purple-500/30 transition-all flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              Save Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CandidatesComponent implements OnInit {
  private apiService = inject(ApiService);

  candidates = signal<Candidate[]>([]);
  filteredCandidates = signal<Candidate[]>([]);
  isLoading = signal(true);
  searchQuery = '';
  attendanceFilter = signal('all');
  attendanceMenuCandidateId = signal<number | null>(null);

  // Schedule Modal
  showScheduleModal = signal(false);
  selectedCandidate: Candidate | null = null;
  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  selectedDays = signal<string[]>([]);
  scheduleStartTime = '09:00';
  scheduleEndTime = '17:00';

  private normalizeStatusValue(status: string | null | undefined): string {
    return String(status || '').trim().toLowerCase();
  }

  private isAcceptedApplication(app: any): boolean {
    const status = this.normalizeStatusValue(app?.status);
    if (status === 'accepted' || status === 'hired') return true;
    return !!app?.accepted_at;
  }

  ngOnInit() {
    this.loadCandidates();
  }

  loadCandidates() {
    this.isLoading.set(true);
    
    // Fetch accepted applications (interns) from API
    this.apiService.get<any>('company/applicants?status=accepted').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const applications = Array.isArray(res.data) ? res.data : [];
          const acceptedApplications = applications.filter((app: any) => this.isAcceptedApplication(app));

          // Transform applications into candidates
          const interns = acceptedApplications.map((app: any) => ({
            id: app.id,
            first_name: app.candidate?.first_name || '',
            last_name: app.candidate?.last_name || '',
            email: app.candidate?.email || '',
            phone: app.candidate?.phone,
            position: 'Intern',
            department: app.job_offer?.department?.name || '',
            job_offer_title: app.job_offer?.title || '',
            accepted_at: app.updated_at,
            attendance: app.attendance || null,
            attendance_schedule: app.attendance_schedule || null,
            avatar: app.candidate?.picture
          }));
          this.candidates.set(interns);
          this.filterCandidates();
        } else {
          this.candidates.set([]);
          this.filteredCandidates.set([]);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading interns:', err);
        this.candidates.set([]);
        this.filteredCandidates.set([]);
        this.isLoading.set(false);
      }
    });
  }

  filterCandidates() {
    let filtered = this.candidates();

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.first_name.toLowerCase().includes(query) ||
        c.last_name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.position?.toLowerCase().includes(query) ||
        c.job_offer_title?.toLowerCase().includes(query)
      );
    }

    if (this.attendanceFilter() && this.attendanceFilter() !== 'all') {
      filtered = filtered.filter(c => c.attendance === this.attendanceFilter());
    }

    this.filteredCandidates.set(filtered);
  }

  getInitials(candidate: Candidate): string {
    return (candidate.first_name[0] + candidate.last_name[0]).toUpperCase();
  }

  toggleAttendanceMenu(candidate: Candidate, event: Event): void {
    event.stopPropagation();
    const currentOpenId = this.attendanceMenuCandidateId();
    this.attendanceMenuCandidateId.set(currentOpenId === candidate.id ? null : candidate.id);
  }

  selectAttendance(candidate: Candidate, value: AttendanceType | 'none', event: Event): void {
    event.stopPropagation();

    if (value === 'none') {
      candidate.attendance = null;
      candidate.attendance_schedule = null;
    } else {
      candidate.attendance = value;
      if (value !== 'hybrid') {
        candidate.attendance_schedule = null;
      }
    }

    this.attendanceMenuCandidateId.set(null);
    this.updateAttendance(candidate);
    this.filterCandidates();
  }

  getAttendanceLabel(attendance: AttendanceType | null | undefined): string {
    if (attendance === 'remote') return 'Remote';
    if (attendance === 'onsite') return 'On-site';
    if (attendance === 'hybrid') return 'Hybrid';
    return 'No selection';
  }

  getAttendanceShortLabel(attendance: AttendanceType | null | undefined): string {
    if (attendance === 'remote') return 'REM';
    if (attendance === 'onsite') return 'ONS';
    if (attendance === 'hybrid') return 'HYB';
    return '--';
  }

  getAttendanceButtonClass(attendance: AttendanceType | null | undefined): string {
    if (attendance === 'remote') {
      return 'border-blue-200 bg-blue-50/80 hover:border-blue-300 focus:ring-blue-100';
    }
    if (attendance === 'onsite') {
      return 'border-indigo-200 bg-indigo-50/80 hover:border-indigo-300 focus:ring-indigo-100';
    }
    if (attendance === 'hybrid') {
      return 'border-violet-200 bg-violet-50/80 hover:border-violet-300 focus:ring-violet-100';
    }
    return 'border-slate-200 bg-white hover:border-slate-300 focus:ring-slate-100';
  }

  getAttendanceBadgeClass(attendance: AttendanceType | null | undefined): string {
    if (attendance === 'remote') return 'bg-blue-600 text-white';
    if (attendance === 'onsite') return 'bg-indigo-600 text-white';
    if (attendance === 'hybrid') return 'bg-violet-600 text-white';
    return 'bg-slate-200 text-slate-500';
  }

  getAttendanceOptionClass(current: AttendanceType | null | undefined, option: AttendanceType | 'none'): string {
    if (option === 'none') {
      return !current
        ? 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
        : 'text-slate-700 hover:bg-slate-50';
    }

    if (current !== option) {
      return 'text-slate-700 hover:bg-slate-50';
    }

    if (option === 'remote') {
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200';
    }
    if (option === 'onsite') {
      return 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200';
    }
    return 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200';
  }

  @HostListener('document:click')
  closeAttendanceMenu(): void {
    this.attendanceMenuCandidateId.set(null);
  }

  updateAttendance(candidate: Candidate) {
    // Save attendance type immediately
    this.saveCandidateAttendance(candidate);
    
    // If changed to hybrid without schedule, open modal
    if (candidate.attendance === 'hybrid' && !candidate.attendance_schedule) {
      setTimeout(() => this.openScheduleModal(candidate), 100);
    }
  }

  openScheduleModal(candidate: Candidate) {
    this.selectedCandidate = candidate;
    this.selectedDays.set(candidate.attendance_schedule?.days || []);
    this.scheduleStartTime = candidate.attendance_schedule?.start_time || '09:00';
    this.scheduleEndTime = candidate.attendance_schedule?.end_time || '17:00';
    this.showScheduleModal.set(true);
  }

  toggleDay(day: string) {
    const current = this.selectedDays();
    if (current.includes(day)) {
      this.selectedDays.set(current.filter(d => d !== day));
    } else {
      this.selectedDays.set([...current, day]);
    }
  }

  saveSchedule() {
    if (this.selectedCandidate) {
      this.selectedCandidate.attendance_schedule = {
        days: this.selectedDays(),
        start_time: this.scheduleStartTime,
        end_time: this.scheduleEndTime
      };
      this.saveCandidateAttendance(this.selectedCandidate);
    }
    this.showScheduleModal.set(false);
    this.selectedCandidate = null;
  }

  saveCandidateAttendance(candidate: Candidate) {
    this.apiService.patch(`company/applications/${candidate.id}/attendance`, {
      attendance: candidate.attendance,
      attendance_schedule: candidate.attendance_schedule
    }).subscribe({
      next: () => {
        console.log('Attendance saved for intern', candidate.id);
      },
      error: (err) => {
        console.error('Error saving attendance:', err);
      }
    });
  }
}


