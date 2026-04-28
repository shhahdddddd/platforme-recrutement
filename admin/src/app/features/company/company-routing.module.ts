import { Routes } from '@angular/router';
import { CompanyDashboardComponent } from './pages/dashboard.component';
import { CompanyLandingComponent } from './pages/landing.component';
import { CompanyLayoutComponent } from '../../shared/layouts/company-layout.component';
import { PricingComponent } from './pages/pricing.component';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';

export const COMPANY_ROUTES: Routes = [
    {
        path: '',
        component: CompanyLayoutComponent,
        children: [
            {
                path: '',
                component: CompanyLandingComponent,
                pathMatch: 'full'
            },
            {
                path: 'pricing',
                component: PricingComponent
            },
            {
                path: 'dashboard',
                component: CompanyDashboardComponent,
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            /* {
                path: 'documents',
                loadComponent: () => import('./pages/documents.component').then(m => m.CompanyDocumentsComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            }, */
            {
                path: 'knowledge-base',
                loadComponent: () => import('./pages/kb-management.component').then(m => m.KBManagementComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'profile',
                loadComponent: () => import('./pages/profile.component').then(m => m.CompanyProfileComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'contact',
                loadComponent: () => import('./pages/contact.component').then(m => m.ContactComponent)
            },
            {
                path: 'post-job',
                loadComponent: () => import('./pages/post-job-offer.component').then(m => m.PostJobComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'post-job/edit',
                loadComponent: () => import('./pages/post-job-offer.component').then(m => m.PostJobComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'departments',
                loadComponent: () => import('./pages/manage-departments.component').then(m => m.ManageDepartmentsComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'applicants',
                loadComponent: () => import('./pages/applicants.component').then(m => m.ApplicantsComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'interviews',
                loadComponent: () => import('./pages/interviews.component').then(m => m.CompanyInterviewsComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'applications/:applicationId/assessment',
                loadComponent: () => import('./pages/quiz-workspace.component').then(m => m.QuizWorkspaceComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'schedule-interview',
                loadComponent: () => import('./pages/interview-schedule.component').then(m => m.InterviewScheduleComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'recruiters/profile',
                loadComponent: () => import('./pages/recruiter-profile.component').then(m => m.RecruiterProfileComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'candidates',
                loadComponent: () => import('./pages/candidates.component').then(m => m.CandidatesComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'recruiters',
                loadComponent: () => import('./pages/recruiters.component').then(m => m.CompanyRecruitersComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'recruiters/:id',
                loadComponent: () => import('./pages/recruiter-profile.component').then(m => m.RecruiterProfileComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },
            {
                path: 'notifications',
                loadComponent: () => import('./pages/notifications.component').then(m => m.CompanyNotificationsComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            },

            {
                path: 'job-offers/:id/applicants',
                loadComponent: () => import('./pages/applicants.component').then(m => m.ApplicantsComponent),
                canActivate: [authGuard, roleGuard('COMPANY')]
            }
        ]
    }
];
