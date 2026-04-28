import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: Echo;
  }
}

export interface WebSocketMessage {
  type:
    | 'InternChatMessageSent'
    | 'InternChatMessageRead'
    | 'UserPresenceUpdated'
    | 'UserNotificationCreated'
    | 'AiScoringCompleted'
    | 'connection'
    | 'error';
  payload: any;
  timestamp: Date;
}

export interface ChatAttachment {
  original_name: string;
  file_size: number;
  mime_type: string | null;
  download_url: string;
  extension?: string | null;
}

export interface ChatMessagePayload {
  message: {
    id: number;
    message: string | null;
    created_at: string;
    read_at: string | null;
    sender_user_id: number;
    receiver_user_id: number | null;
    attachment?: ChatAttachment | null;
    sender: {
      id: number;
      email: string;
      role: string;
    };
  };
  conversation: {
    id: number;
    application_id: number;
    candidate?: any;
    recruiter?: any;
    job_offer?: any;
    last_message_at: string;
  };
}

export interface MessageReadPayload {
  conversation_id: number;
  reader_user_id: number;
  message_ids: number[];
  read_at: string;
}

export interface PresenceUpdatePayload {
  user_id: number;
  is_online: boolean;
  last_seen_at: string | null;
}

export interface LiveNotificationPayload {
  notification: {
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
  };
}

export interface AiScoringPayload {
  application_id: number;
  ai_match_score: number | null;
  ai_degree_score: number | null;
  ai_semantic_score: number | null;
  ai_skill_score: number | null;
  ai_experience_score: number | null;
  ai_confidence_score: number | null;
  ai_explanation: string | null;
  ai_scored_at: string | null;
  ai_error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private readonly apiBaseUrl = environment.apiUrl.replace(/\/+$/, '');
  private readonly apiOrigin = this.apiBaseUrl.replace(/\/api$/, '');
  private readonly apiOriginUrl = new URL(this.apiOrigin);
  private readonly reverbConfig = (environment as any).reverb ?? {};
  private readonly reverbHost = this.reverbConfig.host || this.apiOriginUrl.hostname;
  private readonly reverbPort = Number(this.reverbConfig.port ?? 8081);
  private readonly reverbUseTLS = Boolean(
    this.reverbConfig.useTLS ?? (String(this.reverbConfig.scheme || '').toLowerCase() === 'https')
  );
  private readonly reverbAppKey = this.reverbConfig.key || 'recrutitn-websocket-key';

  private readonly config = {
    key: this.reverbAppKey,
    cluster: 'mt1',
    wsHost: this.reverbHost,
    wsPort: this.reverbPort,
    wssPort: this.reverbPort,
    forceTLS: this.reverbUseTLS,
    encrypted: this.reverbUseTLS,
    disableStats: true,
    enabledTransports: (this.reverbUseTLS ? ['wss'] : ['ws']) as ('ws' | 'wss')[],
    authEndpoint: `${this.apiBaseUrl}/broadcasting/auth`,
    auth: {
      headers: {} as Record<string, string>
    }
  };

