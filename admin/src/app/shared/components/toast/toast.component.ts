import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <div 
        *ngFor="let toast of notificationService.notifications()" 
        (click)="notificationService.remove(toast.id)"
        class="group pointer-events-auto cursor-pointer relative overflow-hidden flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/10 animate-in slide-in-from-right-full duration-300"
        [ngClass]="{
          'bg-emerald-500/90 text-white': toast.type === 'success',
          'bg-red-500/90 text-white': toast.type === 'error',
          'bg-blue-500/90 text-white': toast.type === 'info',
          'bg-amber-500/90 text-white': toast.type === 'warning'
        }"
      >
        <!-- Progress Bar -->
        <div class="absolute bottom-0 left-0 h-1 bg-white/30 w-full animate-toast-progress"></div>

        <!-- Icons -->
        <div class="shrink-0">
          <svg *ngIf="toast.type === 'success'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <svg *ngIf="toast.type === 'error'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <svg *ngIf="toast.type === 'info'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <svg *ngIf="toast.type === 'warning'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>

        <div class="flex-1 font-['Outfit']">
          <p class="text-[14px] font-bold tracking-wide">{{ toast.message }}</p>
        </div>

        <button class="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors leading-[0]">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-50 hover:opacity-100"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    @keyframes toast-progress {
      from { width: 100%; }
      to { width: 0%; }
    }
    .animate-toast-progress {
      animation: toast-progress 5s linear forwards;
    }
  `]
})
export class ToastComponent {
  notificationService = inject(NotificationService);
}
