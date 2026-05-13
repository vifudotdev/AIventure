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
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { SocketService } from './socket.interface';

@Injectable()
export class SocketIoService implements SocketService {
  private socket: Socket;
  private url = 'http://localhost:3000'; // Default URL, can be configured

  constructor() {
    this.socket = io(this.url, {
      autoConnect: false
    });
  }

  connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }

  sendMessage(message: string, isAi: boolean = false) {
    this.socket.emit('chat-message', { message, isAi });
  }

  getMessages(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('chat-message', (data) => {
        observer.next(data);
      });
      
      // Also listen for other relevant events if needed
      return () => {
        this.socket.off('chat-message');
      };
    });
  }
}
