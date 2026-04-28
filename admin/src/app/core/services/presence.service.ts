import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface UserPresence {
  userId: number;
  isOnline: boolean;
  lastSeenAt: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class PresenceService {
  private readonly heartbeatMs = 60_000;
  private apiService = inject(ApiService);
  private heartbeatHandle: ReturnType<typeof setInterval> | null = null;

  markOnline(): void {
    this.apiService.post<any>('presence/online', {}).subscribe({
      next: () => this.startHeartbeat(),
      error: () => this.startHeartbeat(),
    });
  }

  markOffline(): void {
    this.stopHeartbeat();
    this.apiService.post<any>('presence/offline', {}).subscribe({
      error: () => {},
    });
  }

  getUsersStatus(userIds: number[]): Observable<Map<number, UserPresence>> {
    const normalizedIds = [...new Set(
      userIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )];

    if (!normalizedIds.length) {
      return of(new Map<number, UserPresence>());
    }

    return this.apiService.post<any>('presence/status', { user_ids: normalizedIds }).pipe(
      map((res) => {
        const statuses = new Map<number, UserPresence>();
        const items = Array.isArray(res?.data) ? res.data : [];
        for (const item of items) {
          const userId = Number(item?.user_id);
          if (!Number.isFinite(userId) || userId <= 0) {
            continue;
          }

          statuses.set(userId, {
            userId,
            isOnline: !!item?.is_online,
            lastSeenAt: item?.last_seen_at ?? null,
          });
        }
        return statuses;
      }),
      catchError(() => of(new Map<number, UserPresence>()))
    );
  }

  sendHeartbeat(): void {
    this.apiService.post<any>('presence/heartbeat', {}).subscribe({
      error: () => {},
    });
  }

  dispose(): void {
    this.stopHeartbeat();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatHandle = setInterval(() => this.sendHeartbeat(), this.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatHandle) {
      return;
    }

    clearInterval(this.heartbeatHandle);
    this.heartbeatHandle = null;
  }
}
