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

type Listener = (...args: any[]) => void;

interface ListenerRecord {
    fn: Listener;
    context?: any;
}

export class SimpleEventEmitter {
    private listeners: { [key: string]: ListenerRecord[] } = {};

    on(event: string, listener: Listener, context?: any) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push({ fn: listener, context: context });
    }

    off(event: string, listener?: Listener, context?: any) {
        if (!this.listeners[event]) return;
        
        if (!listener) {
            // Remove all listeners for this event if no specific listener provided
            delete this.listeners[event];
            return;
        }

        this.listeners[event] = this.listeners[event].filter(l => {
            if (l.fn !== listener) return true;
            if (context && l.context !== context) return true;
            return false;
        });
    }

    emit(event: string, ...args: any[]) {
        if (!this.listeners[event]) return;
        
        // Copy to avoid issues if listeners remove themselves during execution
        const listeners = [...this.listeners[event]];
        
        listeners.forEach(l => {
            if (l.context) {
                l.fn.apply(l.context, args);
            } else {
                l.fn(...args);
            }
        });
    }
}