  private echo: Echo | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);
  private messageSubject$ = new Subject<WebSocketMessage>();
  private activeChannels = new Set<string>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly heartbeatInterval = 30000;
  private heartbeatHandle: ReturnType<typeof setInterval> | null = null;
  private authToken: string | null = null;
  private currentUserId: number | null = null;
  private debugMode = true;
  private connecting = false;
  private lastConnectAttemptAt = 0;
  private readonly connectThrottleMs = 1000;
  private protocolMismatchWarned = false;

  public isConnected$ = this.connected$.asObservable();
  public messages$ = this.messageSubject$.asObservable();

  constructor() {
    window.Pusher = Pusher;
  }

  ngOnDestroy(): void {
    this.stopHeartbeat();
    this.disconnect();
  }

  setCurrentUserId(userId: number): void {
    this.currentUserId = userId;
  }

  connect(authToken: string): void {
    if (!authToken) {
      return;
    }

    if (this.echo && this.connected$.getValue()) {
      return;
    }

    if (this.connecting) {
      return;
    }

    const now = Date.now();
    if (now - this.lastConnectAttemptAt < this.connectThrottleMs) {
      return;
    }
    this.lastConnectAttemptAt = now;

    if (this.echo && !this.connected$.getValue()) {
      this.disconnect();
    }

    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isHttpsPage && !this.reverbUseTLS) {
      if (this.debugMode && !this.protocolMismatchWarned) {
        console.warn(
          '[WebSocket] HTTPS page + non-TLS Reverb detected. Browser enforces WSS. ' +
            'Use http://localhost:4200 or enable TLS for Reverb on port 8081. ' +
            'WebSocket is skipped and fallback polling should be used.'
        );
      }
      this.protocolMismatchWarned = true;
      this.connected$.next(false);
      this.connecting = false;
      return;
    }
    this.protocolMismatchWarned = false;

    this.authToken = authToken;
    this.config.auth.headers = {
      Authorization: `Bearer ${authToken}`,
      Accept: 'application/json'
    };
    this.connecting = true;

    if (this.debugMode) {
      console.log('[WebSocket] Config:', {
        wsHost: this.config.wsHost,
        wsPort: this.config.wsPort,
        forceTLS: this.config.forceTLS,
        enabledTransports: this.config.enabledTransports
      });
    }

    try {
      this.echo = new Echo({
        broadcaster: 'pusher',
        key: this.config.key,
        cluster: this.config.cluster,
        wsHost: this.config.wsHost,
        wsPort: this.config.wsPort,
        wssPort: this.config.wssPort,
        forceTLS: this.config.forceTLS,
        encrypted: this.config.encrypted,
        disableStats: this.config.disableStats,
        enabledTransports: this.config.enabledTransports,
        authEndpoint: this.config.authEndpoint,
        auth: this.config.auth
      });
      window.Echo = this.echo;

      if (this.debugMode) {
        console.log('[WebSocket] Connecting to Pusher...');
      }

      this.echo.connector.pusher.connection.bind('connected', () => {
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.connected$.next(true);
        this.startHeartbeat();
        this.resubscribeChannels();
        if (this.debugMode) {
          console.log('[WebSocket] Connected! Resubscribing to channels...');
        }
        this.messageSubject$.next({
          type: 'connection',
          payload: { status: 'connected' },
          timestamp: new Date()
        });
      });

      this.echo.connector.pusher.connection.bind('disconnected', () => {
        this.connecting = false;
        this.connected$.next(false);
        this.stopHeartbeat();
        if (this.debugMode) {
          console.log('[WebSocket] Disconnected. Scheduling reconnect...');
        }
        this.scheduleReconnect();
      });

      this.echo.connector.pusher.connection.bind('error', (error: any) => {
        this.connecting = false;
        if (this.debugMode) {
          console.error('[WebSocket] Error:', error);
        }
        this.messageSubject$.next({
          type: 'error',
          payload: error,
          timestamp: new Date()
        });
      });
    } catch (error) {
      this.connecting = false;
      if (this.debugMode) {
        console.error('[WebSocket] Connection error:', error);
      }
      this.messageSubject$.next({
        type: 'error',
        payload: { error },
        timestamp: new Date()
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    
    const token = this.authToken;
    if (!token) {
      return;
    }

    this.reconnectAttempts++;
    const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      if (!this.connected$.getValue()) {
        this.disconnect();
        setTimeout(() => this.connect(token), 100);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatHandle = setInterval(() => {
      if (this.connected$.getValue() && this.echo) {
        (this.echo.connector.pusher as any).connection.handleHandshake?.();
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatHandle) {
      clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = null;
    }
  }

  private resubscribeChannels(): void {
    const channels = [...this.activeChannels];
    this.activeChannels.clear();
    channels.forEach((channelName) => {
      if (channelName.startsWith('chat.conversation.')) {
        const id = channelName.replace('chat.conversation.', '');
        this.subscribeToConversation(parseInt(id, 10));
      } else if (channelName === 'presence') {
        this.subscribeToPresenceChannel();
      } else if (channelName.startsWith('user.')) {
        const id = channelName.replace('user.', '');
        this.subscribeToUserChannel(parseInt(id, 10));
      }
    });
  }

  disconnect(): void {
    this.connecting = false;
    const channels = [...this.activeChannels];
    channels.forEach((channelName) => this.leaveChannel(channelName));

    if (this.echo) {
      this.echo.disconnect();
      this.echo = null;
    }

    this.activeChannels.clear();
    this.connected$.next(false);
  }

  subscribeToConversation(conversationId: number): Observable<ChatMessagePayload> {
    const channelName = `chat.conversation.${conversationId}`;

    if (!this.echo) {
      return new Observable();
    }

    if (!this.activeChannels.has(channelName)) {
      this.activeChannels.add(channelName);

      if (this.debugMode) {
        console.log(`[WebSocket] Subscribing to conversation channel: ${channelName}`);
      }

      this.echo
        .private(channelName)
        .listen('.InternChatMessageSent', (event: ChatMessagePayload) => {
          if (this.debugMode) {
            console.log('[WebSocket] Received message:', event?.message?.id);
          }
          this.messageSubject$.next({
            type: 'InternChatMessageSent',
            payload: event,
            timestamp: new Date()
          });
        })
        .listen('.InternChatMessageRead', (event: MessageReadPayload) => {
          if (this.debugMode) {
            console.log('[WebSocket] Received read receipt:', event?.message_ids);
          }
          this.messageSubject$.next({
            type: 'InternChatMessageRead',
            payload: event,
            timestamp: new Date()
          });
        });
    }

    return this.messages$.pipe(
      filter((msg) => msg.type === 'InternChatMessageSent'),
      filter((msg) => msg.payload?.conversation?.id === conversationId),
      map((msg) => msg.payload as ChatMessagePayload)
    );
  }

  subscribeToUserChannel(userId: number): Observable<WebSocketMessage> {
    const channelName = `user.${userId}`;

    if (!this.echo) {
      return new Observable();
    }

    if (!this.activeChannels.has(channelName)) {
      this.activeChannels.add(channelName);

      this.echo
        .private(channelName)
        .listen('.InternChatMessageSent', (event: ChatMessagePayload) => {
          this.messageSubject$.next({
            type: 'InternChatMessageSent',
            payload: event,
            timestamp: new Date()
          });
        })
        .listen('.UserNotificationCreated', (event: LiveNotificationPayload) => {
          this.messageSubject$.next({
            type: 'UserNotificationCreated',
            payload: event,
            timestamp: new Date()
          });
        })
        .listen('.AiScoringCompleted', (event: AiScoringPayload) => {
          if (this.debugMode) {
            console.log('[WebSocket] AI scoring completed for application:', event?.application_id);
          }
          this.messageSubject$.next({
            type: 'AiScoringCompleted',
            payload: event,
            timestamp: new Date()
          });
        });
    }

    return this.messages$.pipe(
      filter((msg) => msg.type === 'InternChatMessageSent' || msg.type === 'UserNotificationCreated' || msg.type === 'AiScoringCompleted')
    );
  }

  /**
   * Get an observable that emits when AI scoring completes for any application
   */
  getAiScoringEvents(): Observable<AiScoringPayload> {
    return this.messages$.pipe(
      filter((msg) => msg.type === 'AiScoringCompleted'),
      map((msg) => msg.payload as AiScoringPayload)
    );
  }

  subscribeToPresenceChannel(): Observable<PresenceUpdatePayload> {
    const channelName = 'presence';

    if (!this.echo) {
      return new Observable();
    }

    if (!this.activeChannels.has(channelName)) {
      this.activeChannels.add(channelName);

      this.echo
        .private(channelName)
        .listen('.UserPresenceUpdated', (event: PresenceUpdatePayload) => {
          this.messageSubject$.next({
            type: 'UserPresenceUpdated',
            payload: event,
            timestamp: new Date()
          });
        });
    }

    return this.messages$.pipe(
      filter((msg) => msg.type === 'UserPresenceUpdated'),
      map((msg) => msg.payload as PresenceUpdatePayload)
    );
  }

  leaveChannel(channelName: string): void {
    if (!this.echo || !this.activeChannels.has(channelName)) {
      return;
    }

    this.echo.leave(channelName);
    this.activeChannels.delete(channelName);
  }

  leaveConversation(conversationId: number): void {
    this.leaveChannel(`chat.conversation.${conversationId}`);
  }

  leaveUserChannel(userId: number): void {
    this.leaveChannel(`user.${userId}`);
  }

  leavePresenceChannel(): void {
    this.leaveChannel('presence');
  }

  isConnected(): boolean {
    return this.connected$.getValue();
  }

  updateAuthToken(token: string): void {
    this.authToken = token;
    this.config.auth.headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    };

    if (!this.connected$.getValue()) {
      this.disconnect();
      setTimeout(() => this.connect(token), 100);
    }
  }

  getPrivateChannel(userId: number): string {
    return `private-user.${userId}`;
  }

  subscribeToPrivateUserChannel(userId: number): Observable<WebSocketMessage> {
    const channelName = `private-user.${userId}`;

    if (!this.echo) {
      return new Observable();
    }

    if (!this.activeChannels.has(channelName)) {
      this.activeChannels.add(channelName);

      if (this.debugMode) {
        console.log(`[WebSocket] Subscribing to user channel: ${channelName}`);
      }

      this.echo
        .private(channelName)
        .listen('.InternChatMessageSent', (event: ChatMessagePayload) => {
          if (this.debugMode) {
            console.log('[WebSocket] User channel - message received');
          }
          this.messageSubject$.next({
            type: 'InternChatMessageSent',
            payload: event,
            timestamp: new Date()
          });
        })
        .listen('.UserNotificationCreated', (event: LiveNotificationPayload) => {
          this.messageSubject$.next({
            type: 'UserNotificationCreated',
            payload: event,
            timestamp: new Date()
          });
        });
    }

    return this.messages$.pipe(
      filter((msg) => msg.type === 'InternChatMessageSent' || msg.type === 'UserNotificationCreated')
    );
  }

  leavePrivateUserChannel(userId: number): void {
    this.leaveChannel(`private-user.${userId}`);
  }
}
