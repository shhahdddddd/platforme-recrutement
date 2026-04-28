import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './pages/dashboard.component';
import { DataAnalyticsComponent } from './pages/data-analytics.component';
import { CompaniesComponent } from './pages/companies.component';
import { AddCompanyComponent } from './pages/add-company.component';
import { UrgentContactComponent } from './pages/urgent-contact.component';
import { CompanyReactivationComponent } from './pages/company-reactivation.component';
import { AdminCompanyProfileComponent } from './pages/company-profile.component';
import { SubscriptionPlansComponent } from './pages/subscription-plans.component';
import { SubscriptionPaymentsComponent } from './pages/subscription-payments.component';
import { IndustriesComponent } from './pages/industries.component';

export const ADMIN_ROUTES: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: AdminDashboardComponent },
    { path: 'data-analytics', component: DataAnalyticsComponent },
    { path: 'companies', component: CompaniesComponent },
    { path: 'companies/add', component: AddCompanyComponent },
    { path: 'activation', component: CompanyReactivationComponent },
    { path: 'companies/profile', component: AdminCompanyProfileComponent },
    { path: 'companies/:id', component: AdminCompanyProfileComponent },
    { path: 'industries', component: IndustriesComponent },
    { path: 'subscription-plans', component: SubscriptionPlansComponent },
    { path: 'subscription-payments', component: SubscriptionPaymentsComponent },
    { path: 'UrgentContact', component: UrgentContactComponent }
];
