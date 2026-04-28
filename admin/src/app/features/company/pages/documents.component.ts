import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

interface CompanyDocument {
  id: number;
  original_name: string;
  file_size: number;
  download_url: string;
  created_at: string;
}

@Component({
  selector: 'app-company-documents',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto py-10 px-6 font-['Outfit']">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 class="text-4xl font-black text-slate-900 tracking-tight">Enterprise <span class="text-blue-600">Documents</span></h1>
          <p class="text-slate-500 font-medium mt-2">Upload and manage your company's PDF documents for HR reference.</p>
        </div>
        
        <div class="flex items-center gap-3">
            <button (click)="fileInput.click()" [disabled]="isUploading()" 
                    class="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-3 shadow-xl shadow-blue-500/20 disabled:opacity-50">
                <svg *ngIf="!isUploading()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <div *ngIf="isUploading()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {{ isUploading() ? 'Uploading...' : 'Upload PDFs' }}
            </button>
            <input #fileInput type="file" multiple (change)="onFileSelected($event)" accept="application/pdf" class="hidden">
        </div>
      </div>

      <!-- Stats / Overview cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20 flex items-center gap-5">
              <div class="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div>
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Documents</p>
                  <p class="text-2xl font-black text-slate-900">{{ documents().length }}</p>
              </div>
          </div>
          
          <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20 flex items-center gap-5">
              <div class="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div>
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Size</p>
                  <p class="text-2xl font-black text-slate-900">{{ formatTotalSize() }}</p>
              </div>
          </div>

          <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20 flex items-center gap-5">
              <div class="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              </div>
              <div>
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">File Type</p>
                  <p class="text-2xl font-black text-slate-900">PDF Only</p>
              </div>
          </div>
      </div>

      <!-- Main Documents List -->
      <div class="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
        <div class="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <h2 class="text-lg font-black text-slate-900">Document Library</h2>
            <button (click)="loadDocuments()" class="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-blue-600 active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            </button>
        </div>

        <div *ngIf="isLoading()" class="p-20 text-center">
            <div class="inline-block w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p class="mt-4 text-slate-400 font-bold text-xs uppercase tracking-widest">Fetching your documents...</p>
        </div>

        <div *ngIf="!isLoading() && documents().length === 0" class="p-20 text-center">
            <div class="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M9 11h6"/><path d="M9 19h6"/></svg>
            </div>
            <h3 class="text-xl font-black text-slate-900">No documents found</h3>
            <p class="text-slate-500 mt-2 font-medium">Start by uploading your first enterprise PDF document.</p>
            <button (click)="fileInput.click()" class="mt-8 px-8 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-xl shadow-slate-900/20 active:scale-95 transition-all">Upload First Document</button>
        </div>

        <div *ngIf="!isLoading() && documents().length > 0" class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/30">
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Document Name</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Size</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Uploaded On</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of documents()" class="group hover:bg-blue-50/30 transition-all border-b border-slate-50 last:border-0 font-['Outfit']">
                <td class="px-8 py-5">
                  <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div>
                      <p class="text-sm font-black text-slate-900">{{ doc.original_name }}</p>
                      <p class="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">PDF Document</p>
                    </div>
                  </div>
                </td>
                <td class="px-8 py-5">
                  <span class="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black tracking-tight">
                    {{ formatSize(doc.file_size) }}
                  </span>
                </td>
                <td class="px-8 py-5">
                  <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span class="text-xs font-bold text-slate-600">{{ formatDate(doc.created_at) }}</span>
                  </div>
                </td>
                <td class="px-8 py-5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <a [href]="doc.download_url" target="_blank" class="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-white hover:text-blue-600 hover:shadow-md transition-all active:scale-95" title="Download">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                    <button (click)="deleteDocument(doc.id)" class="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-white hover:text-red-500 hover:shadow-md transition-all active:scale-95" title="Delete">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class CompanyDocumentsComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);

  documents = signal<CompanyDocument[]>([]);
  isLoading = signal(false);
  isUploading = signal(false);

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.isLoading.set(true);
    this.api.get<any>('company/documents').subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.documents.set(res.data || []);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.notifications.error(err?.error?.message || 'Failed to load documents.');
      }
    });
  }

  onFileSelected(event: any): void {
    const files = event.target.files as FileList;
    if (files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('documents[]', files[i]);
    }

    this.isUploading.set(true);
    this.api.post<any>('company/documents/upload', formData).subscribe({
      next: (res) => {
        this.isUploading.set(false);
        this.notifications.success(res.message || 'Documents uploaded successfully.');
        this.loadDocuments();
        event.target.value = ''; // Reset input
      },
      error: (err) => {
        this.isUploading.set(false);
        this.notifications.error(err?.error?.message || 'Failed to upload documents.');
        event.target.value = '';
      }
    });
  }

  deleteDocument(id: number): void {
    if (!confirm('Are you sure you want to delete this document?')) return;

    this.api.delete<any>(`company/documents/${id}`).subscribe({
      next: (res) => {
        this.notifications.success(res.message || 'Document deleted.');
        this.loadDocuments();
      },
      error: (err) => {
        this.notifications.error(err?.error?.message || 'Failed to delete document.');
      }
    });
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatTotalSize(): string {
    const total = this.documents().reduce((acc, doc) => acc + doc.file_size, 0);
    return this.formatSize(total);
  }

  formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateStr;
    }
  }
}
