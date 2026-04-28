import { Routes } from '@angular/router';
import { UnauthorizedComponent } from './pages/unauthorized.component';
import { AdminLoginComponent } from './pages/admin-login.component';
import { CompanyLoginComponent } from './pages/company-login.component';

export const AUTH_ROUTES: Routes = [
    { path: '', component: AdminLoginComponent },
    { path: 'login', component: CompanyLoginComponent },
    { path: 'unauthorized', component: UnauthorizedComponent }
];

