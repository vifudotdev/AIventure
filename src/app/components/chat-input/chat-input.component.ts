/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../../services/socket.interface';
import { SOCKET_SERVICE } from '../../services/socket-token';
import { EventBus } from '../../../game/core/EventBus';
import { LogService } from '../../services/log.service';
import { MODEL_BACKEND } from '../../services/model-token';
import { ModelBackend } from '../../services/model-backend.interface';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.css'
})
export class ChatInputComponent implements OnInit, OnDestroy {
  @ViewChild('chatInput') chatInput!: ElementRef;
  isVisible = false;
  isAiMode = false;
  message = '';
  isInputLocked = false;
  visibleInteractions: any[] = [];
  npcOrigin: any = null;
  activeBuildInteraction: any = null;
  collectiblesTracker: Record<string, { count: number; max: number }> = {};
  isProcessing = false;

  constructor(
    @Inject(SOCKET_SERVICE) private socketService: SocketService | null,
    @Inject(MODEL_BACKEND) private modelService: ModelBackend,
    private logService: LogService
  ) {}

  ngOnInit() {
    EventBus.on('lock-input', this.handleInputLock, this);
    EventBus.on('visible-interactions', (interactions: any[]) => {
      this.modelService.reset();
      this.visibleInteractions = interactions;
    });
    EventBus.on('ask-model', this.handleBackChannel, this);
    EventBus.on('visible-build-interaction', (interaction: any) => {
      this.modelService.reset();
      this.activeBuildInteraction = interaction;
    });
    EventBus.on('open-chat-input', this.handleOpenChatInput, this);
    EventBus.on('collectibles-tracker', (tracker: any) =>
    {
      this.collectiblesTracker = tracker;
    });
  }

  ngOnDestroy() {
    EventBus.off('lock-input', this.handleInputLock, this);
    EventBus.off('visible-interactions');
    EventBus.off('ask-model', this.handleBackChannel, this);
    EventBus.off('visible-build-interaction');
    EventBus.off('open-chat-input', this.handleOpenChatInput, this);
  }

  handleInputLock(isLocked: boolean) {
    this.isInputLocked = isLocked;
  }

  handleOpenChatInput(data: any) {
    this.isVisible = true;
    this.isAiMode = true;
    EventBus.emit('lock-input', true);
    setTimeout(() => {
        if (this.chatInput) {
            this.npcOrigin = data;
            this.chatInput.nativeElement.focus();
        }
    }, 0);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.isInputLocked && !this.isVisible) {
      return;
    }

    if (event.key === 'Enter') {
      if (this.isVisible) {
        if (this.isProcessing) {
          event.preventDefault();
          return;
        }
        this.sendMessage();
      } else {
        this.isVisible = true;
        this.isAiMode = this.socketService ? event.shiftKey : true;
        EventBus.emit('lock-input', true);
        setTimeout(() => {
          this.chatInput?.nativeElement.focus();
        }, 0);
        event.preventDefault();
      }
    } else if (event.key === 'Escape') {
      if (this.isVisible) {
        this.closeModal();
      }
    }
  }

  async handleBackChannel(context: string, prompt: string) {
    const sendLog = this.logService.createStreamableLog({
      summary: `Sending to Model, user prompt: "${prompt}"`,
      type: 'log',
      detail: `Context: ${context}`,
      // file: 'chat-input.component.ts',
      // lineNumber: '118'
      inspect: '',
      sequence: ['angular', 'local-gemma']
    });
    sendLog.finish();

    const responseLog = this.logService.createStreamableLog({
      summary: 'Model Response',
      type: 'log',
      // file: 'chat-input.component.ts',
      // lineNumber: '126'
      inspect: '',
      sequence: ['local-gemma', 'angular']
    });

    let fullAiResponse = '';
    try {
      // only uses context, no tool list yet.
      const stream = this.modelService.generateTextStream("", context, prompt);

      for await (const chunk of stream) {
        fullAiResponse += chunk;
        responseLog.append(chunk);
      }
      this.extractAndEmitCode(fullAiResponse);
      responseLog.append('\nModel Stream Complete.');
      responseLog.finish();
      this.modelService.reset();
    } catch (error) {
      responseLog.append(`\nModel Stream Error: ${error}`);
      responseLog.finish();
    }
  }

  private prettyJSON(json: string): string
  {
    return JSON.stringify(JSON.parse(json), null, 2);
  }

  async sendMessage() {
    if (this.isProcessing) return;

    if (!this.message.trim()) {
      this.modelService.reset();
      this.closeModal();
      return;
    }

    if (this.activeBuildInteraction && this.isAiMode) {
        EventBus.emit('build-html-request', this.message);
        this.closeModal();
        return;
    }

    if (this.npcOrigin) {
        EventBus.emit('npc-interaction', this.npcOrigin, this.message);
        this.closeModal();
        return;
    }

    if (this.isAiMode) {
      this.isProcessing = true;
      // Request code context
      let codeContext = '';
      const codeHandler = (code: string) => {
        codeContext = code;
      };
      EventBus.on('provide-code-context', codeHandler);
      EventBus.emit('request-code-context');
      EventBus.off('provide-code-context', codeHandler);

      const tools = [...this.visibleInteractions];

      const tool_list = JSON.stringify(tools);
      const context = codeContext ? `Current Code:\n${codeContext}` : "";
      
      const sendLog = this.logService.createStreamableLog({
        summary: `Sending to Model, user prompt: "${this.message}"`,
        type: 'log',
        detail: `Tool List: ${this.prettyJSON(tool_list)}\nContext: ${context}`,
        // file: 'chat-input.component.ts',
        // lineNumber: '174'
        inspect: '',
        sequence: ['angular', 'local-gemma']
      });
      sendLog.finish();

      const responseLog = this.logService.createStreamableLog({
        summary: 'Model Response',
        type: 'log',
        // file: 'chat-input.component.ts',
        // lineNumber: '182'
        inspect: '',
        sequence: ['local-gemma', 'angular']
      });

      let fullAiResponse = '';
      try {
        const stream = this.modelService.generateTextStream(tool_list, context, this.message);

        for await (const chunk of stream) {
          if (!this.isProcessing) break;
          fullAiResponse += chunk;
          responseLog.append(chunk);
        }
        if (!this.isProcessing) {
          responseLog.append('\nModel Stream Cancelled.');
          responseLog.finish();
          this.modelService.reset();
          return;
        }
        this.extractAndEmitCode(fullAiResponse);
        responseLog.append('\nModel Stream Complete.');
        responseLog.finish();
        this.modelService.reset();
      } catch (error) {
        responseLog.append(`\nModel Stream Error: ${error}`);
        responseLog.finish();
      }
      this.isProcessing = false;
    } else {
      this.socketService?.sendMessage(this.message, this.isAiMode);
      EventBus.emit('chat-message', `You: ${this.message}`);
    }

    this.closeModal();
  }

  closeModal() {
    this.isVisible = false;
    this.isProcessing = false;
    this.message = '';
    this.isAiMode = false;
    this.npcOrigin = null;
    EventBus.emit('lock-input', false);
  }

  private extractAndEmitCode(response: string) {
    const codeBlockRegex = /```(?:javascript|js)?\s*([\s\S]*?)```/i;
    const match = response.match(codeBlockRegex);
    if (match && match[1]) {
      EventBus.emit('model-code-generated', match[1].trim());
    }
  }
}

