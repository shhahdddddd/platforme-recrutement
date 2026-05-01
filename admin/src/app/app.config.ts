import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';

import { routes } from './app-routing.module';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { environment } from '../environments/environment';

// ✅ SAFE CHECK
const isMessagingSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  location.protocol === 'https:';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideCharts(withDefaultRegisterables()),
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    // ✅ Only enable messaging if supported
    ...(isMessagingSupported
      ? [provideMessaging(() => getMessaging())]
      : [])
  ]
};
