import { Component, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-layout">
      <!-- Admin Sidebar -->
      <aside class="sidebar">
        <div class="logo">
          <span class="logo-text">Recruti<span class="gradient-text">TN</span></span>
        </div>

        <nav class="nav-menu">
          <div class="nav-group">
            <p class="nav-label">Management</p>
            <a routerLink="/admin/dashboard" routerLinkActive="active" class="nav-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Dashboard
            </a>
            <a routerLink="/admin/data-analytics" routerLinkActive="active" class="nav-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
              Market Insights
            </a>
            <a routerLink="/admin/companies" routerLinkActive="active" class="nav-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
              Companies
            </a>
            <a routerLink="/admin/industries" routerLinkActive="active" class="nav-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21 5-5 5 5"></path><path d="M12 16V3"></path><path d="M4 7h16"></path></svg>
              Industries
            </a>

            <a routerLink="/admin/subscription-plans" routerLinkActive="active" class="nav-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              Subscription Plans
            </a>


             <a routerLink="/admin/UrgentContact" routerLinkActive="active" class="nav-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Urgent Reports
            </a>

          </div>
        </nav>
      </aside>

      <main class="main-content">
        <header class="header">
          <div class="page-title">Admin Control Panel</div>
          <div class="header-actions">
            <div class="user-profile">
              <div class="user-info">
                <p class="user-name">{{ currentUser()?.full_name || 'Admin' }}</p>
                <p class="user-email">{{ currentUser()?.email }}</p>
              </div>
              <div class="user-avatar" aria-label="Admin user">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
            </div>
            <button (click)="logout()" class="icon-btn" title="Logout">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </header>

        <div class="content-wrapper">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
  styleUrl: '../../app.css'
})
export class AdminLayoutComponent {
  currentUser = computed(() => this.authService.getCurrentUser());

  constructor(private authService: AuthService) { }

  logout(): void {
    this.authService.logout();
  }
}
