import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TokenService } from '../../../core/services/token.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-staff-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 pb-20 font-['Outfit']">
      <div class="h-60 w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
      </div>

      <div class="container mx-auto px-6 -mt-20 relative z-10">
        <div class="flex flex-col md:flex-row items-end gap-8 mb-8">
          <div class="relative group">
            <div class="w-40 h-40 rounded-3xl bg-white p-1.5 shadow-2xl relative overflow-hidden">
              <img [src]="pictureUrl()"
                   class="w-full h-full object-cover rounded-2xl bg-slate-50"
                   alt="Profile picture"
                   (error)="onPictureError($event)">
              <label class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                <span class="text-white text-xs font-bold uppercase tracking-wider">Change Photo</span>
                <input type="file" (change)="onFileSelected($event)" class="hidden" accept=".jpg,.jpeg,.png">
              </label>
            </div>
            <div *ngIf="isUploading()" class="absolute inset-0 bg-white/80 flex items-center justify-center rounded-3xl z-20">
              <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>

          <div class="flex-1 pb-4 text-center md:text-left">
            <h1 class="text-4xl font-black text-white mb-2 drop-shadow-md tracking-tight">{{ displayName() }}</h1>
            <div class="flex flex-wrap gap-3 justify-center md:justify-start items-center">
              <span class="px-4 py-2 rounded-xl bg-blue-600/20 text-blue-100 backdrop-blur-xl text-[10px] font-black uppercase tracking-[0.2em] border border-blue-400/30 shadow-sm">
                {{ currentRole() }}
              </span>
              <span *ngIf="departmentName()" class="px-4 py-2 rounded-xl bg-white/10 text-slate-100 backdrop-blur-xl text-[10px] font-black uppercase tracking-[0.2em] border border-white/20">
                {{ departmentName() }}
              </span>
              <span *ngIf="companyName()" class="px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-100 backdrop-blur-xl text-[10px] font-black uppercase tracking-[0.2em] border border-emerald-400/30 shadow-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4"/><path d="M5 21V10.85"/><path d="M19 21V10.85"/><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/></svg>
                {{ companyName() }}
              </span>
            </div>
            <div class="mt-4 text-sm text-slate-200 font-bold uppercase tracking-widest">{{ user()?.email }}</div>
          </div>

          <div class="flex gap-3 pb-4">
            <button (click)="toggleEdit()" class="px-6 py-3 rounded-xl bg-white text-slate-900 font-bold shadow-lg hover:bg-slate-50 transition-all flex items-center gap-2 border border-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                {{ isEditing() ? 'Cancel Editing' : 'Edit Profile' }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="lg:col-span-2 space-y-8">
            <div class="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 min-h-[400px]">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-black text-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  Profile Details
                </h2>
              </div>

              <!-- View Mode -->
              <div *ngIf="!isEditing()" class="space-y-8 animate-in fade-in zoom-in-95">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Display Name</label>
                    <p class="text-lg font-bold text-slate-900">{{ displayName() }}</p>
                  </div>
                  <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Email Address</label>
                    <p class="text-lg font-bold text-slate-900">{{ user()?.email }}</p>
                  </div>
                  <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Phone Number</label>
                    <p class="text-lg font-bold text-slate-900">{{ user()?.profile?.phone || 'Not provided' }}</p>
                  </div>
                  <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Department</label>
                    <p class="text-lg font-bold text-slate-900">{{ departmentName() || 'N/A' }}</p>
                  </div>
                </div>
                <div *ngIf="companyName()" class="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Company Affiliation</label>
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center border border-slate-200">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><path d="M3 21h18"/><path d="M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4"/><path d="M5 21V10.85"/><path d="M19 21V10.85"/><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/></svg>
                        </div>
                        <div>
                            <p class="font-black text-slate-900">{{ companyName() }}</p>
                            <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">Verified Member</p>
                        </div>
                    </div>
                </div>
              </div>

              <!-- Edit Mode -->
              <form *ngIf="isEditing()" [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="space-y-6 animate-in fade-in slide-in-from-top-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Display Name</label>
                    <input formControlName="name" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all focus:bg-white" placeholder="Your full name">
                  </div>
                  <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Email Address</label>
                    <input formControlName="email" type="email" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all focus:bg-white" placeholder="your@email.com">
                  </div>
                </div>
                <div>
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Phone Number</label>
                  <input 
                    formControlName="phone" 
                    type="text" 
                    maxlength="8"
                    (input)="onPhoneInput($event)"
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all focus:bg-white" 
                    placeholder="8 digits phone number">
                  <div *ngIf="profileForm.get('phone')?.touched && profileForm.get('phone')?.errors?.['pattern']" class="mt-2 text-[10px] font-bold uppercase tracking-widest text-rose-500">
                    Phone must be exactly 8 digits
                  </div>
                </div>

                <div class="pt-6 flex justify-end gap-3">
                  <button type="button" (click)="toggleEdit()" class="px-8 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Discard</button>
                  <button type="submit" [disabled]="profileForm.invalid || isSaving()" class="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 flex items-center gap-2">
                    <span *ngIf="isSaving()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div class="space-y-8">
            <div class="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
              <h2 class="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                Security
              </h2>
              <form [formGroup]="passwordForm" (ngSubmit)="updatePassword()" class="space-y-4">
                <div class="relative">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Current Password</label>
                  <input formControlName="current_password" [type]="showCurrentPassword() ? 'text' : 'password'" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors">
                  <button type="button" (click)="showCurrentPassword.set(!showCurrentPassword())" class="absolute right-4 top-[38px] text-slate-400 hover:text-emerald-600 transition-colors">
                    <svg *ngIf="!showCurrentPassword()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg *ngIf="showCurrentPassword()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                  </button>
                </div>
                <div class="relative">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">New Password</label>
                  <input formControlName="new_password" [type]="showNewPassword() ? 'text' : 'password'" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors">
                  <button type="button" (click)="showNewPassword.set(!showNewPassword())" class="absolute right-4 top-[38px] text-slate-400 hover:text-emerald-600 transition-colors">
                    <svg *ngIf="!showNewPassword()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg *ngIf="showNewPassword()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                  </button>
                </div>
                <div class="relative">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Confirm Password</label>
                  <input formControlName="new_password_confirmation" [type]="showConfirmPassword() ? 'text' : 'password'" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors">
                  <button type="button" (click)="showConfirmPassword.set(!showConfirmPassword())" class="absolute right-4 top-[38px] text-slate-400 hover:text-emerald-600 transition-colors">
                    <svg *ngIf="!showConfirmPassword()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg *ngIf="showConfirmPassword()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                  </button>
                  <div *ngIf="passwordForm.errors?.['passwordMismatch'] && passwordForm.get('new_password_confirmation')?.touched" class="mt-2 text-[10px] font-bold uppercase tracking-widest text-rose-500">
                    Passwords do not match
                  </div>
                </div>
                <button type="submit" [disabled]="passwordForm.invalid || isSavingPassword()" class="w-full bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 mt-4 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]">
                  <span *ngIf="isSavingPassword()">Updating...</span>
                  <span *ngIf="!isSavingPassword()">Update Password</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-in {
      animation: fadeIn 0.4s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class StaffProfileComponent {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  private tokenService = inject(TokenService);
  private fb = inject(FormBuilder);

  user = signal<any>(null);
  isEditing = signal(false);
  isSaving = signal(false);
  isUploading = signal(false);
  isSavingPassword = signal(false);
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  profileForm: FormGroup;
  passwordForm: FormGroup;

  currentRoleLabel = computed(() => {
    return 'Recruiter';
  });

  constructor() {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^\d{8}$/)]]
    });

    this.passwordForm = this.fb.group({
      current_password: ['', Validators.required],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      new_password_confirmation: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.loadProfile();
  }

  toggleEdit() {
    this.isEditing.set(!this.isEditing());
    if (!this.isEditing()) {
      this.patchFormValues();
    }
  }

  private patchFormValues() {
    const data = this.user();
    if (data) {
      this.profileForm.patchValue({
        name: data?.profile?.full_name || data?.profile?.name || '',
        email: data?.email || '',
        phone: data?.profile?.phone || ''
      });
    }
  }

  private loadProfile(): void {
    this.apiService.get<any>('auth/me').subscribe({
      next: (res) => {
        if (res.success) {
          this.user.set(res.data);
          this.tokenService.setUserData(res.data);
          this.patchFormValues();
        }
      }
    });
  }

  displayName(): string {
    const profile = this.user()?.profile;
    return profile?.full_name || profile?.name || this.user()?.email || 'Profile';
  }

  departmentName(): string | null {
    return this.user()?.profile?.department?.name || null;
  }

  companyName(): string | null {
    return this.user()?.profile?.company?.name || null;
  }

  currentRole(): string {
    return this.currentRoleLabel();
  }

  pictureUrl(): string {
    const raw = this.user()?.photo_path || this.user()?.profile?.picture;
    if (raw && /^https?:\/\//i.test(raw)) return raw;
    if (raw) {
      const apiHost = environment.apiUrl.replace(/\/api\/?$/, '');
      return `${apiHost}/${raw.replace(/^\/+/, '')}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.displayName())}&size=256&background=0f172a&color=fff&bold=true&font-size=0.4`;
  }

  onPictureError(event: any) {
    event.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.displayName())}&size=256&background=0f172a&color=fff&bold=true&font-size=0.4`;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('picture', file);
    this.isUploading.set(true);

    this.apiService.post('auth/profile/picture', formData).subscribe({
      next: (res: any) => {
        this.isUploading.set(false);
        if (res.success) {
          this.notificationService.success('Profile picture updated!');
          this.loadProfile();
        }
      },
      error: () => {
        this.isUploading.set(false);
        this.notificationService.error('Failed to update picture.');
      }
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;
    this.isSaving.set(true);
    this.apiService.post('auth/profile/basic', this.profileForm.value).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        if (res.success) {
          this.notificationService.success('Profile updated successfully!');
          this.isEditing.set(false);
          this.loadProfile();
        }
      },
      error: () => {
        this.isSaving.set(false);
        this.notificationService.error('Failed to update profile.');
      }
    });
  }

  updatePassword(): void {
    if (this.passwordForm.invalid) return;
    this.isSavingPassword.set(true);
    this.apiService.post('auth/password/update', this.passwordForm.value).subscribe({
      next: (res: any) => {
        this.isSavingPassword.set(false);
        if (res.success) {
          this.notificationService.success('Password updated successfully!');
          this.passwordForm.reset();
        }
      },
      error: () => {
        this.isSavingPassword.set(false);
        this.notificationService.error('Failed to update password.');
      }
    });
  }

  private passwordMatchValidator(group: any) {
    const pw = group.get('new_password')?.value;
    const cpw = group.get('new_password_confirmation')?.value;
    return pw === cpw ? null : { passwordMismatch: true };
  }

  onPhoneInput(event: any) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length > 8) value = value.substring(0, 8);
    this.profileForm.get('phone')?.setValue(value, { emitEvent: false });
    input.value = value;
  }
}
