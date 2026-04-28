import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[#020617] p-5 font-['Outfit']">
      <div class="w-full max-w-md p-10 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl text-center shadow-2xl">
        <div class="w-20 h-20 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6">
          🚫
        </div>
        <h1 class="text-3xl font-bold text-white mb-4">Access Denied</h1>
        <p class="text-gray-400 mb-8 leading-relaxed">
          You don't have the required permissions to view this section. Please contact your administrator if you believe this is an error.
        </p>
        <button 
          routerLink="/" 
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20"
        >
          Return to Safe Zone
        </button>
      </div>
    </div>
  `
})
export class UnauthorizedComponent { }
