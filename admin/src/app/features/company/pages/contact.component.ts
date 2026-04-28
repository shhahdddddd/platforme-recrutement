import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiService } from '../../../core/services/api.service';

interface ProblemCategory {
  value: string;
  label: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-company-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="max-w-2xl mx-auto py-12 px-4 font-['Outfit']">
      <div class="bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10 text-white relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <h1 class="text-3xl font-black tracking-tight relative z-10">Contact Support</h1>
          <p class="mt-2 text-blue-100 font-medium relative z-10">We're here to solve your technical or billing issues.</p>
        </div>

        <div class="p-8">
          <form [formGroup]="contactForm" (ngSubmit)="onSubmit()" class="space-y-6">

            <!-- Custom Category Dropdown -->
            <div class="relative" #dropdownRef>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Problem Category</label>

              <!-- Trigger Button -->
              <button
                type="button"
                (click)="toggleDropdown()"
                [class.border-blue-500]="isDropdownOpen()"
                [class.border-slate-100]="!isDropdownOpen()"
                [class.ring-4]="isDropdownOpen()"
                [class.ring-blue-500/10]="isDropdownOpen()"
                class="w-full px-5 py-4 rounded-2xl border-2 bg-slate-50 outline-none transition-all hover:bg-slate-100/50 flex items-center justify-between gap-3 cursor-pointer"
              >
                <!-- Selected state -->
                <div class="flex items-center gap-3 min-w-0">
                  <ng-container *ngIf="selectedCategory(); else placeholder">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50 text-blue-600 text-base">
                      {{ selectedCategory()!.icon }}
                    </div>
                    <div class="text-left min-w-0">
                      <div class="text-sm font-black text-slate-800 truncate">{{ selectedCategory()!.label }}</div>
                      <div class="text-xs text-slate-400 font-medium truncate">{{ selectedCategory()!.description }}</div>
                    </div>
                  </ng-container>
                  <ng-template #placeholder>
                    <div class="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                      </svg>
                    </div>
                    <span class="text-sm font-bold text-slate-400">Select a category</span>
                  </ng-template>
                </div>

                <!-- Chevron -->
                <svg
                  class="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200"
                  [class.rotate-180]="isDropdownOpen()"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              <!-- Dropdown Panel -->
              <div
                *ngIf="isDropdownOpen()"
                class="absolute z-50 w-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/60 overflow-hidden"
              >
                <div class="p-1.5 space-y-0.5">
                  <button
                    *ngFor="let cat of categories"
                    type="button"
                    (click)="selectCategory(cat)"
                    [class.bg-blue-50]="selectedCategory()?.value === cat.value"
                    [class.text-blue-700]="selectedCategory()?.value === cat.value"
                    class="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-slate-50 transition-all group cursor-pointer text-left"
                  >
                    <!-- Icon Badge -->
                    <div
                      class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base transition-all"
                      [class.bg-blue-100]="selectedCategory()?.value === cat.value"
                      [class.bg-slate-100]="selectedCategory()?.value !== cat.value"
                      [class.group-hover:bg-blue-50]="selectedCategory()?.value !== cat.value"
                    >
                      {{ cat.icon }}
                    </div>

                    <!-- Text -->
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-black text-slate-800 leading-tight">{{ cat.label }}</div>
                      <div class="text-xs text-slate-400 font-medium mt-0.5">{{ cat.description }}</div>
                    </div>

                    <!-- Check -->
                    <svg
                      *ngIf="selectedCategory()?.value === cat.value"
                      class="w-4 h-4 text-blue-500 flex-shrink-0"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Detailed Description</label>
              <textarea
                formControlName="description"
                rows="5"
                placeholder="Please provide as much detail as possible..."
                class="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-slate-50 outline-none resize-none text-slate-700 font-medium transition-all hover:bg-slate-100/50"
              ></textarea>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              [disabled]="contactForm.invalid || isSubmitting()"
              class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3"
            >
              <span *ngIf="isSubmitting()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              {{ isSubmitting() ? 'Sending Report...' : 'Send Urgent Message' }}
            </button>
          </form>

          <!-- Divider -->
          <div class="relative my-10">
            <div class="absolute inset-0 flex items-center"><span class="w-full border-t border-slate-100"></span></div>
            <div class="relative flex justify-center text-xs uppercase"><span class="bg-white px-4 text-slate-300 font-black tracking-widest">Connect with us</span></div>
          </div>

          <!-- Emergency Call Button -->
          <a
            href="tel:+21692859965"
            class="flex items-center justify-center gap-4 w-full py-4 border-2 border-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 hover:border-blue-100 hover:text-blue-600 transition-all group"
          >
            <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            Direct Line: +216 92 859 965
          </a>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ContactComponent {
  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);
  private apiService = inject(ApiService);
  private elementRef = inject(ElementRef);

  contactForm: FormGroup;
  isSubmitting = signal(false);
  isDropdownOpen = signal(false);
  selectedCategory = signal<ProblemCategory | null>(null);

  categories: ProblemCategory[] = [
    {
      value: 'Technical Issue',
      label: 'Technical Problem',
      icon: '⚙️',
      description: 'Bugs, errors, or unexpected behavior'
    },
    {
      value: 'Billing/Payment',
      label: 'Payment Problem',
      icon: '💳',
      description: 'Charges, invoices, or subscription issues'
    },
    {
      value: 'Account Access',
      label: 'Account Access',
      icon: '🔐',
      description: 'Login, permissions, or security concerns'
    },
    {
      value: 'Other',
      label: 'Other',
      icon: '💬',
      description: 'General inquiries or feedback'
    }
  ];

  constructor() {
    this.contactForm = this.fb.group({
      problemType: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  toggleDropdown() {
    this.isDropdownOpen.update(v => !v);
  }

  selectCategory(cat: ProblemCategory) {
    this.selectedCategory.set(cat);
    this.contactForm.get('problemType')?.setValue(cat.value);
    this.isDropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isDropdownOpen.set(false);
    }
  }

  onSubmit() {
    if (this.contactForm.valid) {
      this.isSubmitting.set(true);

      this.apiService.post('company/contact', this.contactForm.value).subscribe({
        next: (res: any) => {
          this.isSubmitting.set(false);
          if (res.success) {
            this.notificationService.success('Your message has been sent to the administration. We will contact you soon!');
            this.contactForm.reset({ problemType: '', description: '' });
            this.selectedCategory.set(null);
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const errorMessage = err?.status === 401
            ? 'you need to Log in'
            : (err.error?.message || 'Failed to send message. Please try again.');
          this.notificationService.error(errorMessage);
          console.error('Contact error:', err);
        }
      });
    }
  }
}