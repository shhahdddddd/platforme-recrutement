import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import { authGuard } from './core/guards/auth.guard';
import { AdminLayoutComponent } from './shared/layouts/admin-layout.component';
import { guestGuard } from './core/guards/guest.guard';


export const routes: Routes = [
    { path: '', redirectTo: 'company', pathMatch: 'full' },
    // Auth Routes
    {
        path: 'auth',
        canActivate: [guestGuard],
        loadChildren: () => import('./features/auth/auth-routing.module').then(m => m.AUTH_ROUTES)
    },



    // Admin Feature (Lazy Loaded)
    {
        path: 'admin',
        component: AdminLayoutComponent,
        canActivate: [authGuard, roleGuard('ADMIN')],
        loadChildren: () => import('./features/admin/admin-routing.module').then(m => m.ADMIN_ROUTES)
    },
    // Auth Routes
    {
        path: 'auth',
        canActivate: [guestGuard],
        loadChildren: () => import('./features/auth/auth-routing.module').then(m => m.AUTH_ROUTES)
    },



    // Admin Feature (Lazy Loaded)
    {
        path: 'admin',
        component: AdminLayoutComponent,
        canActivate: [authGuard, roleGuard('ADMIN')],
        loadChildren: () => import('./features/admin/admin-routing.module').then(m => m.ADMIN_ROUTES)
    },

    // Company Feature (Lazy Loaded)
    {
        path: 'company',
        loadChildren: () => import('./features/company/company-routing.module').then(m => m.COMPANY_ROUTES)
    },
    /*
    {
        path: 'accounting',
        canActivate: [authGuard],
        loadChildren: () => import('./features/accounting/accounting.routes').then(m => m.ACCOUNTING_ROUTES)
    },
    */
    {
        path: 'recruiter',
        canActivate: [authGuard, roleGuard('RECRUITER')],
        loadChildren: () => import('./features/recruiter/recruiter-routing.module').then(m => m.RECRUITER_ROUTES)
    },



    { path: '**', redirectTo: 'company' }
];
