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

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DevsiteAPI } from './devsite-api';

export interface LogMessageOptions {
  summary: string;            // Required. Short, descriptive title of the log
  type?: 'log' | 'warning' | 'error'; // Optional. Can be "log", "warning", or "error"
  detail?: string;                                 // Optional. Code snippet or detailed trace info
  file?: string;                  // Optional. Filename associated with the event
  lineNumber?: string;                          // Optional. Line number associated with the event
  inspect?: string;                 // Optional. ID of a code snippet block to open if clicked
  sequence?: string[];       // Optional. Array of architecture entity IDs to highlight
}

export class StreamableLogMessage {
  private index: number;
  private options: LogMessageOptions;
  private logService: LogService;
  private finished = false;
  private timestamp: string;

  constructor(options: LogMessageOptions, logService: LogService, index: number, timestamp: string) {
    this.options = { ...options };
    this.options.detail = this.options.detail || '';
    this.logService = logService;
    this.index = index;
    this.timestamp = timestamp;
  }

  append(text: string) {
    if (this.finished) return;
    this.options.detail += text;
    this.logService.updateLogMessageAt(this.index, this.getFormattedString());
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    DevsiteAPI.sendLogMessage(this.options);
  }

  getFormattedString(): string {
    const typePrefix = this.options.type ? `[${this.options.type.toUpperCase()}] ` : '';
    const fileInfo = this.options.file ? ` (${this.options.file}${this.options.lineNumber ? ':' + this.options.lineNumber : ''})` : '';
    const detailText = this.options.detail ? `\nDetail: ${this.options.detail}` : '';
    return `[${this.timestamp}] ${typePrefix}${this.options.summary}${fileInfo}${detailText}`;
  }
}

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private logsSubject = new BehaviorSubject<string[]>([]);
  logs$ = this.logsSubject.asObservable();

  addLog(message: string) {
    const currentLogs = this.logsSubject.value;
    this.logsSubject.next([...currentLogs, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }

  appendLog(message: string) {
    const currentLogs = this.logsSubject.value;

    if (currentLogs.length > 0) {
      currentLogs[currentLogs.length - 1] += message;
      this.logsSubject.next([...currentLogs]);
    } else {
      this.logsSubject.next([message]);
    }
  }

  createStreamableLog(options: LogMessageOptions): StreamableLogMessage {
    const currentLogs = this.logsSubject.value;
    const index = currentLogs.length;
    const timestamp = new Date().toLocaleTimeString();
    
    const typePrefix = options.type ? `[${options.type.toUpperCase()}] ` : '';
    const fileInfo = options.file ? ` (${options.file}${options.lineNumber ? ':' + options.lineNumber : ''})` : '';
    const initialText = `[${timestamp}] ${typePrefix}${options.summary}${fileInfo}`;
    
    this.logsSubject.next([...currentLogs, initialText]);
    
    return new StreamableLogMessage(options, this, index, timestamp);
  }

  updateLogMessageAt(index: number, formattedMessage: string) {
    const currentLogs = [...this.logsSubject.value];
    if (index >= 0 && index < currentLogs.length) {
      currentLogs[index] = formattedMessage;
      this.logsSubject.next(currentLogs);
    }
  }

  clearLogs() {
    this.logsSubject.next([]);
  }
}
