import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-recruiter-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-50 pb-20 font-['Outfit']">
      <div class="h-60 w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
      </div>

      <div class="container mx-auto px-6 -mt-20 relative z-10">
        <div class="mb-6">
          <a routerLink="/company/recruiters" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-700 font-bold border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Recruiters
          </a>
        </div>

        <div *ngIf="isLoading()" class="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-12 text-center">
          <div class="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p class="mt-4 text-slate-500 font-bold">Loading recruiter profile...</p>
        </div>

        <div *ngIf="!isLoading() && recruiter() as rec" class="flex flex-col md:flex-row items-end gap-8 mb-8">
          <div class="relative">
            <div class="w-40 h-40 rounded-3xl bg-white p-1.5 shadow-2xl relative overflow-hidden">
              <img [src]="pictureUrl(rec.picture, rec.full_name)" class="w-full h-full object-cover rounded-2xl bg-slate-50" alt="Recruiter photo" (error)="onPictureError($event, rec.full_name)">
            </div>
          </div>

          <div class="flex-1 pb-4 text-center md:text-left">
            <h1 class="text-4xl font-black text-slate-900 mb-2 drop-shadow-sm">{{ rec.full_name }}</h1>
            <div class="flex flex-wrap gap-3 justify-center md:justify-start">
              <span class="px-4 py-2 rounded-xl bg-blue-50 text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] border border-blue-100 shadow-sm">
                Recruiter
              </span>
              <span class="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] border border-slate-200/50">
                {{ rec.department?.name || 'No Department' }}
              </span>
              <span class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border"
                    [class.bg-emerald-500]="rec.user?.is_active"
                    [class.text-white]="rec.user?.is_active"
                    [class.border-emerald-500]="rec.user?.is_active"
                    [class.bg-rose-100]="!rec.user?.is_active"
                    [class.text-rose-600]="!rec.user?.is_active"
                    [class.border-rose-200]="!rec.user?.is_active">
                {{ rec.user?.is_active ? 'Active' : 'Deactivated' }}
              </span>
            </div>
          </div>

          <div class="flex gap-3 pb-4">
            <button (click)="toggleStatus()" [disabled]="isToggling()" class="px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 border"
                    [class.bg-rose-50]="rec.user?.is_active"
                    [class.text-rose-600]="rec.user?.is_active"
                    [class.border-rose-100]="rec.user?.is_active"
                    [class.hover:bg-rose-100]="rec.user?.is_active"
                    [class.bg-emerald-50]="!rec.user?.is_active"
                    [class.text-emerald-600]="!rec.user?.is_active"
                    [class.border-emerald-100]="!rec.user?.is_active"
                    [class.hover:bg-emerald-100]="!rec.user?.is_active">
              <span *ngIf="isToggling()" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              {{ rec.user?.is_active ? 'Deactivate Recruiter' : 'Reactivate Recruiter' }}
            </button>
          </div>
        </div>

        <div *ngIf="!isLoading() && recruiter() as rec" class="flex justify-center">
          <div class="w-full max-w-5xl">
            <div class="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
              <h2 class="text-xl font-black text-slate-800 mb-6 flex items-center justify-center gap-2 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Recruiter Overview
              </h2>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</div>
                  <div class="font-bold text-slate-900 break-all">{{ rec.user?.email || '-' }}</div>
                </div>
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone Number</div>
                  <div class="font-bold text-slate-900">{{ rec.phone || 'Not provided' }}</div>
                </div>
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Department</div>
                  <div class="font-bold text-slate-900">{{ rec.department?.name || '-' }}</div>
                </div>
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Company</div>
                  <div class="font-bold text-slate-900">{{ rec.company?.name || '-' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RecruiterProfileComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private readonly recruiterIdStorageKey = 'company_selected_recruiter_id';

  recruiter = signal<any>(null);
  isLoading = signal(true);
  isToggling = signal(false);

  ngOnInit(): void {
    const recruiterId = this.resolveRecruiterId();
    if (!recruiterId) {
      this.isLoading.set(false);
      this.notifications.error('Open a recruiter profile from the recruiters page.');
      this.router.navigate(['/company/recruiters']);
      return;
    }

    this.loadRecruiter(String(recruiterId));
  }

  private resolveRecruiterId(): number | null {
    const routeId = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(routeId) && routeId > 0) {
      sessionStorage.setItem(this.recruiterIdStorageKey, String(routeId));
      return routeId;
    }

    const stateId = Number(window.history.state?.recruiterId);
    if (Number.isFinite(stateId) && stateId > 0) {
      sessionStorage.setItem(this.recruiterIdStorageKey, String(stateId));
      return stateId;
    }

    const storedId = Number(sessionStorage.getItem(this.recruiterIdStorageKey));
    if (Number.isFinite(storedId) && storedId > 0) {
      return storedId;
    }

    return null;
  }

  loadRecruiter(id: string) {
    this.isLoading.set(true);
    this.api.get<any>(`company/recruiters/${id}`).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res?.success) {
          this.recruiter.set(res.data);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.notifications.error(err?.error?.message || 'Failed to load recruiter profile.');
      }
    });
  }

  toggleStatus() {
    const rec = this.recruiter();
    if (!rec?.id || this.isToggling()) {
      return;
    }

    this.isToggling.set(true);
    this.api.patch<any>(`company/recruiters/${rec.id}/toggle-status`, {}).subscribe({
      next: (res) => {
        this.isToggling.set(false);
        if (res?.success) {
          this.recruiter.update((current: any) => ({
            ...current,
            user: {
              ...current?.user,
              is_active: res.is_active
            }
          }));
          this.notifications.success(res.message || 'Recruiter status updated.');
        }
      },
      error: (err) => {
        this.isToggling.set(false);
        this.notifications.error(err?.error?.message || 'Failed to update recruiter status.');
      }
    });
  }

  pictureUrl(raw?: string | null, fullName: string = 'Recruiter'): string {
    const fallback = this.avatarFallback(fullName);
    if (!raw || typeof raw !== 'string') return fallback;
    if (/^https?:\/\//i.test(raw)) return raw;
    const apiHost = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${apiHost}/${raw.replace(/^\/+/, '')}`;
  }

  onPictureError(event: any, fullName: string) {
    event.target.src = this.avatarFallback(fullName);
  }

  private avatarFallback(fullName: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'R')}&size=256&background=3b82f6&color=fff&bold=true&font-size=0.4`;
  }
}
