import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from './api.service';
import { TokenService } from './token.service';
import {
  ChatMessagePayload,
  LiveNotificationPayload,
  WebSocketMessage,
  WebSocketService
} from './websocket.service';

export interface RealtimeNotificationItem {
  id: number;
  title: string;
  body: string;
  message?: string | null;
  type?: string | null;
  reference_id?: number | null;
  application_id?: number | null;
  sent_at?: string | null;
  is_read?: boolean;
  status?: string | null;
  channel?: string | null;
  data?: Record<string, any> | null;
}

@Injectable({
  providedIn: 'root'
})
export class RealtimeUpdatesService {
  private apiService = inject(ApiService);
  private tokenService = inject(TokenService);
  private wsService = inject(WebSocketService);

  private userId: number | null = null;
  private connectionSub: Subscription | null = null;
  private messageSub: Subscription | null = null;
  private seenNotificationIds = new Set<number>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  notificationUnreadCount = signal(0);
  chatUnreadCount = signal(0);
  connected = signal(false);
  lastNotification = signal<RealtimeNotificationItem | null>(null);

  ensureStarted(): void {
    const nextUserId = this.resolveUserId();
    const token = this.tokenService.getToken();

    if (!nextUserId || !token) {
      return;
    }

    if (this.userId === nextUserId && (this.connectionSub || this.messageSub)) {
      return;
    }

    this.reset(this.userId !== null);
    this.userId = nextUserId;
    this.loadCounts();

    this.connectionSub = this.wsService.isConnected$.subscribe((connected) => {
      this.connected.set(connected);
      if (connected && this.userId) {
        this.reconnectAttempts = 0;
        this.wsService.subscribeToUserChannel(this.userId);
      } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.messageSub = this.wsService.messages$.subscribe((message) => {
      this.handleMessage(message);
    });

    this.wsService.connect(token);
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      if (!this.connected() && this.reconnectAttempts < this.maxReconnectAttempts) {
        const token = this.tokenService.getToken();
        if (token) {
          this.wsService.connect(token);
        }
      }
    }, delay);
  }

  reset(disconnect = true): void {
    this.connectionSub?.unsubscribe();
    this.messageSub?.unsubscribe();
    this.connectionSub = null;
    this.messageSub = null;

    this.userId = null;
    this.reconnectAttempts = 0;
    this.connected.set(false);
    this.notificationUnreadCount.set(0);
    this.chatUnreadCount.set(0);
    this.lastNotification.set(null);
    this.seenNotificationIds.clear();

    if (disconnect) {
      this.wsService.disconnect();
    }
  }

  markNotificationAsRead(): void {
    const current = this.notificationUnreadCount();
    if (current > 0) {
      this.notificationUnreadCount.set(current - 1);
    }
  }

  markAllNotificationsAsRead(): void {
    this.notificationUnreadCount.set(0);
  }

  removeNotification(wasUnread: boolean): void {
    if (wasUnread) {
      this.markNotificationAsRead();
    }
  }

  refreshNotificationCount(): void {
    this.apiService.get<any>('notifications/unread-count').subscribe({
      next: (res) => {
        const total = Number(res?.data?.unread_count ?? 0);
        this.notificationUnreadCount.set(Number.isFinite(total) ? total : 0);
      }
    });
  }

  refreshChatUnreadCount(): void {
    if (!this.canLoadRecruiterChatUnread()) {
      this.chatUnreadCount.set(0);
      return;
    }

    this.apiService.get<any>('company/intern-chat/unread-count').subscribe({
      next: (res) => {
        const total = Number(res?.data?.unread_count ?? 0);
        this.chatUnreadCount.set(Number.isFinite(total) ? total : 0);
      },
      error: () => {
        this.chatUnreadCount.set(0);
      }
    });
  }

  private loadCounts(): void {
    this.refreshNotificationCount();
    this.refreshChatUnreadCount();
  }

  private canLoadRecruiterChatUnread(): boolean {
    const role = String(this.tokenService.getUserData()?.role ?? '').trim().toLowerCase();
    return role === 'recruiter' || role === 'recruteur';
  }

  private resolveUserId(): number | null {
    const id = Number(this.tokenService.getUserData()?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private handleMessage(message: WebSocketMessage): void {
    if (message.type === 'UserNotificationCreated') {
      const notification = this.normalizeNotificationPayload(message.payload as LiveNotificationPayload);
      if (!notification) {
        return;
      }

      if (this.seenNotificationIds.has(notification.id)) {
        return;
      }

      this.seenNotificationIds.add(notification.id);
      this.lastNotification.set(notification);

      if (notification.is_read !== true) {
        this.notificationUnreadCount.update((count) => count + 1);
      }

      return;
    }

    if (message.type === 'InternChatMessageSent') {
      const payload = message.payload as ChatMessagePayload;
      const receiverUserId = Number(payload?.message?.receiver_user_id ?? 0);
      const senderUserId = Number(payload?.message?.sender_user_id ?? 0);

      if (this.userId && receiverUserId === this.userId && senderUserId !== this.userId) {
        this.chatUnreadCount.update((count) => count + 1);
      }
    }
  }

  private normalizeNotificationPayload(
    payload: LiveNotificationPayload | null | undefined
  ): RealtimeNotificationItem | null {
    const notification = payload?.notification;
    if (!notification?.id) {
      return null;
    }

    return {
      id: Number(notification.id),
      title: notification.title || 'Notification',
      body: notification.body || '',
      message: notification.message ?? notification.body ?? '',
      type: notification.type ?? null,
      reference_id: notification.reference_id ?? null,
      application_id: notification.application_id ?? null,
      sent_at: notification.sent_at ?? null,
      is_read: notification.is_read ?? false,
      status: notification.status ?? null,
      channel: notification.channel ?? null,
      data: notification.data ?? {}
    };
  }
}
