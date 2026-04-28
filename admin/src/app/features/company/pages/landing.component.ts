import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-company-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#020617] text-white font-['Outfit']">
      <!-- Hero Section -->
      <section class="relative h-screen flex items-center pt-20 overflow-hidden">
        <!-- Background City with Overlay -->
        <div class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent"></div>

        <div class="container mx-auto px-8 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
                <h1 class="text-6xl md:text-8xl font-bold leading-tight mb-6">
                    Find an <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-sky-400">opportunity.</span>
                </h1>
                <div class="flex gap-4">
                    <a routerLink="/auth/login" class="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-xl shadow-blue-500/20">Get Started</a>
                    <a routerLink="/company/pricing" class="inline-flex items-center justify-center bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-bold transition-all backdrop-blur-sm">Learn More</a>
                </div>
            </div>

            <div class="relative hidden md:block">
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1000&auto=format&fit=crop"
                     alt="Professional with tablet"
                     class="rounded-[2rem] shadow-2xl border border-white/10 relative z-20" />
                
                <!-- Decorative Elements -->
                <div class="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 blur-3xl rounded-full"></div>
                <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600/20 blur-3xl rounded-full"></div>
            </div>
        </div>
      </section>

      <!-- Features Section -->
      <section class="py-24">
        <div class="container mx-auto px-8">
            <div class="text-center mb-20">
                <h2 class="text-4xl font-bold mb-4">Optimized for Your Business</h2>
                <p class="text-gray-400">Scale your recruitment process with AI-driven insights.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <!-- Feature 1 -->
                <div class="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all group">
                    <div class="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>
                    </div>
                    <h3 class="text-xl font-bold mb-3">Fast Posting</h3>
                    <p class="text-gray-400 text-sm leading-relaxed">Reach thousands of job seekers in seconds with our optimized platform.</p>
                </div>

                <!-- Feature 2 -->
                <div class="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all group">
                    <div class="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    </div>
                    <h3 class="text-xl font-bold mb-3">AI Matching</h3>
                    <p class="text-gray-400 text-sm leading-relaxed">Find the perfect candidate using our advanced matching algorithms.</p>
                </div>

                <!-- Feature 3 -->
                <div class="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all group">
                    <div class="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <h3 class="text-xl font-bold mb-3">Interview Hub</h3>
                    <p class="text-gray-400 text-sm leading-relaxed">Manage schedules and feedback in one centralized dashboard.</p>
                </div>
            </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="py-20 border-t border-white/5">
        <div class="container mx-auto px-8 grid grid-cols-2 md:grid-cols-4 gap-12">
            <div class="col-span-2 md:col-span-1">
                <div class="text-2xl font-bold tracking-tight mb-6 text-white">
                    Recruti<span class="text-blue-400">TN</span>
                </div>
                <p class="text-sm text-gray-500 leading-relaxed mb-6">Building the future of recruitment with transparency and innovation.</p>
            </div>
            <div>
                <h4 class="font-bold mb-6">Explore</h4>
                <ul class="space-y-4 text-sm text-gray-500 font-medium">
                    <li class="hover:text-white cursor-pointer transition-colors">Find Jobs</li>
                    <li class="hover:text-white cursor-pointer transition-colors">Employers</li>
                    <li class="hover:text-white cursor-pointer transition-colors">Pricing</li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold mb-6">Company</h4>
                <ul class="space-y-4 text-sm text-gray-500 font-medium">
                    <li class="hover:text-white cursor-pointer transition-colors">About Us</li>
                    <li class="hover:text-white cursor-pointer transition-colors">Privacy Policy</li>
                    <li class="hover:text-white cursor-pointer transition-colors">Terms</li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold mb-6">Resources</h4>
                <ul class="space-y-4 text-sm text-gray-500 font-medium">
                    <li class="hover:text-white cursor-pointer transition-colors">Blog</li>
                    <li class="hover:text-white cursor-pointer transition-colors">Support</li>
                    <li class="hover:text-white cursor-pointer transition-colors">Partner Program</li>
                </ul>
            </div>
        </div>
        <div class="container mx-auto px-8 mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600 font-medium">
            <p>© 2026 RecrutiTN Inc. All rights reserved.</p>
            <div class="flex gap-8">
                <a class="hover:text-white transition-colors cursor-pointer">Twitter</a>
                <a class="hover:text-white transition-colors cursor-pointer">LinkedIn</a>
                <a class="hover:text-white transition-colors cursor-pointer">Facebook</a>
            </div>
        </div>
      </footer>
    </div>
  `
})
export class CompanyLandingComponent { }
