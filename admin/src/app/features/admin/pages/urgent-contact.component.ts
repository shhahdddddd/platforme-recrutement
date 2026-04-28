import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
    selector: 'app-admin-urgent-contact',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="p-8 font-['Outfit'] min-h-screen bg-white rounded-[40px] overflow-hidden">
      <div class="mb-10 flex justify-between items-end">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Urgent <span class="text-blue-600">Reports</span></h1>
          <p class="text-slate-500 font-medium mt-1">Manage and resolve company technical or billing reports.</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100 shadow-sm">
             {{ contacts().length }} Total Messages
          </span>
        </div>
      </div>

      <!-- Horizontal List Layout -->
      <div class="flex flex-col gap-4">
        <div *ngFor="let contact of contacts()" 
             class="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/30 border-2 transition-all hover:bg-slate-50 group flex flex-wrap lg:flex-nowrap items-center gap-6"
             [class.border-emerald-500/10]="contact.status === 'solved'"
             [class.border-slate-50]="contact.status === 'en attente'">
          
          <!-- Company info (Logo + Names) -->
          <div class="flex items-center gap-4 w-full lg:w-72 shrink-0">
            <div class="w-14 h-14 rounded-[20px] bg-slate-900 overflow-hidden shadow-lg shrink-0">
               <img *ngIf="contact.company?.picture" [src]="contact.company.picture" class="w-full h-full object-cover" />
               <div *ngIf="!contact.company?.picture" class="w-full h-full flex items-center justify-center text-white font-black text-sm">
                  {{ contact.company?.name?.substring(0,2).toUpperCase() }}
               </div>
            </div>
            <div class="overflow-hidden">
              <h3 class="font-black text-slate-900 text-sm truncate uppercase tracking-tight">{{ contact.company?.name }}</h3>
              <p class="text-[10px] text-slate-400 font-bold truncate">{{ contact.company?.user?.email }}</p>
            </div>
          </div>

          <!-- Problem Category -->
          <div class="w-40 shrink-0">
            <span class="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 block mb-1">Issue Category</span>
            <span class="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
               {{ contact.problem_type }}
            </span>
          </div>

          <!-- Description -->
          <div class="flex-1 min-w-[200px]">
            <span class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">Description</span>
            <p class="text-slate-600 font-medium text-xs leading-relaxed line-clamp-2 italic border-l-2 border-slate-100 pl-4">
              "{{ contact.description }}"
            </p>
          </div>

          <!-- Status & Date -->
          <div class="w-48 shrink-0 flex flex-col items-end gap-1">
             <span *ngIf="contact.status === 'en attente'" 
                   class="px-4 py-1.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                <span class="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span>
                En Attente
             </span>
             <span *ngIf="contact.status === 'solved'" 
                   class="px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Solved Request
             </span>
             <span class="text-[9px] font-bold text-slate-300">{{ contact.created_at | date:'MMM d, HH:mm' }}</span>
          </div>

          <!-- Actions -->
          <div class="w-full lg:w-auto flex justify-end shrink-0">
            <button *ngIf="contact.status === 'en attente'"
                    (click)="resolveReport(contact.id)"
                    [disabled]="isUpdating() === contact.id"
                    class="h-10 px-6 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-slate-900/10">
              <span *ngIf="isUpdating() === contact.id" class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Resolve
            </button>

            <button *ngIf="contact.status === 'solved'"
                    (click)="reopenReport(contact.id)"
                    [disabled]="isUpdating() === contact.id"
                    class="h-10 px-6 border-2 border-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-slate-50 hover:text-amber-600 transition-all active:scale-95 disabled:opacity-50">
              Re-open
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="contacts().length === 0 && !isLoading()" 
           class="py-40 flex flex-col items-center justify-center text-center opacity-30">
        <div class="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <p class="font-black uppercase tracking-[0.3em] text-sm">Inbox Zero</p>
        <p class="font-medium mt-2">No urgent messages from enterprise partners.</p>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading()" class="py-40 flex justify-center">
        <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  `
})
export class UrgentContactComponent implements OnInit {
    private apiService = inject(ApiService);
    private notificationService = inject(NotificationService);

    contacts = signal<any[]>([]);
    isLoading = signal(false);
    isUpdating = signal<number | null>(null);

    ngOnInit() {
        this.loadContacts();
    }

    loadContacts() {
        this.isLoading.set(true);
        this.apiService.get<any>('admin/urgent-contacts').subscribe({
            next: (res) => {
                this.contacts.set(res.data);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error('Error loading contacts', err);
                this.isLoading.set(false);
            }
        });
    }

    resolveReport(id: number) {
        this.updateStatus(id, 'solved');
    }

    reopenReport(id: number) {
        this.updateStatus(id, 'en attente');
    }

    updateStatus(id: number, status: string) {
        this.isUpdating.set(id);
        this.apiService.post(`admin/urgent-contacts/${id}/status`, { status, _method: 'PATCH' }).subscribe({
            next: (res: any) => {
                this.isUpdating.set(null);
                if (res.success) {
                    this.notificationService.success(`Report marked as ${status}`);
                    this.loadContacts();
                }
            },
            error: (err) => {
                this.isUpdating.set(null);
                this.notificationService.error('Failed to update status.');
                console.error(err);
            }
        });
    }
}
