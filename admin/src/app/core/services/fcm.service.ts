import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';
import { TokenService } from './token.service';

@Injectable({
    providedIn: 'root'
})
export class FcmService {
    private messaging = inject(Messaging);
    private http = inject(HttpClient);
    private uiNotification = inject(NotificationService);
    private tokenService = inject(TokenService);
    private injector = inject(EnvironmentInjector);

    private initialized = false;
    private abortErrorSeen = false;

    async initialize() {
        if (this.initialized) return;
        this.initialized = true;

        if (!this.supportsPushNotifications()) {
            console.warn('FCM: Push notifications are not supported in this browser context.');
            return;
        }

        console.log('FCM: Starting initialization...');
        try {
            const permission = Notification.permission;
            console.log('FCM: Current permission state:', permission);

            if (permission === 'granted') {
                await this.registerAndGetToken();
                this.listenForMessages();
            } else if (permission === 'default') {
                console.log('FCM: Notification permission not yet requested');
            } else {
                console.warn('FCM: Permission denied. State:', permission);
            }
        } catch (err) {
            console.error('FCM: Init failed', err);
            this.initialized = false;
        }
    }

    async requestPermission(): Promise<'granted' | 'denied' | 'default'> {
        if (!this.supportsPushNotifications()) {
            this.uiNotification.error('Push notifications are not supported in this browser/context.', 5000);
            return 'denied';
        }

        try {
            console.log('FCM: Requesting notification permission...');
            const permission = await Notification.requestPermission();
            console.log('FCM: Permission result:', permission);

            if (permission === 'granted') {
                await this.registerAndGetToken();
                this.listenForMessages();
                this.uiNotification.success('Notifications enabled. You will receive updates.');
            } else if (permission === 'denied') {
                this.uiNotification.error('Notifications blocked. Please enable them in browser settings.', 5000);
            }

            return permission;
        } catch (err) {
            console.error('FCM: Permission request failed', err);
            return 'denied';
        }
    }

    getPermissionState(): NotificationPermission {
        return Notification.permission;
    }

    private async registerAndGetToken() {
        if (!this.supportsPushNotifications()) return;

        try {
            console.log('FCM: Registering service worker...');
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

            await navigator.serviceWorker.ready;
            let activationChecks = 0;
            while (registration.active?.state !== 'activated' && activationChecks < 10) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                activationChecks += 1;
            }

            console.log('FCM: Fetching push token...');
            const token = await runInInjectionContext(this.injector, () =>
                getToken(this.messaging, {
                    vapidKey: environment.firebase.vapidKey,
                    serviceWorkerRegistration: registration
                })
            );

            if (token) {
                console.log('FCM: Token acquired.');
                this.syncWithBackend(token);
            } else {
                console.warn('FCM: No registration token returned.');
            }
        } catch (err: any) {
            this.handleDetailedError(err);
        }
    }

    private syncWithBackend(token: string) {
        const userData = this.tokenService.getUserData();
        if (!userData) return;

        const role = (userData.role || '').toLowerCase();
        const endpoint = ['admin', 'superadmin'].includes(role) ? 'admin/auth/fcm-token' : 'auth/fcm-token';

        this.http.post(`${environment.apiUrl}/${endpoint}`, { fcm_token: token, platform: 'web' })
            .subscribe({
                next: () => console.log('FCM: Backend sync successful'),
                error: (e) => console.error('FCM: Backend sync failed', e)
            });
    }

    private listenForMessages() {
        runInInjectionContext(this.injector, () => {
            onMessage(this.messaging, (payload) => {
                console.log('FCM: Message received', payload);
                if (payload.notification?.title) {
                    this.uiNotification.info(payload.notification.title + ': ' + (payload.notification.body || ''));
                }
            });
        });
    }

    private handleDetailedError(err: any) {
        console.error('FCM Error:', err?.name, err?.message);

        if (err?.name === 'AbortError') {
            if (!this.abortErrorSeen) {
                this.abortErrorSeen = true;
                this.uiNotification.info(
                    'Push service is unavailable in this browser session. In-app notifications are still active.',
                    6000
                );
            }
            return;
        }

        this.uiNotification.error('Push notification setup failed. Please try again later.', 5000);
    }

    private supportsPushNotifications(): boolean {
        return (
            typeof window !== 'undefined' &&
            typeof navigator !== 'undefined' &&
            'Notification' in window &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            window.isSecureContext
        );
    }
}
