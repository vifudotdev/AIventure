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

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventBus } from '../../../game/core/EventBus';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.css'
})
export class ChatPanelComponent {
  @Input() messages: string[] = [];

  addMessage(message: string) {
    this.messages.push(message);
  }

  @Input() collectiblesTracker: Record<string, { count: number; max: number }> = {};

  ngOnInit()
  {
    EventBus.on('collectibles-tracker', (tracker: any) =>
    {
      this.collectiblesTracker = tracker;
      console.log('coll', this.collectiblesTracker)
    });
  }
}
