import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface KBDocument {
  id: string;
  original_filename: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  created_at: string;
  total_sections?: number;
  error_message?: string | null;
}

@Component({
  selector: 'app-kb-management',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto py-10 px-6 font-['Outfit']">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 class="text-4xl font-black text-slate-900 tracking-tight">Technical <span class="text-blue-600">Knowledge Base</span></h1>
          <p class="text-slate-500 font-medium mt-2">Train the AI on your technical documentation to generate accurate skill assessments.</p>
        </div>
        
        <div class="flex items-center gap-3">
          <input #fileInput type="file" multiple (change)="onUpload($event)" accept="application/pdf" class="hidden">
          <button (click)="fileInput.click()" [disabled]="isUploading()"
                  class="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-3 shadow-2xl shadow-slate-900/20 disabled:opacity-50">
            <svg *ngIf="!isUploading()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div *ngIf="isUploading()" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {{ isUploading() ? 'Uploading...' : 'Ingest Documentation' }}
          </button>
        </div>
      </div>

      <!-- Overview Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20">
          <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Documents</p>
          <p class="text-2xl font-black text-slate-900">{{ documents().length }}</p>
        </div>
        
        <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20">
          <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          </div>
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Indexed Sections</p>
          <p class="text-2xl font-black text-slate-900">{{ totalSections() }}</p>
        </div>

        <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20">
          <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </div>
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">RAG Readiness</p>
          <p class="text-2xl font-black text-slate-900">{{ readinessScore() }}%</p>
        </div>

        <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20">
          <div class="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7"/><path d="M16 5V3"/><path d="M8 5V3"/><path d="M3 9h18"/><path d="M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="m15 19 2 2 4-4"/></svg>
          </div>
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Storage Usage</p>
          <p class="text-2xl font-black text-slate-900">4.2 MB / 500 MB</p>
        </div>
      </div>

      <!-- Documents Table -->
      <div class="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
        <div class="p-8 border-b border-slate-50 flex items-center justify-between">
          <h2 class="text-lg font-black text-slate-900 tracking-tight">Managed Documentation</h2>
          <div class="flex items-center gap-2">
             <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
             <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto-indexing active</span>
          </div>
        </div>

        <div *ngIf="isLoading()" class="p-20 text-center">
            <div class="inline-block w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p class="mt-4 text-slate-400 font-bold text-xs uppercase tracking-widest">Synching Knowledge Base...</p>
        </div>

        <div *ngIf="!isLoading() && documents().length === 0" class="p-24 text-center">
          <div class="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <h3 class="text-xl font-black text-slate-900">Your Knowledge Base is Empty</h3>
          <p class="text-slate-500 mt-2 font-medium max-w-sm mx-auto">Upload PDF documentation like coding standards, architecture docs, or library guides to start.</p>
          <button (click)="fileInput.click()" class="mt-8 px-8 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Ingest Documentation</button>
        </div>

        <div *ngIf="!isLoading() && documents().length > 0" class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/50">
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Document</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Status</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Sections</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Date</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of documents()" class="group hover:bg-slate-50/80 transition-all border-b border-slate-50 last:border-0">
                <td class="px-8 py-6">
                  <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-slate-900 truncate max-w-[200px]">{{ doc.original_filename }}</p>
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">PDF RESOURCE</p>
                    </div>
                  </div>
                </td>
                <td class="px-8 py-6">
                  <div [ngClass]="{
                    'bg-slate-100 text-slate-600': doc.status === 'pending',
                    'bg-blue-100 text-blue-600': doc.status === 'processing',
                    'bg-emerald-100 text-emerald-600': doc.status === 'ready',
                    'bg-red-100 text-red-600': doc.status === 'failed'
                  }" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter">
                    <span *ngIf="doc.status === 'processing'" class="w-2 h-2 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                    <span *ngIf="doc.status !== 'processing'" class="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {{ doc.status }}
                  </div>
                  <p *ngIf="doc.status === 'failed' && doc.error_message" class="mt-2 max-w-xs text-xs font-medium text-red-500 break-words">
                    {{ doc.error_message }}
                  </p>
                </td>
                <td class="px-8 py-6">
                  <span class="text-sm font-bold text-slate-600">{{ doc.total_sections || '--' }}</span>
                </td>
                <td class="px-8 py-6">
                  <span class="text-xs font-semibold text-slate-400">{{ doc.created_at | date:'MMM d, HH:mm' }}</span>
                </td>
                <td class="px-8 py-6 text-right">
                   <button (click)="openDeleteModal(doc.id, $event)" class="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-90 group/delete">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="group-hover/delete:scale-110 transition-transform"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                   </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div *ngIf="deleteModalOpen()" class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="closeDeleteModal()">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fadeIn"></div>
        
        <!-- Modal -->
        <div class="relative bg-white rounded-[2rem] shadow-2xl shadow-slate-900/20 max-w-md w-full overflow-hidden transform transition-all animate-scaleIn" (click)="$event.stopPropagation()">
          <!-- Header with gradient -->
          <div class="relative px-8 pt-8 pb-6 bg-gradient-to-br from-red-500 via-rose-500 to-pink-500">
            <!-- Decorative circles -->
            <div class="absolute top-4 right-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
            <div class="absolute bottom-2 left-6 w-12 h-12 bg-white/10 rounded-full blur-lg"></div>
            
            <!-- Warning Icon -->
            <div class="relative w-16 h-16 mx-auto bg-white rounded-2xl shadow-lg shadow-red-500/30 flex items-center justify-center mb-4 transform -rotate-3 hover:rotate-0 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            
            <h3 class="text-center text-xl font-black text-white tracking-tight">Delete Document?</h3>
            <p class="text-center text-white/80 text-sm mt-1 font-medium">This action cannot be undone</p>
          </div>
          
          <!-- Body -->
          <div class="px-8 py-6">
            <div class="bg-red-50 rounded-xl p-4 border border-red-100">
              <div class="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <p class="text-sm text-red-700 font-medium leading-relaxed">
                  Permanent deletion will remove all associated AI context, embeddings, and quiz questions derived from this document.
                </p>
              </div>
            </div>
            
            <p class="text-slate-500 text-sm mt-4 text-center">
              Are you sure you want to continue?
            </p>
          </div>
          
          <!-- Footer -->
          <div class="px-8 pb-8 flex gap-3">
            <button 
              (click)="closeDeleteModal()"
              [disabled]="isDeleting()"
              class="flex-1 h-12 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              Cancel
            </button>
            <button 
              (click)="confirmDelete()"
              [disabled]="isDeleting()"
              class="flex-1 h-12 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold text-sm shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-600 hover:to-rose-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <div *ngIf="isDeleting()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {{ isDeleting() ? 'Deleting...' : 'Delete Document' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class KBManagementComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private notifications = inject(NotificationService);
  
  // The AI microservice URL - configured in environment
  private aiBaseUrl = 'http://127.0.0.1:8002/api';

  documents = signal<KBDocument[]>([]);
  isLoading = signal(false);
  isUploading = signal(false);
  deleteModalOpen = signal(false);
  deleteTargetId = signal<string | null>(null);
  isDeleting = signal(false);
  private pollSub?: Subscription;

  ngOnInit(): void {
    this.loadDocuments();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  loadDocuments(): void {
    this.isLoading.set(true);
    this.http.get<any>(`${this.aiBaseUrl}/documents/upload/`).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const docs = Array.isArray(res) ? res : (res.data || []);
        this.documents.set(docs);
        
        // Reset uploading state if all documents are indexed
        if (this.isUploading() && !docs.some((d: any) => d.status === 'processing' || d.status === 'pending')) {
          this.isUploading.set(false);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('KB Load Error:', err);
      }
    });
  }

  startPolling(): void {
    this.pollSub = interval(5000)
      .pipe(switchMap(() => this.http.get<any>(`${this.aiBaseUrl}/documents/upload/`)))
      .subscribe({
        next: (res) => {
          const docs = Array.isArray(res) ? res : (res.data || []);
          this.documents.set(docs);

          // Auto-stop the "Uploading" spinner when processing finishing
          const stillProcessing = docs.some((d: any) => d.status === 'processing' || d.status === 'pending');
          if (this.isUploading() && !stillProcessing) {
            this.isUploading.set(false);
          }
        },
        error: (err) => console.error('KB Poll Error:', err)
      });
  }

  onUpload(event: any): void {
    const files = event.target.files as FileList;
    if (files.length === 0) return;

    const formData = new FormData();
    formData.append('file', files[0]); // Using single file for now
    formData.append('company_id', '1'); // Fallback company ID

    this.isUploading.set(true);
    this.http.post<any>(`${this.aiBaseUrl}/documents/upload/`, formData).subscribe({
      next: (res) => {
        this.isUploading.set(true); // show spinner during processing
        this.notifications.success('Documentation ingestion started.');
        this.loadDocuments();
        event.target.value = '';
      },
      error: (err) => {
        this.isUploading.set(false);
        this.notifications.error('Upload failed. Check server status.');
        event.target.value = '';
      }
    });
  }

  openDeleteModal(id: string, event?: Event): void {
    event?.stopPropagation();
    this.deleteTargetId.set(id);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.deleteTargetId.set(null);
    this.isDeleting.set(false);
  }

  confirmDelete(): void {
    const id = this.deleteTargetId();
    if (!id) return;
    
    this.isDeleting.set(true);
    this.http.delete(`${this.aiBaseUrl}/documents/${id}/`, { observe: 'response' }).subscribe({
        next: (response) => {
            if (response.status === 204 || response.status === 200) {
                this.notifications.success('Document removed.');
                this.closeDeleteModal();
                this.loadDocuments();
            }
        },
        error: (err) => {
            // Check if it's actually a success (204 No Content)
            if (err.status === 204) {
                this.notifications.success('Document removed.');
                this.closeDeleteModal();
                this.loadDocuments();
            } else {
                this.notifications.error('Unable to delete the document.');
                this.isDeleting.set(false);
            }
        }
    });
  }

  totalSections(): number {
    return this.documents().reduce((acc, doc) => acc + (doc.total_sections || 0), 0);
  }

  readinessScore(): number {
    const total = this.documents().length;
    if (total === 0) return 0;
    const ready = this.documents().filter(d => d.status === 'ready').length;
    return Math.round((ready / total) * 100);
  }
}
