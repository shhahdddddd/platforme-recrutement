import { Component, signal, inject, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

@Component({
    selector: 'app-company-profile',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    template: `
    <div class="min-h-screen bg-slate-50 pb-20 font-['Outfit']">
      
      <!-- Cover Header -->
      <div class="h-60 w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        
        <!-- Company Name Overlay -->
        <div class="absolute bottom-0 left-0 right-0 px-6 pb-4">
          <div class="container mx-auto flex items-end gap-8">
            <!-- Spacer for logo -->
            <div class="w-40 shrink-0"></div>
            <!-- Company Name -->
            <div class="flex-1">
              <h1 class="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-lg">{{ company()?.name }}</h1>
            </div>
          </div>
        </div>
      </div>

      <div class="container mx-auto px-6 -mt-20 relative z-10">
        <div class="flex flex-col md:flex-row items-end gap-8 mb-8">
            
            <!-- Profile Picture -->
            <div class="relative group">
                <div class="w-40 h-40 rounded-3xl bg-white p-1.5 shadow-2xl relative overflow-hidden">
                    <img [src]="pictureUrl(company()?.picture)" 
                         class="w-full h-full object-cover rounded-2xl bg-slate-50"
                         alt="Company Logo"
                         (error)="onPictureError($event)">
                    
                    <!-- Edit Overlay -->
                    <label class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <span class="text-white text-xs font-bold uppercase tracking-wider">Change Logo</span>
                        <input type="file" (change)="onFileSelected($event)" class="hidden" accept=".jpg,.jpeg,.png">
                    </label>
                </div>
                <div *ngIf="isUploading()" class="absolute inset-0 bg-white/80 flex items-center justify-center rounded-3xl z-20">
                    <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>

            <!-- Header Info -->
            <div class="flex-1 pb-4 text-center md:text-left">
                <div class="flex wrap gap-3 justify-center md:justify-start">
                    <span class="px-4 py-2 rounded-xl bg-blue-50 text-slate-900 backdrop-blur-xl text-[10px] font-black uppercase tracking-[0.2em] border border-blue-100 shadow-sm">
                        {{ company()?.industry?.name || 'Technology' }}
                    </span>
                    <span *ngIf="company()?.location" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 backdrop-blur-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-slate-200/50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        {{ company()?.location }}
                    </span>
                    <span *ngIf="company()?.international" class="px-4 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/30 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                        Global Entity
                    </span>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pb-4">
                <button (click)="toggleEdit()" class="px-6 py-3 rounded-xl bg-white text-slate-900 font-bold shadow-lg hover:bg-slate-50 transition-all flex items-center gap-2 border border-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    {{ isEditing() ? 'Cancel Editing' : 'Edit Profile' }}
                </button>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <!-- Left Column: About & Details -->
            <div class="lg:col-span-2 space-y-8">
                
                <!-- About Section -->
                <div class="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-black text-slate-800 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            About Organization
                        </h2>
                    </div>
                    
                    <div *ngIf="!isEditing()">
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">{{ company()?.description || 'No description provided.' }}</p>
                    </div>

                    <form *ngIf="isEditing()" [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Company Name</label>
                            <input formControlName="name" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-colors">
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Company Email</label>
                            <input formControlName="email" type="email" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-colors">
                            <p *ngIf="profileForm.get('email')?.touched && profileForm.get('email')?.invalid" class="text-red-500 text-[10px] font-bold mt-1 ml-1 uppercase">Valid email is required</p>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Location</label>
                                <div class="relative" id="location-dropdown">
                                  <button
                                    type="button"
                                    (click)="toggleLocationDropdown()"
                                    class="w-full h-[50px] bg-slate-50 border border-slate-200 rounded-xl px-4 font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between"
                                    [class.border-blue-500]="isLocationOpen()"
                                    [class.bg-white]="isLocationOpen()"
                                  >
                                    <span class="truncate">{{ selectedLocationLabel() }}</span>
                                    <svg [class.rotate-180]="isLocationOpen()" class="transition-transform duration-300 text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                  </button>

                                  <div *ngIf="isLocationOpen()" class="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/10 p-2 max-h-72 overflow-y-auto">
                                    <button
                                      type="button"
                                      (click)="selectLocation('')"
                                      class="w-full text-left px-4 py-3 rounded-xl transition-all font-bold text-slate-700 text-sm flex items-center justify-between hover:bg-blue-600 hover:text-white group"
                                    >
                                      <span>Select Governorate</span>
                                      <svg *ngIf="!profileForm.get('location')?.value" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </button>

                                    <button
                                      type="button"
                                      *ngFor="let gov of governorates"
                                      (click)="selectLocation(gov)"
                                      class="w-full text-left px-4 py-3 rounded-xl transition-all font-bold text-slate-700 text-sm flex items-center justify-between hover:bg-blue-600 hover:text-white group mt-1"
                                      [class.bg-blue-50]="profileForm.get('location')?.value === gov"
                                      [class.text-blue-700]="profileForm.get('location')?.value === gov"
                                    >
                                      <span class="truncate">{{ gov }}</span>
                                      <svg *ngIf="profileForm.get('location')?.value === gov" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </button>
                                  </div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Industry</label>
                                <div class="relative" id="industry-dropdown">
                                  <button
                                    type="button"
                                    (click)="toggleIndustryDropdown()"
                                    class="w-full h-[50px] bg-slate-50 border border-slate-200 rounded-xl px-4 font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between"
                                    [class.border-blue-500]="isIndustryOpen()"
                                    [class.bg-white]="isIndustryOpen()"
                                  >
                                    <span class="truncate">{{ selectedIndustryLabel() }}</span>
                                    <svg [class.rotate-180]="isIndustryOpen()" class="transition-transform duration-300 text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                  </button>

                                  <div *ngIf="isIndustryOpen()" class="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/10 p-2 max-h-72 overflow-y-auto">
                                    <button
                                      type="button"
                                      (click)="selectIndustry('')"
                                      class="w-full text-left px-4 py-3 rounded-xl transition-all font-bold text-slate-700 text-sm flex items-center justify-between hover:bg-blue-600 hover:text-white group"
                                    >
                                      <span>Select Industry</span>
                                      <svg *ngIf="!profileForm.get('industry_id')?.value" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </button>

                                    <button
                                      type="button"
                                      *ngFor="let ind of industries()"
                                      (click)="selectIndustry(ind.id)"
                                      class="w-full text-left px-4 py-3 rounded-xl transition-all font-bold text-slate-700 text-sm flex items-center justify-between hover:bg-blue-600 hover:text-white group mt-1"
                                      [class.bg-blue-50]="profileForm.get('industry_id')?.value == ind.id"
                                      [class.text-blue-700]="profileForm.get('industry_id')?.value == ind.id"
                                    >
                                      <span class="truncate">{{ ind.name }}</span>
                                      <svg *ngIf="profileForm.get('industry_id')?.value == ind.id" class="text-blue-500 group-hover:text-white" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </button>
                                  </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                            <textarea formControlName="description" rows="5" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"></textarea>
                        </div>
                        
                        <div class="flex items-center gap-4 pt-2">
                             <label class="flex items-center gap-3 cursor-pointer group">
                                <div class="relative">
                                    <input type="checkbox" formControlName="international" class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 transition-colors"></div>
                                </div>
                                <span class="text-sm font-bold text-slate-600 group-hover:text-slate-900">International Entity</span>
                             </label>

                             <div *ngIf="profileForm.get('international')?.value" class="flex-1 animate-in fade-in">
                                <input formControlName="country" type="text" placeholder="Target Country" class="w-full bg-blue-50 border-blue-100 rounded-xl px-4 py-2 font-semibold text-blue-800 focus:outline-none focus:border-blue-500 transition-colors">
                             </div>
                        </div>

                        <div class="pt-4 flex justify-end">
                            <button type="submit" [disabled]="isSaving()" class="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 flex items-center gap-2">
                                <span *ngIf="isSaving()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Right Column: Settings & Security -->
            <div class="space-y-8">
                
                <!-- Security Card -->
                <div class="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                    <h2 class="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        Security
                    </h2>

                    <form [formGroup]="passwordForm" (ngSubmit)="updatePassword()" class="space-y-4">
                        <div class="relative">
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Password</label>
                            <input [type]="showCurrent() ? 'text' : 'password'" 
                                   formControlName="current_password" 
                                   class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors pr-12">
                            <button type="button" (click)="showCurrent.set(!showCurrent())" class="absolute right-4 bottom-3 text-slate-400 hover:text-slate-600 transition-colors">
                                <svg *ngIf="!showCurrent()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                <svg *ngIf="showCurrent()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            </button>
                        </div>
                        
                        <div class="relative">
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">New Password</label>
                            <input [type]="showNew() ? 'text' : 'password'" 
                                   formControlName="new_password" 
                                   class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors pr-12">
                            <button type="button" (click)="showNew.set(!showNew())" class="absolute right-4 bottom-3 text-slate-400 hover:text-slate-600 transition-colors">
                                <svg *ngIf="!showNew()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                <svg *ngIf="showNew()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            </button>
                        </div>

                        <div class="relative">
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Confirm Password</label>
                            <input [type]="showConfirm() ? 'text' : 'password'" 
                                   formControlName="new_password_confirmation" 
                                   class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none transition-colors pr-12"
                                   [ngClass]="{
                                     'border-emerald-500 focus:border-emerald-600': isMatched() && passwordForm.get('new_password_confirmation')?.value,
                                     'border-rose-500 focus:border-rose-600': !isMatched() && passwordForm.get('new_password_confirmation')?.value,
                                     'border-slate-200 focus:border-emerald-500': !passwordForm.get('new_password_confirmation')?.value
                                   }">
                            <button type="button" (click)="showConfirm.set(!showConfirm())" class="absolute right-4 bottom-3 text-slate-400 hover:text-slate-600 transition-colors">
                                <svg *ngIf="!showConfirm()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                <svg *ngIf="showConfirm()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            </button>
                        </div>

                        <!-- Match Indicator -->
                        <div *ngIf="passwordForm.get('new_password_confirmation')?.value" class="animate-in fade-in slide-in-from-top-1">
                            <div class="flex items-center gap-2 px-1">
                                <div class="w-1.5 h-1.5 rounded-full" [ngClass]="isMatched() ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'"></div>
                                <span class="text-[10px] font-black uppercase tracking-widest" [ngClass]="isMatched() ? 'text-emerald-600' : 'text-rose-500'">
                                    {{ isMatched() ? 'Passwords matched' : 'Passwords do not match' }}
                                </span>
                            </div>
                        </div>

                        <button type="submit" [disabled]="passwordForm.invalid || isSavingPassword() || !isMatched()" 
                                class="w-full bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 mt-4 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transform active:scale-[0.98]">
                             <span *ngIf="isSavingPassword()" class="flex items-center justify-center gap-2">
                                <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Updating...
                             </span>
                             <span *ngIf="!isSavingPassword()">Update Password</span>
                        </button>
                    </form>
                </div>
            </div>

        </div>
      </div>
    </div>
    `
})
export class CompanyProfileComponent {
    private apiService = inject(ApiService);
    private fb = inject(FormBuilder);
    private notificationService = inject(NotificationService);
    private el = inject(ElementRef);

    company = signal<any>(null);
    isEditing = signal(false);
    isSaving = signal(false);
    isUploading = signal(false);
    isSavingPassword = signal(false);

    showCurrent = signal(false);
    showNew = signal(false);
    showConfirm = signal(false);
    isMatched = signal(false);
    isIndustryOpen = signal(false);
    isLocationOpen = signal(false);

    industries = signal<Array<{ id: number; name: string }>>([]);
    governorates = [
        'Ariana',
        'Beja',
        'Ben Arous',
        'Bizerte',
        'Gabes',
        'Gafsa',
        'Jendouba',
        'Kairouan',
        'Kasserine',
        'Kebili',
        'Kef',
        'Mahdia',
        'Manouba',
        'Medenine',
        'Monastir',
        'Nabeul',
        'Sfax',
        'Sidi Bouzid',
        'Siliana',
        'Sousse',
        'Tataouine',
        'Tozeur',
        'Tunis',
        'Zaghouan'
    ];

    profileForm: FormGroup;
    passwordForm: FormGroup;

    constructor() {
        this.profileForm = this.fb.group({
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            location: [''],
            industry_id: [''],
            description: [''],
            international: [false],
            country: ['']
        });

        this.passwordForm = this.fb.group({
            current_password: ['', Validators.required],
            new_password: ['', [Validators.required, Validators.minLength(8)]],
            new_password_confirmation: ['', Validators.required]
        });

        // Bridge Angular Forms with Signals for reactive UI
        this.passwordForm.valueChanges.subscribe(values => {
            const pass = values.new_password;
            const conf = values.new_password_confirmation;
            this.isMatched.set(!!(pass && conf && pass === conf));
        });

        this.hydrateFromCache();
        this.loadProfile();
        this.loadIndustries();
    }

    pictureUrl(raw?: string | null): string {
        const fallback = this.avatarFallback();
        if (!raw || typeof raw !== 'string') return fallback;
        if (/^https?:\/\//i.test(raw)) return raw;
        const apiHost = environment.apiUrl.replace(/\/api\/?$/, '');
        return `${apiHost}/${raw.replace(/^\/+/, '')}`;
    }

    onPictureError(event: any) {
        event.target.src = this.avatarFallback();
    }

    private avatarFallback(): string {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.company()?.name || 'C')}&size=256&background=3b82f6&color=fff&bold=true&font-size=0.4`;
    }

    loadIndustries() {
        this.apiService.get<any>('company/industries').subscribe({
            next: (res) => {
                if (res.success) {
                    this.industries.set(res.data || []);
                }
            },
            error: (err) => console.error('Error loading industries', err)
        });
    }

    loadProfile() {
        this.apiService.get<any>('company/profile').subscribe({
            next: (res) => {
                if (res.success) {
                    this.company.set(res.data);
                    localStorage.setItem('company_profile_cache', JSON.stringify(res.data));
                    this.patchForm(res.data);
                }
            },
            error: (err) => {
                console.error('Error loading profile', err);
            }
        });
    }

    private hydrateFromCache() {
        try {
            const cached = localStorage.getItem('company_profile_cache');
            if (!cached) return;
            const data = JSON.parse(cached);
            this.company.set(data);
            this.patchForm(data);
        } catch {
            // ignore corrupt cache
        }
    }

    patchForm(data: any) {
        this.profileForm.patchValue({
            name: data.name,
            email: data.user?.email || '',
            location: data.location,
            industry_id: data.industry_id || data.industry?.id || '',
            description: data.description,
            international: data.international,
            country: data.country
        });
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event): void {
        if (!this.el.nativeElement.contains(event.target)) {
            this.isIndustryOpen.set(false);
            this.isLocationOpen.set(false);
        }
    }

    toggleIndustryDropdown(): void {
        this.isLocationOpen.set(false);
        this.isIndustryOpen.update(v => !v);
    }

    selectIndustry(id: number | ''): void {
        this.profileForm.patchValue({ industry_id: id || '' });
        this.isIndustryOpen.set(false);
    }

    selectedIndustryLabel(): string {
        const selected = this.profileForm.get('industry_id')?.value;
        if (!selected) return 'Select Industry';

        const match = this.industries().find(ind => Number(ind.id) === Number(selected));
        return match?.name || 'Select Industry';
    }

    toggleLocationDropdown(): void {
        this.isIndustryOpen.set(false);
        this.isLocationOpen.update(v => !v);
    }

    selectLocation(location: string): void {
        this.profileForm.patchValue({ location: location || '' });
        this.isLocationOpen.set(false);
    }

    selectedLocationLabel(): string {
        const selected = String(this.profileForm.get('location')?.value || '').trim();
        return selected || 'Select Governorate';
    }

    toggleEdit() {
        this.isEditing.set(!this.isEditing());
        if (!this.isEditing()) {
            this.patchForm(this.company()); // specific reset
        }
    }

    saveProfile() {
        if (this.profileForm.invalid) return;
        this.isSaving.set(true);

        this.apiService.post('company/profile', this.profileForm.value).subscribe({
            next: (res: any) => {
                this.isSaving.set(false);
                if (res.success) {
                    this.company.set(res.data);
                    this.isEditing.set(false);
                    this.notificationService.success('Profile updated successfully!');
                }
            },
            error: (err) => {
                this.isSaving.set(false);
                this.notificationService.error('Failed to update profile.');
                console.error(err);
            }
        });
    }

    updatePassword() {
        if (this.passwordForm.invalid || !this.isMatched()) return;
        this.isSavingPassword.set(true);

        this.apiService.post('company/password', this.passwordForm.value).subscribe({
            next: (res: any) => {
                this.isSavingPassword.set(false);
                if (res.success) {
                    this.notificationService.success('Password changed successfully!');
                    this.passwordForm.reset();
                }
            },
            error: (err) => {
                this.isSavingPassword.set(false);
                this.notificationService.error(err.error?.message || 'Failed to update password.');
            }
        });
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.isUploading.set(true);
            const formData = new FormData();
            formData.append('picture', file);

            // Upload using the existing profile/picture endpoint which handles company role
            this.apiService.post('auth/profile/picture', formData).subscribe({
                next: (res: any) => {
                    this.isUploading.set(false);
                    if (res.success) {
                        // Update local state
                        const updated = { ...this.company(), picture: res.data.picture_url };
                        this.company.set(updated);
                        this.notificationService.success('Profile picture updated!');
                    }
                },
                error: (err) => {
                    this.isUploading.set(false);
                    const errorMessage = err.error?.message || 'Failed to upload picture.';
                    this.notificationService.error(errorMessage);
                    console.error('Upload error:', err);
                }
            });
        }
    }
}
