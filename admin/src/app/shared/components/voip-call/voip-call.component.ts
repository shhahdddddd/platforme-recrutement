import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CallSession {
  id: string;
  callerName: string;
  callerRole: string;
  candidateName: string;
  jobTitle: string;
  startTime?: Date;
  status: 'ringing' | 'connected' | 'ended' | 'error';
}

@Component({
  selector: 'app-voip-call',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Call Overlay -->
    <div *ngIf="isVisible()" class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-slate-900/80 backdrop-blur-md" (click)="minimizeCall()"></div>
      
      <!-- Call Card -->
      <div class="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden transform transition-all"
           [class.scale-95]="isMinimized()"
           [class.scale-100]="!isMinimized()">
        
        <!-- Header Gradient -->
        <div class="h-32 bg-gradient-to-br from-blue-600 via-violet-600 to-cyan-600 relative overflow-hidden">
          <!-- Animated Waves -->
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-64 h-64 rounded-full border border-white/20 animate-ping" style="animation-duration: 2s;"></div>
            <div class="absolute w-48 h-48 rounded-full border border-white/30 animate-ping" style="animation-duration: 2.5s; animation-delay: 0.3s;"></div>
            <div class="absolute w-32 h-32 rounded-full border border-white/40 animate-ping" style="animation-duration: 3s; animation-delay: 0.6s;"></div>
          </div>
          
          <!-- Avatar -->
          <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div class="w-24 h-24 rounded-full bg-white p-1 shadow-xl">
              <div class="w-full h-full rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Call Info -->
        <div class="pt-16 pb-8 px-8 text-center">
          <h3 class="text-xl font-black text-slate-900">{{ session()?.candidateName || 'Candidate' }}</h3>
          <p class="text-sm font-semibold text-slate-500 mt-1">{{ session()?.jobTitle || 'Interview Call' }}</p>
          
          <!-- Status -->
          <div class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider"
               [class.bg-amber-100]="session()?.status === 'ringing'"
               [class.text-amber-600]="session()?.status === 'ringing'"
               [class.bg-emerald-100]="session()?.status === 'connected'"
               [class.text-emerald-600]="session()?.status === 'connected'"
               [class.bg-rose-100]="session()?.status === 'ended' || session()?.status === 'error'"
               [class.text-rose-600]="session()?.status === 'ended' || session()?.status === 'error'">
            <span class="w-2 h-2 rounded-full animate-pulse"
                  [class.bg-amber-500]="session()?.status === 'ringing'"
                  [class.bg-emerald-500]="session()?.status === 'connected'"
                  [class.bg-rose-500]="session()?.status === 'ended' || session()?.status === 'error'">
            </span>
            {{ getStatusLabel() }}
          </div>
          
          <!-- Duration -->
          <p *ngIf="session()?.status === 'connected'" class="text-3xl font-black text-slate-800 mt-4 font-mono tracking-wider">
            {{ callDuration() }}
          </p>
        </div>
        
        <!-- Controls -->
        <div class="px-8 pb-8">
          <div class="flex items-center justify-center gap-4">
            <!-- Mute -->
            <button 
              (click)="toggleMute()"
              [class.bg-slate-100]="!isMuted()"
              [class.bg-amber-100]="isMuted()"
              [class.text-slate-600]="!isMuted()"
              [class.text-amber-600]="isMuted()"
              class="w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95">
              <svg *ngIf="!isMuted()" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3 3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
              <svg *ngIf="isMuted()" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3 3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="1" x2="23" y1="1" y2="23"/>
              </svg>
            </button>
            
            <!-- Speaker -->
            <button 
              (click)="toggleSpeaker()"
              [class.bg-slate-100]="!isSpeakerOn()"
              [class.bg-blue-100]="isSpeakerOn()"
              [class.text-slate-600]="!isSpeakerOn()"
              [class.text-blue-600]="isSpeakerOn()"
              class="w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95">
              <svg *ngIf="!isSpeakerOn()" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
              <svg *ngIf="isSpeakerOn()" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </button>
            
            <!-- End Call -->
            <button 
              (click)="endCall()"
              class="w-16 h-16 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-105 active:scale-95 hover:bg-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Audio Level Indicator -->
        <div *ngIf="session()?.status === 'connected'" class="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
          <div class="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-100"
               [style.width.%]="audioLevel()"></div>
        </div>
      </div>
    </div>
    
    <!-- Minimized Call Bubble -->
    <div *ngIf="isMinimized() && session()" 
         (click)="restoreCall()"
         class="fixed bottom-6 right-6 z-[9998] w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-500/30 cursor-pointer flex items-center justify-center animate-pulse hover:scale-110 transition-transform">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
      <span class="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></span>
    </div>
  `
})
export class VoipCallComponent implements OnInit, OnDestroy {
  @Input() session = signal<CallSession | null>(null);
  @Output() callEnded = new EventEmitter<void>();
  @Output() callMinimized = new EventEmitter<boolean>();
  
  // UI State
  isVisible = signal(true);
  isMinimized = signal(false);
  isMuted = signal(false);
  isSpeakerOn = signal(false);
  audioLevel = signal(0);
  callDuration = signal('00:00');
  
  // WebRTC
  private localStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private callTimer: any = null;
  private audioMonitor: any = null;
  private startTime: Date | null = null;
  
  // STUN/TURN servers for NAT traversal
  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };
  
  ngOnInit() {
    this.initializeCall();
  }
  
  ngOnDestroy() {
    this.cleanup();
  }
  
  private async initializeCall() {
    try {
      // Get user media (microphone)
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      // Update session status
      const current = this.session();
      if (current) {
        this.session.set({ ...current, status: 'connected', startTime: new Date() });
      }
      
      this.startTime = new Date();
      this.startCallTimer();
      this.startAudioMonitoring();
      
      // In a real implementation, you would:
      // 1. Connect to your signaling server (WebSocket)
      // 2. Exchange SDP offers/answers
      // 3. Exchange ICE candidates
      // 4. Establish peer connection
      
    } catch (error) {
      console.error('Failed to initialize call:', error);
      const current = this.session();
      if (current) {
        this.session.set({ ...current, status: 'error' });
      }
    }
  }
  
  private startCallTimer() {
    this.callTimer = setInterval(() => {
      if (this.startTime) {
        const diff = Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000);
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        this.callDuration.set(`${minutes}:${seconds}`);
      }
    }, 1000);
  }
  
  private startAudioMonitoring() {
    // Simulate audio levels for UI demonstration
    // In production, use Web Audio API to analyze actual audio levels
    this.audioMonitor = setInterval(() => {
      if (this.session()?.status === 'connected' && !this.isMuted()) {
        // Simulate random audio levels between 20-80%
        this.audioLevel.set(Math.floor(Math.random() * 60) + 20);
      } else {
        this.audioLevel.set(0);
      }
    }, 100);
  }
  
  toggleMute() {
    this.isMuted.update(v => !v);
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted();
      });
    }
  }
  
  toggleSpeaker() {
    this.isSpeakerOn.update(v => !v);
    // In a real implementation, route audio to speaker/earpiece
  }
  
  endCall() {
    const current = this.session();
    if (current) {
      this.session.set({ ...current, status: 'ended' });
    }
    
    // Emit event after short delay for animation
    setTimeout(() => {
      this.callEnded.emit();
      this.cleanup();
      this.isVisible.set(false);
    }, 500);
  }
  
  minimizeCall() {
    this.isMinimized.set(true);
    this.callMinimized.emit(true);
  }
  
  restoreCall() {
    this.isMinimized.set(false);
    this.callMinimized.emit(false);
  }
  
  getStatusLabel(): string {
    const status = this.session()?.status;
    switch (status) {
      case 'ringing': return 'Calling...';
      case 'connected': return 'Connected';
      case 'ended': return 'Call Ended';
      case 'error': return 'Call Failed';
      default: return 'Unknown';
    }
  }
  
  private cleanup() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
    }
    if (this.audioMonitor) {
      clearInterval(this.audioMonitor);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
  }
  
  // WebRTC Signaling Methods (for future implementation)
  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;
    
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }
  
  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
  
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
}

// WebSocket Signaling Service (for production use)
export class VoipSignalingService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  connect(roomId: string, userId: string) {
    // Connect to your WebSocket signaling server
    // const wsUrl = `wss://your-server.com/ws/call/${roomId}?userId=${userId}`;
    // this.ws = new WebSocket(wsUrl);
    
    // this.ws.onopen = () => {
    //   this.reconnectAttempts = 0;
    // };
    
    // this.ws.onmessage = (event) => {
    //   const message = JSON.parse(event.data);
    //   this.handleSignalingMessage(message);
    // };
    
    // this.ws.onclose = () => {
    //   this.attemptReconnect(roomId, userId);
    // };
  }
  
  sendOffer(offer: RTCSessionDescriptionInit, targetUserId: string) {
    this.send({ type: 'offer', offer, targetUserId });
  }
  
  sendAnswer(answer: RTCSessionDescriptionInit, targetUserId: string) {
    this.send({ type: 'answer', answer, targetUserId });
  }
  
  sendIceCandidate(candidate: RTCIceCandidate, targetUserId: string) {
    this.send({ type: 'ice-candidate', candidate, targetUserId });
  }
  
  private send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  private attemptReconnect(roomId: string, userId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(roomId, userId), 2000 * this.reconnectAttempts);
    }
  }
  
  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
  
  private handleSignalingMessage(message: any) {
    // Handle incoming signaling messages
    // - offers
    // - answers  
    // - ice candidates
  }
}
