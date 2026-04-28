import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PresenceService, UserPresence } from '../../../core/services/presence.service';
import { RealtimeUpdatesService } from '../../../core/services/realtime-updates.service';
import { TokenService } from '../../../core/services/token.service';
import {
  ChatAttachment,
  ChatMessagePayload,
  MessageReadPayload,
  PresenceUpdatePayload,
  WebSocketService,
  WebSocketMessage
} from '../../../core/services/websocket.service';

interface PendingAttachmentPreview {
  original_name: string;
  file_size: number;
  mime_type: string | null;
  extension: string | null;
  download_url?: string | null;
}

interface ConversationMember {
  key: string;
  roleLabel: string;
  fullName: string;
  picture: string | null;
  participant: any;
}

@Component({
  selector: 'app-recruiter-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-[1400px] mx-auto py-8 font-['Outfit']">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Internship Chat</h1>
          <p class="text-slate-500 font-semibold text-sm mt-1">
            Real-time communication with accepted internship candidates.
            <span *ngIf="wsConnected()" class="inline-flex items-center gap-1 text-emerald-600 ml-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
            <span *ngIf="!wsConnected()" class="inline-flex items-center gap-1 text-slate-400 ml-2">
              <span class="w-2 h-2 rounded-full bg-slate-400"></span>
              Connecting...
            </span>
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            (click)="reconnectWebSocket()"
            *ngIf="!wsConnected()"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            Reconnect
          </button>
          <a
            routerLink="/recruiter/intern-candidates"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Intern Candidates
          </a>
        </div>
      </div>

      <div class="grid lg:grid-cols-12 gap-6 min-h-[72vh]">
        <div class="lg:col-span-4 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div class="p-5 border-b border-slate-100">
            <div class="relative">
              <input
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event ?? '')"
                placeholder="Search candidate..."
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:bg-white transition-all"
              />
              <svg class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>

          <div class="max-h-[64vh] overflow-y-auto custom-scrollbar">
            <div *ngIf="loadingConversations()" class="p-10 text-center">
              <div class="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            </div>

            <button
              *ngFor="let item of filteredConversations(); trackBy: trackConversation"
              (click)="selectConversation(item)"
              class="w-full text-left px-5 py-4 border-b border-slate-50 hover:bg-slate-50/80 transition-colors"
              [class.bg-blue-50]="selectedApplicationId() === item.application_id"
            >
              <div class="flex items-start gap-3">
                <div class="relative shrink-0">
                  <img
                    *ngIf="item.candidate?.picture; else initials"
                    [src]="item.candidate.picture"
                    [alt]="item.candidate?.first_name || 'Candidate'"
                    class="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-sm"
                  />
                  <ng-template #initials>
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black uppercase">
                      {{ item.candidate?.first_name?.[0] }}{{ item.candidate?.last_name?.[0] }}
                    </div>
                  </ng-template>
                  <span
                    class="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white"
                    [class.bg-emerald-500]="candidateIsOnline(item)"
                    [class.bg-slate-300]="!candidateIsOnline(item)"
                  ></span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <p class="font-black text-sm text-slate-900 truncate">
                      {{ item.candidate?.first_name }} {{ item.candidate?.last_name }}
                    </p>
                    <span *ngIf="item.unread_count > 0" class="min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                      {{ item.unread_count }}
                    </span>
                  </div>
                  <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate mt-0.5">
                    {{ item.job_offer?.title || 'Internship' }}
                  </p>
                  <div class="mt-2 flex items-center gap-2">
                    <span
                      class="h-2 w-2 rounded-full"
                      [class.bg-emerald-500]="candidateIsOnline(item)"
                      [class.bg-slate-300]="!candidateIsOnline(item)"
                    ></span>
                    <p
                      class="text-[11px] font-semibold truncate"
                      [class.text-emerald-600]="candidateIsOnline(item)"
                      [class.text-slate-400]="!candidateIsOnline(item)"
                    >
                      {{ candidatePresenceText(item) }}
                    </p>
                  </div>
                  <p class="text-xs text-slate-500 font-semibold truncate mt-1">
                    {{ conversationPreview(item.last_message) || 'Start conversation...' }}
                  </p>
                </div>
              </div>
            </button>

            <div *ngIf="!loadingConversations() && filteredConversations().length === 0" class="p-10 text-center">
              <p class="text-sm font-black text-slate-800">No accepted internship candidates found.</p>
            </div>
          </div>
        </div>

        <div class="lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <ng-container *ngIf="selectedConversation(); else noSelection">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div class="min-w-0 flex items-center gap-3">
                <div class="relative shrink-0">
                  <img
                    *ngIf="selectedConversation()?.candidate?.picture; else selectedInitials"
                    [src]="selectedConversation()?.candidate?.picture"
                    [alt]="selectedConversation()?.candidate?.first_name || 'Candidate'"
                    class="w-11 h-11 rounded-xl object-cover border border-slate-100 shadow-sm"
                  />
                  <ng-template #selectedInitials>
                    <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black uppercase">
                      {{ selectedConversation()?.candidate?.first_name?.[0] }}{{ selectedConversation()?.candidate?.last_name?.[0] }}
                    </div>
                  </ng-template>
                  <span
                    class="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white"
                    [class.bg-emerald-500]="selectedCandidateIsOnline()"
                    [class.bg-slate-300]="!selectedCandidateIsOnline()"
                  ></span>
                </div>
                <div class="min-w-0">
                  <p class="font-black text-slate-900 truncate">
                    {{ selectedConversation()?.candidate?.first_name }} {{ selectedConversation()?.candidate?.last_name }}
                  </p>
                  <div class="mt-1 flex items-center gap-2 text-xs font-semibold">
                    <span
                      class="h-2 w-2 rounded-full"
                      [class.bg-emerald-500]="selectedCandidateIsOnline()"
                      [class.bg-slate-300]="!selectedCandidateIsOnline()"
                    ></span>
                    <span
                      [class.text-emerald-600]="selectedCandidateIsOnline()"
                      [class.text-slate-400]="!selectedCandidateIsOnline()"
                    >
                      {{ selectedCandidatePresenceText() }}
                    </span>
                    <span class="font-bold uppercase tracking-widest text-slate-400 truncate">
                      {{ selectedConversation()?.job_offer?.title }}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                (click)="toggleMembersPanel()"
                class="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all"
                [class.bg-blue-50]="membersPanelOpen()"
                [class.border-blue-200]="membersPanelOpen()"
                [class.text-blue-700]="membersPanelOpen()"
                title="View conversation members"
                aria-label="View conversation members"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>
              </button>
            </div>

            <div id="chat-scroll-box" class="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/60 px-6 py-5">
              <div *ngIf="loadingMessages()" class="py-8 text-center">
                <div class="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
              </div>

              <div *ngIf="!loadingMessages() && messages().length === 0" class="py-16 text-center">
                <p class="text-sm font-bold text-slate-500">No messages yet. Start the conversation.</p>
              </div>

              <div *ngFor="let msg of messages(); trackBy: trackMessage; let i = index" class="mb-3">
                <!-- Date separator for new days -->
                <div *ngIf="shouldShowDateSeparator(msg, i)" class="flex justify-center my-4">
                  <span class="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    {{ msg.created_at | date:'EEEE, MMMM d, y' }}
                  </span>
                </div>
                <div class="flex" [class.justify-end]="msg.is_mine">
                  <div
                    [class]="msg.is_mine
                      ? 'max-w-[75%] rounded-2xl rounded-br-md bg-blue-600 text-white px-4 py-3 shadow-sm'
                      : 'max-w-[75%] rounded-2xl rounded-bl-md bg-white text-slate-800 px-4 py-3 border border-slate-100 shadow-sm'"
                  >
                    <p [class]="msg.is_mine ? 'text-[11px] font-black text-blue-100 mb-1' : 'text-[11px] font-black text-slate-500 mb-1'">
                      {{ messageSenderName(msg) }}
                    </p>
                    <p *ngIf="msg.message" class="text-sm font-semibold whitespace-pre-wrap break-words">{{ msg.message }}</p>
                    <a
                      *ngIf="msg.attachment as attachment"
                      [attr.href]="attachment.download_url || null"
                      [attr.target]="attachment.download_url ? '_blank' : null"
                      [attr.rel]="attachment.download_url ? 'noopener' : null"
                      [class]="msg.is_mine
                        ? 'mt-2 flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-3 text-left hover:bg-white/20 transition-colors'
                        : 'mt-2 flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-left hover:bg-slate-100 transition-colors'"
                    >
                      <span [class]="msg.is_mine ? 'text-blue-100' : 'text-blue-600'">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M9 11h6"/></svg>
                      </span>
                      <span class="min-w-0 flex-1">
                        <span [class]="msg.is_mine ? 'block truncate text-xs font-black text-white' : 'block truncate text-xs font-black text-slate-900'">
                          {{ attachment.original_name }}
                        </span>
                        <span [class]="msg.is_mine ? 'block text-[10px] text-blue-100' : 'block text-[10px] text-slate-500'">
                          {{ formatAttachmentMeta(attachment) }}
                        </span>
                      </span>
                    </a>
                    <p [class]="msg.is_mine ? 'text-[10px] mt-2 text-blue-100' : 'text-[10px] mt-2 text-slate-400'">
                      {{ msg.created_at | date:'short' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="p-4 border-t border-slate-100 bg-white">
              <div class="space-y-3">
                <div
                  *ngIf="selectedAttachment"
                  class="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-black text-slate-900">{{ selectedAttachment.name }}</p>
                    <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {{ selectedAttachmentExtensionLabel() }} • {{ formatBytes(selectedAttachment.size) }}
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="clearSelectedAttachment()"
                    class="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 transition-colors"
                    aria-label="Remove attachment"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
                <div class="flex items-end gap-3">
                  <input
                    #attachmentInput
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    class="hidden"
                    (change)="onAttachmentSelected($event)"
                  />
                  <button
                    type="button"
                    (click)="attachmentInput.click()"
                    [disabled]="sending()"
                    class="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all disabled:opacity-50"
                    title="Attach PDF or Word document"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.82-2.83l8.49-8.48"/></svg>
                  </button>
                <textarea
                  [(ngModel)]="draftMessage"
                  (keydown)="onMessageKeydown($event)"
                  rows="2"
                  placeholder="Type a message or attach a file..."
                  class="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:bg-white resize-none transition-all"
                ></textarea>
                <button
                  (click)="sendMessage()"
                  [disabled]="sending() || (!draftMessage.trim() && !selectedAttachment)"
                  class="h-12 px-5 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {{ sending() ? 'Sending...' : 'Send' }}
                </button>
                </div>
              </div>
            </div>
          </ng-container>

          <ng-template #noSelection>
            <div class="flex-1 flex items-center justify-center p-10 text-center">
              <div>
                <div class="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h8"/><path d="M8 8h5"/></svg>
                </div>
                <p class="text-base font-black text-slate-900">Select a candidate to start chatting.</p>
              </div>
            </div>
          </ng-template>
        </div>
      </div>

      <div
        *ngIf="membersPanelOpen() && selectedConversation()"
        class="fixed inset-0 z-[90] bg-slate-950/65 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center"
        (click)="closeMembersPanel()"
      >
        <div
          class="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.45)]"
          (click)="$event.stopPropagation()"
        >
          <div class="pointer-events-none absolute -top-16 -right-14 h-44 w-44 rounded-full bg-blue-200/40 blur-3xl"></div>
          <div class="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-200/35 blur-3xl"></div>

          <div class="relative border-b border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-5 py-4 text-white">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <div class="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>
                </div>
                <div>
                  <p class="text-base font-black tracking-tight">Conversation Members</p>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-200">
                    <span class="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
                      {{ selectedConversation()?.is_group ? 'Group chat' : 'Direct chat' }}
                    </span>
                    <span class="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
                      {{ selectedConversationMembers().length }} member{{ selectedConversationMembers().length === 1 ? '' : 's' }}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                (click)="closeMembersPanel()"
                class="rounded-xl p-2 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
                aria-label="Close members popup"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>

          <div class="relative p-5 sm:p-6 max-h-[72vh] overflow-y-auto custom-scrollbar">
            <div class="grid gap-3 sm:grid-cols-2">
              <div
                *ngFor="let member of selectedConversationMembers(); trackBy: trackMember"
                class="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 opacity-70"></div>
                <div class="flex items-center gap-3">
                  <div class="relative shrink-0">
                    <img
                      *ngIf="member.picture; else memberInitials"
                      [src]="member.picture"
                      [alt]="member.fullName"
                      class="w-11 h-11 rounded-xl object-cover border border-slate-100"
                    />
                    <ng-template #memberInitials>
                      <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-xs font-black uppercase">
                        {{ memberInitial(member) }}
                      </div>
                    </ng-template>
                    <span
                      class="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white"
                      [class.bg-emerald-500]="participantIsOnline(member.participant)"
                      [class.bg-slate-300]="!participantIsOnline(member.participant)"
                    ></span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <p class="truncate text-sm font-black text-slate-900">{{ member.fullName }}</p>
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <svg *ngIf="member.roleLabel === 'Recruiter'" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>
                        <svg *ngIf="member.roleLabel === 'Candidate'" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20a6 6 0 0 1 12 0"/></svg>
                        <svg *ngIf="member.roleLabel === 'Binome'" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="3"/><path d="M3 20a6 6 0 0 1 9-5.2"/><path d="M14.5 20a5.5 5.5 0 0 1 6.5-5.4"/></svg>
                      </span>
                    </div>
                    <p class="mt-0.5 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                      {{ member.roleLabel }}
                    </p>
                    <p
                      class="mt-1 text-[11px] font-semibold"
                      [class.text-emerald-600]="participantIsOnline(member.participant)"
                      [class.text-slate-400]="!participantIsOnline(member.participant)"
                    >
                      {{ participantPresenceText(member.participant) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 12px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `]
})
export class RecruiterChatComponent implements OnInit, OnDestroy {
  private static readonly maxAttachmentBytes = 10 * 1024 * 1024;
  private static readonly allowedAttachmentExtensions = new Set(['pdf', 'doc', 'docx']);
  private static readonly selectedApplicationStorageKey = 'recruiter_chat_selected_application_id';

  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  private presenceService = inject(PresenceService);
  private route = inject(ActivatedRoute);
  private tokenService = inject(TokenService);
  private wsService = inject(WebSocketService);
  private realtimeUpdates = inject(RealtimeUpdatesService);
  private destroy$ = new Subject<void>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectBaseDelay = 1000;
  private messagePollingHandle: ReturnType<typeof setInterval> | null = null;
  private pollingMessagesInFlight = false;
  private readonly messagePollingIntervalMs = 3500;

  searchQuery = signal('');
  draftMessage = '';
  selectedAttachment: File | null = null;

  conversations = signal<any[]>([]);
  selectedApplicationId = signal<number | null>(null);
  selectedConversation = signal<any | null>(null);
  messages = signal<any[]>([]);
  conversationIds = signal<Map<number, number>>(new Map()); // Map applicationId -> conversationId
  userPresence = signal<Map<number, UserPresence>>(new Map());

  loadingConversations = signal(false);
  loadingMessages = signal(false);
  sending = signal(false);
  wsConnected = signal(false);
  membersPanelOpen = signal(false);

  // Track if we need to scroll to bottom on next message
  private shouldScrollToBottom = true;

  filteredConversations = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.conversations();

    return this.conversations().filter((item) => {
      const name = `${item?.candidate?.first_name || ''} ${item?.candidate?.last_name || ''}`.toLowerCase();
      const email = String(item?.candidate?.email || '').toLowerCase();
      const title = String(item?.job_offer?.title || '').toLowerCase();
      return name.includes(q) || email.includes(q) || title.includes(q);
    });
  });

  selectedConversationMembers = computed<ConversationMember[]>(() => {
    const conversation = this.selectedConversation();
    if (!conversation) {
      return [];
    }

    const members: ConversationMember[] = [];
    const candidateMember = this.toConversationMember('Candidate', conversation?.candidate, 'Candidate');
    if (candidateMember) {
      members.push(candidateMember);
    }

    const binomeMember = this.toConversationMember('Binome', conversation?.binome, 'Binome');
    if (binomeMember) {
      members.push(binomeMember);
    }

    const recruiterMember = this.resolveRecruiterMember(conversation);
    if (recruiterMember) {
      members.push(recruiterMember);
    }

    return members.filter((member, index, arr) => arr.findIndex((it) => it.key === member.key) === index);
  });

  ngOnInit(): void {
    const preselect = this.resolvePreselectedApplicationId();

    this.realtimeUpdates.ensureStarted();
    this.presenceService.markOnline();

    // Initialize WebSocket connection
    this.initializeWebSocket();

    this.loadConversations(preselect, true);

    // Store current user ID in WebSocket service for proper channel subscriptions
    const userData = this.tokenService.getUserData();
    if (userData?.id) {
      this.wsService.setCurrentUserId(userData.id);
    }

    // Listen for WebSocket messages (ALL messages - from conversation channel AND user channel)
    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message: WebSocketMessage) => {
        console.log('[Chat] Raw WebSocket message:', message.type, message.payload);
        this.handleWebSocketMessage(message);
      });

    // Listen for connection status
    this.wsService.isConnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected: boolean) => {
        this.wsConnected.set(connected);
        if (connected) {
          this.stopMessagePolling();
          this.reconnectAttempts = 0;
          // Subscribe to presence for online/offline
          this.wsService.subscribeToPresenceChannel();
          // Subscribe to conversation channel
          this.subscribeToCurrentConversation();
          // Also subscribe to user channel to receive messages sent to specific user
          if (userData?.id) {
            this.wsService.subscribeToUserChannel(userData.id);
          }
        } else {
          this.startMessagePolling();
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.stopMessagePolling();
    const conversationId = this.getCurrentConversationId();
    if (conversationId) {
      this.wsService.leaveConversation(conversationId);
    }
    this.wsService.leavePresenceChannel();
    this.presenceService.markOffline();
    this.presenceService.dispose();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeWebSocket(): void {
    const token = this.tokenService.getToken();
    const userData = this.tokenService.getUserData();
    
    console.log('[Chat] Initializing WebSocket for user:', userData?.id, userData?.email);
    console.log('[Chat] User role:', userData?.role);
    
    if (token) {
      this.wsService.connect(token);
    } else {
      console.error('[Chat] No auth token available for WebSocket');
    }
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'InternChatMessageSent':
        this.handleIncomingMessage(message.payload as ChatMessagePayload);
        break;
      case 'InternChatMessageRead':
        this.handleReadReceipt(message.payload as MessageReadPayload);
        break;
      case 'UserPresenceUpdated':
        this.handlePresenceUpdate(message.payload as PresenceUpdatePayload);
        break;
      case 'connection':
        console.log('[Chat] WebSocket connected');
        break;
      case 'error':
        console.error('[Chat] WebSocket error:', message.payload);
        break;
    }
  }

  private handleIncomingMessage(payload: ChatMessagePayload): void {
    const { message, conversation } = payload;
    
    console.log('[Chat] Handling incoming message:', message.id, 'from conversation:', conversation?.id, 'application:', conversation?.application_id);

    // Update conversation list with new message
    const currentConversations = this.conversations();
    const conversationIndex = currentConversations.findIndex(
      c => c.application_id === conversation.application_id
    );

    if (conversationIndex !== -1) {
      const updatedConversations = [...currentConversations];
      updatedConversations[conversationIndex] = {
        ...updatedConversations[conversationIndex],
        last_message: {
          id: message.id,
          message: message.message,
          sender_user_id: message.sender_user_id,
          created_at: message.created_at,
          preview: this.previewText(message.message, message.attachment || null),
          attachment: message.attachment || null,
        },
        last_activity_at: message.created_at,
        unread_count: this.isConversationSelected(conversation.application_id)
          ? 0
          : (updatedConversations[conversationIndex].unread_count || 0) + 1,
      };

      // Sort by last activity
      updatedConversations.sort((a, b) => {
        const dateA = new Date(a.last_activity_at || a.applied_at).getTime();
        const dateB = new Date(b.last_activity_at || b.applied_at).getTime();
        return dateB - dateA;
      });

      this.conversations.set(updatedConversations);
    } else {
      // NEW conversation - add it to the list!
      console.log('[Chat] New conversation received from candidate!');
      // Optionally refresh conversations from API
      this.loadConversations(this.selectedApplicationId(), false);
    }

    // If this is the currently selected conversation, add message to list
    if (this.isConversationSelected(conversation.application_id)) {
      const isDuplicate = this.messages().some(m => m.id === message.id);
      if (!isDuplicate) {
        const userData = this.tokenService.getUserData();
        const isMine = message.sender_user_id === userData?.id;
          this.messages.update(current => [...current, {
            id: message.id,
            message: message.message,
            created_at: message.created_at,
            read_at: message.read_at,
            sender_user_id: message.sender_user_id,
            receiver_user_id: message.receiver_user_id,
            is_mine: isMine,
            attachment: message.attachment || null,
            sender: message.sender,
          }]);
        this.shouldScrollToBottom = true;
        this.scrollMessagesToBottom();

        // Mark as read since we're viewing it
        if (!isMine) {
          this.markMessagesAsRead(conversation.application_id);
        }
      }
    } else {
      // Message from different conversation - just update unread count if not mine
      const userData = this.tokenService.getUserData();
      if (message.sender_user_id !== userData?.id) {
        console.log('[Chat] Message from non-selected conversation');
      }
    }
  }

  private handleReadReceipt(payload: MessageReadPayload): void {
    const { message_ids, read_at } = payload;

    // Update read status for messages
    this.messages.update(current =>
      current.map(msg => {
        if (message_ids.includes(msg.id)) {
          return { ...msg, read_at };
        }
        return msg;
      })
    );
  }

  private handlePresenceUpdate(payload: PresenceUpdatePayload): void {
    const userId = this.toPositiveNumber(payload?.user_id);
    if (!userId) {
      return;
    }

    console.log('[Chat] Presence update:', userId, 'online:', payload?.is_online);

    this.userPresence.update((current) => {
      const next = new Map(current);
      next.set(userId, {
        userId,
        isOnline: !!payload?.is_online,
        lastSeenAt: payload?.last_seen_at ?? null,
      });
      return next;
    });
  }

  private isConversationSelected(applicationId: number): boolean {
    return this.selectedApplicationId() === applicationId;
  }

  private subscribeToCurrentConversation(): void {
    const conversationId = this.getCurrentConversationId();
    this.wsService.subscribeToPresenceChannel();
    if (conversationId) {
      this.wsService.subscribeToConversation(conversationId);
    }
  }

  private getCurrentConversationId(): number | null {
    const appId = this.selectedApplicationId();
    if (!appId) return null;
    return this.conversationIds().get(appId) || null;
  }

  private markMessagesAsRead(applicationId: number): void {
    this.apiService.post<any>(`company/intern-chat/conversations/${applicationId}/read`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Update unread count in conversation
          const currentConversations = this.conversations();
          const index = currentConversations.findIndex(c => c.application_id === applicationId);
          if (index !== -1) {
            const updated = [...currentConversations];
            updated[index] = { ...updated[index], unread_count: 0 };
            this.conversations.set(updated);
          }
          this.realtimeUpdates.refreshChatUnreadCount();
        },
        error: (err) => console.error('Failed to mark messages as read:', err)
      });
  }

  trackConversation = (_: number, item: any) => item?.application_id;
  trackMessage = (_: number, item: any) => item?.id;
  trackMember = (_: number, member: ConversationMember) => member.key;

  toggleMembersPanel(): void {
    if (!this.selectedConversation()) {
      return;
    }
    this.membersPanelOpen.update((open) => !open);
  }

  closeMembersPanel(): void {
    this.membersPanelOpen.set(false);
  }

  memberInitial(member: ConversationMember): string {
    const tokens = String(member?.fullName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!tokens.length) {
      return '?';
    }

    const first = tokens[0]?.[0] || '';
    const second = tokens.length > 1 ? (tokens[1]?.[0] || '') : '';
    return `${first}${second}`.toUpperCase();
  }

  messageSenderName(message: any): string {
    if (!message) {
      return 'Unknown';
    }

    if (message?.is_mine) {
      return 'You';
    }

    const senderUserId = this.toPositiveNumber(message?.sender_user_id);
    const conversation = this.selectedConversation();

    const candidateUserId = this.toPositiveNumber(conversation?.candidate?.user_id);
    if (senderUserId && candidateUserId && senderUserId === candidateUserId) {
      return this.participantDisplayName(conversation?.candidate, 'Candidate');
    }

    const binomeUserId = this.toPositiveNumber(conversation?.binome?.user_id);
    if (senderUserId && binomeUserId && senderUserId === binomeUserId) {
      return this.participantDisplayName(conversation?.binome, 'Binome');
    }

    const senderEmail = String(message?.sender?.email || '').trim();
    if (senderEmail) {
      return senderEmail;
    }

    return 'Unknown';
  }

  selectConversation(item: any): void {
    const appId = Number(item?.application_id);
    if (!Number.isFinite(appId) || appId <= 0) return;

    // Leave previous conversation channel
    const prevConversationId = this.getCurrentConversationId();
    if (prevConversationId) {
      this.wsService.leaveConversation(prevConversationId);
    }

    this.selectedApplicationId.set(appId);
    this.selectedConversation.set(item);
    this.selectedAttachment = null;
    this.membersPanelOpen.set(false);
    this.persistSelectedApplicationId(appId);

    // Store conversation ID mapping for WebSocket subscription
    if (item?.conversation_id) {
      this.conversationIds.update(map => {
        const next = new Map(map);
        next.set(appId, item.conversation_id);
        return next;
      });
      this.wsService.subscribeToConversation(item.conversation_id);
    }

    this.loadMessages(appId, true);
    this.markMessagesAsRead(appId);
  }

  sendMessage(): void {
    const applicationId = this.selectedApplicationId();
    const messageText = this.draftMessage.trim();
    const attachmentFile = this.selectedAttachment;
    if (!applicationId || this.sending() || (!messageText && !attachmentFile)) {
      return;
    }

    this.sending.set(true);

    // Optimistically add message to UI
    const tempId = -Date.now(); // Temporary negative ID
    const userData = this.tokenService.getUserData();
    const optimisticMessage = {
      id: tempId,
      message: messageText || null,
      created_at: new Date().toISOString(),
      read_at: null,
      sender_user_id: userData?.id,
      receiver_user_id: null,
      is_mine: true,
      attachment: this.toPendingAttachmentPreview(attachmentFile),
      sender: {
        id: userData?.id,
        email: userData?.email || '',
        role: 'recruiter',
      },
    };

    this.messages.update(current => [...current, optimisticMessage]);
    this.shouldScrollToBottom = true;
    this.scrollMessagesToBottom();

    const formData = new FormData();
    if (messageText) {
      formData.append('message', messageText);
    }
    if (attachmentFile) {
      formData.append('attachment', attachmentFile);
    }

    this.draftMessage = '';
    this.selectedAttachment = null;

    this.apiService.post<any>(`company/intern-chat/conversations/${applicationId}/messages`, formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.sending.set(false);

          // Replace optimistic message with real one
          const realMessage = response?.data?.message;
          if (realMessage) {
            this.messages.update(current =>
              current.map(m => m.id === tempId ? { ...realMessage, is_mine: true } : m)
            );
          }

          // Update conversation list (will be updated by WebSocket as well)
          this.updateConversationLastMessage(applicationId, messageText, optimisticMessage.attachment);
        },
        error: (err) => {
          this.sending.set(false);
          // Remove optimistic message on error
          this.messages.update(current => current.filter(m => m.id !== tempId));
          this.draftMessage = messageText;
          this.selectedAttachment = attachmentFile;
          const errorMessage = err?.error?.message || err?.error?.error || 'Failed to send message.';
          this.notificationService.error(errorMessage);
        },
      });
  }

  private updateConversationLastMessage(
    applicationId: number,
    message: string | null,
    attachment: PendingAttachmentPreview | ChatAttachment | null
  ): void {
    const conversations = this.conversations();
    const index = conversations.findIndex(c => c.application_id === applicationId);
    if (index !== -1) {
      const updated = [...conversations];
      updated[index] = {
        ...updated[index],
        last_message: {
          message: message || null,
          preview: this.previewText(message, attachment),
          attachment,
          sender_user_id: this.tokenService.getUserData()?.id,
          created_at: new Date().toISOString(),
        },
        last_activity_at: new Date().toISOString(),
      };

      // Sort by last activity
      updated.sort((a, b) => {
        const dateA = new Date(a.last_activity_at || a.applied_at).getTime();
        const dateB = new Date(b.last_activity_at || b.applied_at).getTime();
        return dateB - dateA;
      });

      this.conversations.set(updated);
    }
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    if (!file) {
      return;
    }

    const extension = this.fileExtension(file.name);
    if (!extension || !RecruiterChatComponent.allowedAttachmentExtensions.has(extension)) {
      this.notificationService.error('Only PDF, DOC, and DOCX files are allowed.');
      return;
    }

    if (file.size > RecruiterChatComponent.maxAttachmentBytes) {
      this.notificationService.error('Attachment must be 10 MB or smaller.');
      return;
    }

    this.selectedAttachment = file;
  }

  clearSelectedAttachment(): void {
    this.selectedAttachment = null;
  }

  reconnectWebSocket(): void {
    this.wsService.disconnect();
    this.reconnectAttempts = 0;
    const token = this.tokenService.getToken();
    if (token) {
      setTimeout(() => {
        this.wsService.connect(token);
        this.loadConversations(this.selectedApplicationId(), false);
      }, 500);
    } else {
      this.notificationService.error('Authentication token not available. Please login again.');
    }
  }

  private loadConversations(preselectApplicationId: number | null, showLoader: boolean): void {
    if (showLoader) {
      this.loadingConversations.set(true);
    }

    this.apiService.get<any>('company/intern-chat/conversations')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.loadingConversations.set(false);
          const items = Array.isArray(res?.data) ? res.data : [];
          this.conversations.set(items);
          this.seedPresenceFromConversations(items);
          this.loadPresenceStatuses(items);

          // Store conversation ID mappings for WebSocket
          const conversationMap = new Map<number, number>();
          items.forEach((item: any) => {
            if (item.application_id && item.conversation_id) {
              conversationMap.set(item.application_id, item.conversation_id);
            }
          });
          this.conversationIds.set(conversationMap);

          const current = this.selectedApplicationId();
          let nextSelected = current;

          if (!nextSelected || !items.some((it: any) => Number(it?.application_id) === nextSelected)) {
            if (preselectApplicationId && items.some((it: any) => Number(it?.application_id) === preselectApplicationId)) {
              nextSelected = preselectApplicationId;
            } else {
              nextSelected = items.length ? Number(items[0].application_id) : null;
            }
          }

          this.selectedApplicationId.set(nextSelected);
          const selectedItem = items.find((it: any) => Number(it?.application_id) === nextSelected) || null;
          this.selectedConversation.set(selectedItem);
          this.persistSelectedApplicationId(nextSelected);

          // Subscribe to WebSocket channels for ALL conversations
          if (this.wsConnected()) {
            const userData = this.tokenService.getUserData();
            items.forEach((item: any) => {
              if (item.conversation_id) {
                this.wsService.subscribeToConversation(item.conversation_id);
              }
              // Also subscribe to candidate's user channel so we get messages even when not viewing that conversation
              if (item.candidate?.user_id) {
                this.wsService.subscribeToUserChannel(item.candidate.user_id);
              }
            });
            // Subscribe to presence for all online/offline status
            this.wsService.subscribeToPresenceChannel();
            // Subscribe to own user channel for notifications
            if (userData?.id) {
              this.wsService.subscribeToUserChannel(userData.id);
            }
          }

          if (nextSelected && (current !== nextSelected || this.messages().length === 0)) {
            this.loadMessages(nextSelected, true);
            this.markMessagesAsRead(nextSelected);
          }
        },
        error: (err) => {
          this.loadingConversations.set(false);
          if (showLoader) {
            const message = err?.error?.message || err?.error?.error || 'Failed to load conversations.';
            this.notificationService.error(message);
          }
        }
      });
  }

  private loadMessages(applicationId: number, showLoader: boolean): void {
    if (showLoader) {
      this.loadingMessages.set(true);
    }

    this.apiService.get<any>(`company/intern-chat/conversations/${applicationId}/messages`).subscribe({
      next: (res) => {
        this.loadingMessages.set(false);
        const messages = Array.isArray(res?.data?.messages) ? res.data.messages : [];
        this.messages.set(messages);

        if (res?.data?.conversation) {
          const merged = {
            ...(this.selectedConversation() || {}),
            ...res.data.conversation,
            application_id: applicationId,
          };
          this.selectedConversation.set(merged);
        }

        setTimeout(() => this.scrollMessagesToBottom(), 10);
      },
      error: (err) => {
        this.loadingMessages.set(false);
        if (showLoader) {
          const message = err?.error?.message || err?.error?.error || 'Failed to load messages.';
          this.notificationService.error(message);
        }
      }
    });
  }

  private scrollMessagesToBottom(): void {
    const el = document.getElementById('chat-scroll-box');
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      if (!this.wsConnected() && this.reconnectAttempts < this.maxReconnectAttempts) {
        const token = this.tokenService.getToken();
        if (token) {
          this.wsService.connect(token);
        }
      }
    }, delay);
  }

  private startMessagePolling(): void {
    if (this.messagePollingHandle) {
      return;
    }

    this.pollMessagesFromApi();
    this.messagePollingHandle = setInterval(() => {
      this.pollMessagesFromApi();
    }, this.messagePollingIntervalMs);
  }

  private stopMessagePolling(): void {
    if (this.messagePollingHandle) {
      clearInterval(this.messagePollingHandle);
      this.messagePollingHandle = null;
    }

    this.pollingMessagesInFlight = false;
  }

  private pollMessagesFromApi(): void {
    if (this.wsConnected() || this.pollingMessagesInFlight || this.sending()) {
      return;
    }

    const applicationId = this.selectedApplicationId();
    if (!applicationId) {
      return;
    }

    this.pollingMessagesInFlight = true;
    this.apiService.get<any>(`company/intern-chat/conversations/${applicationId}/messages`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.pollingMessagesInFlight = false;

          const incomingMessages = Array.isArray(res?.data?.messages) ? res.data.messages : [];
          const currentMessages = this.messages();
          const currentUserId = this.toPositiveNumber(this.tokenService.getUserData()?.id);
          const normalizedMessages = incomingMessages.map((msg: any) => ({
            ...msg,
            is_mine:
              typeof msg?.is_mine === 'boolean'
                ? msg.is_mine
                : !!currentUserId && Number(msg?.sender_user_id) === currentUserId,
          }));

          const currentLastId = this.toPositiveNumber(currentMessages[currentMessages.length - 1]?.id);
          const nextLastId = this.toPositiveNumber(normalizedMessages[normalizedMessages.length - 1]?.id);
          const hasChanged =
            normalizedMessages.length !== currentMessages.length || currentLastId !== nextLastId;

          if (!hasChanged) {
            return;
          }

          const previousIds = new Set(
            currentMessages
              .map((msg: any) => this.toPositiveNumber(msg?.id))
              .filter((id): id is number => !!id)
          );

          const wasNearBottom = this.isMessagesPaneNearBottom();
          this.messages.set(normalizedMessages);

          if (res?.data?.conversation) {
            const mergedConversation = {
              ...(this.selectedConversation() || {}),
              ...res.data.conversation,
              application_id: applicationId,
            };
            this.selectedConversation.set(mergedConversation);
          }

          const hasIncomingFromOthers = normalizedMessages.some((msg: any) => {
            const id = this.toPositiveNumber(msg?.id);
            if (!id || previousIds.has(id)) {
              return false;
            }
            return Number(msg?.sender_user_id) !== currentUserId;
          });

          if (hasIncomingFromOthers) {
            this.markMessagesAsRead(applicationId);
          }

          if (wasNearBottom) {
            this.shouldScrollToBottom = true;
            setTimeout(() => this.scrollMessagesToBottom(), 10);
          }
        },
        error: () => {
          this.pollingMessagesInFlight = false;
        }
      });
  }

  private isMessagesPaneNearBottom(thresholdPx = 140): boolean {
    const el = document.getElementById('chat-scroll-box');
    if (!el) {
      return true;
    }
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceToBottom <= thresholdPx;
  }

  conversationPreview(lastMessage: any): string {
    return this.previewText(lastMessage?.message ?? null, lastMessage?.attachment ?? null, lastMessage?.preview);
  }

  formatAttachmentMeta(attachment: ChatAttachment | PendingAttachmentPreview | null | undefined): string {
    if (!attachment) {
      return '';
    }

    const extension = attachment.extension?.toUpperCase() || this.fileExtension(attachment.original_name)?.toUpperCase() || 'FILE';
    return `${extension} • ${this.formatBytes(attachment.file_size)}`;
  }

  formatBytes(bytes: number | null | undefined): string {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const size = value / Math.pow(1024, exponent);
    return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  }

  selectedAttachmentExtensionLabel(): string {
    return this.fileExtension(this.selectedAttachment?.name || '')?.toUpperCase() || 'FILE';
  }

  private toPendingAttachmentPreview(file: File | null): PendingAttachmentPreview | null {
    if (!file) {
      return null;
    }

    return {
      original_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      extension: this.fileExtension(file.name),
      download_url: null,
    };
  }

  private previewText(
    message: string | null | undefined,
    attachment: ChatAttachment | PendingAttachmentPreview | null | undefined,
    explicitPreview?: string | null
  ): string {
    const trimmedMessage = String(message || '').trim();
    if (trimmedMessage) {
      return trimmedMessage;
    }

    const trimmedPreview = String(explicitPreview || '').trim();
    if (trimmedPreview) {
      return trimmedPreview;
    }

    if (attachment?.original_name) {
      return `Attachment: ${attachment.original_name}`;
    }

    return '';
  }

  private fileExtension(fileName: string): string | null {
    const normalized = String(fileName || '').trim();
    const lastDot = normalized.lastIndexOf('.');
    if (lastDot === -1 || lastDot === normalized.length - 1) {
      return null;
    }
    return normalized.slice(lastDot + 1).toLowerCase();
  }

  candidateIsOnline(item: any): boolean {
    return this.participantIsOnline(item?.candidate);
  }

  candidatePresenceText(item: any): string {
    return this.participantPresenceText(item?.candidate);
  }

  participantIsOnline(participant: any): boolean {
    return this.resolveParticipantPresence(participant)?.isOnline ?? false;
  }

  participantPresenceText(participant: any): string {
    return this.formatPresenceText(this.resolveParticipantPresence(participant));
  }

  selectedCandidateIsOnline(): boolean {
    return this.candidateIsOnline(this.selectedConversation());
  }

  selectedCandidatePresenceText(): string {
    return this.candidatePresenceText(this.selectedConversation());
  }

  private toConversationMember(
    roleLabel: string,
    participant: any,
    fallbackName: string
  ): ConversationMember | null {
    if (!participant) {
      return null;
    }

    const userId = this.toPositiveNumber(participant?.user_id ?? participant?.user?.id);
    const normalizedParticipant = {
      ...participant,
      user_id: userId ?? null,
      is_online: !!participant?.is_online,
      last_seen_at: participant?.last_seen_at ?? null,
    };
    const fullName = this.participantDisplayName(normalizedParticipant, fallbackName);
    const keyBase = userId ? `${userId}` : `${roleLabel}-${fullName}`.toLowerCase().replace(/\s+/g, '-');

    return {
      key: `${roleLabel.toLowerCase()}-${keyBase}`,
      roleLabel,
      fullName,
      picture: String(normalizedParticipant?.picture || '').trim() || null,
      participant: normalizedParticipant,
    };
  }

  private resolveRecruiterMember(conversation: any): ConversationMember | null {
    const recruiterParticipant = conversation?.recruiter;
    if (recruiterParticipant) {
      return this.toConversationMember('Recruiter', recruiterParticipant, 'Recruiter');
    }

    const userData = this.tokenService.getUserData();
    const userId = this.toPositiveNumber(userData?.id);
    if (!userId) {
      return null;
    }

    const fallbackRecruiter = {
      full_name: userData?.full_name || userData?.name || userData?.email || 'You',
      first_name: userData?.first_name || null,
      last_name: userData?.last_name || null,
      picture: userData?.picture || null,
      user_id: userId,
      is_online: true,
      last_seen_at: null,
    };

    return this.toConversationMember('Recruiter', fallbackRecruiter, 'You');
  }

  private participantDisplayName(participant: any, fallbackName: string): string {
    const composed = `${participant?.first_name || ''} ${participant?.last_name || ''}`.trim();
    const fullName = String(participant?.full_name || '').trim();
    const email = String(participant?.email || participant?.user?.email || '').trim();
    return composed || fullName || email || fallbackName;
  }

  private resolvePreselectedApplicationId(): number | null {
    const stateAppId = this.toPositiveNumber(window.history.state?.applicationId);
    const storedAppId = this.toPositiveNumber(
      sessionStorage.getItem(RecruiterChatComponent.selectedApplicationStorageKey)
    );
    const queryAppId = this.toPositiveNumber(this.route.snapshot.queryParamMap.get('applicationId'));

    if (queryAppId) {
      this.persistSelectedApplicationId(queryAppId);
    }

    return stateAppId ?? storedAppId ?? queryAppId;
  }

  private persistSelectedApplicationId(applicationId: number | null): void {
    if (applicationId) {
      sessionStorage.setItem(
        RecruiterChatComponent.selectedApplicationStorageKey,
        String(applicationId)
      );
    } else {
      sessionStorage.removeItem(RecruiterChatComponent.selectedApplicationStorageKey);
    }

    try {
      const nextState = { ...(window.history.state ?? {}) };
      if (applicationId) {
        nextState.applicationId = applicationId;
      } else {
        delete nextState.applicationId;
      }

      window.history.replaceState(nextState, '', window.location.pathname);
    } catch {
      // Ignore history update failures and keep the UI functional.
    }
  }

  private loadPresenceStatuses(items: any[]): void {
    const userIds = items.flatMap((item: any) => {
      const ids = [
        this.toPositiveNumber(item?.candidate?.user_id),
        this.toPositiveNumber(item?.binome?.user_id),
      ];
      return ids.filter((id): id is number => !!id);
    });

    this.presenceService.getUsersStatus(userIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe((statuses) => {
        if (!statuses.size) {
          return;
        }

        this.userPresence.update((current) => {
          const next = new Map(current);
          for (const [userId, presence] of statuses.entries()) {
            next.set(userId, presence);
          }
          return next;
        });
      });
  }

  private seedPresenceFromConversations(items: any[]): void {
    this.userPresence.update((current) => {
      const next = new Map(current);
      for (const item of items) {
        this.applyParticipantPresence(next, item?.candidate);
        this.applyParticipantPresence(next, item?.binome);
      }
      return next;
    });
  }

  private applyParticipantPresence(
    target: Map<number, UserPresence>,
    participant: any
  ): void {
    const userId = this.toPositiveNumber(participant?.user_id);
    if (!userId) {
      return;
    }

    target.set(userId, {
      userId,
      isOnline: !!participant?.is_online,
      lastSeenAt: participant?.last_seen_at ?? null,
    });
  }

  private resolveParticipantPresence(participant: any): UserPresence | null {
    const userId = this.toPositiveNumber(participant?.user_id);
    if (!userId) {
      return null;
    }

    return this.userPresence().get(userId) ?? {
      userId,
      isOnline: !!participant?.is_online,
      lastSeenAt: participant?.last_seen_at ?? null,
    };
  }

  private formatPresenceText(presence: UserPresence | null): string {
    if (!presence) {
      return 'Offline';
    }

    if (presence.isOnline) {
      return 'Online';
    }

    const relative = this.relativeTimeLabel(presence.lastSeenAt);
    return relative ? `Offline · ${relative}` : 'Offline';
  }

  private relativeTimeLabel(isoString: string | null): string | null {
    if (!isoString) {
      return null;
    }

    const parsed = new Date(isoString);
    const timestamp = parsed.getTime();
    if (!Number.isFinite(timestamp)) {
      return null;
    }

    const diffMs = Date.now() - timestamp;
    if (diffMs < 60_000) {
      return 'just now';
    }

    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  private toPositiveNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  shouldShowDateSeparator(msg: any, index: number): boolean {
    if (index === 0) return true;
    const currentDate = new Date(msg.created_at);
    const prevMsg = this.messages()[index - 1];
    const prevDate = new Date(prevMsg.created_at);
    return currentDate.toDateString() !== prevDate.toDateString();
  }
}
