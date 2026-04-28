import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { RecruiterLayoutComponent } from '../../shared/layouts/recruiter-layout.component';

export const RECRUITER_ROUTES: Routes = [
  {
    path: '',
    component: RecruiterLayoutComponent,
    canActivate: [authGuard, roleGuard('RECRUITER')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard.component').then(m => m.RecruiterDashboardComponent)
      },
      {
        path: 'applicants',
        loadComponent: () => import('./pages/applicants.component').then(m => m.RecruiterApplicantsComponent)
      },
      {
        path: 'intern-candidates',
        loadComponent: () => import('./pages/intern-candidates.component').then(m => m.InternCandidatesComponent)
      },
      {
        path: 'interviews',
        loadComponent: () => import('./pages/interviews.component').then(m => m.RecruiterInterviewsComponent)
      },
      {
        path: 'chat',
        loadComponent: () => import('./pages/chat.component').then(m => m.RecruiterChatComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile.component').then(m => m.StaffProfileComponent)
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications.component').then(m => m.RecruiterNotificationsComponent)
      },
      {
        path: 'assessment-setup',
        loadComponent: () => import('./pages/manual-quiz.component').then(m => m.ManualQuizComponent)
      },
      {
        path: 'schedule-interview',
        loadComponent: () => import('./pages/interview-schedule.component').then(m => m.RecruiterInterviewScheduleComponent)
      },
      {
        path: 'applications/:applicationId/assessment',
        loadComponent: () => import('../company/pages/quiz-workspace.component').then(m => m.QuizWorkspaceComponent)
      }
    ]
  }
];
