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

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventBus } from '../../../game/core/EventBus';
import { CONSTANTS } from '../../../game/core/Constants';

interface ThoughtBubble {
  id: string;
  text: string;
  x: number;
  y: number;
  timer: any;
}

@Component({
  selector: 'app-thought-bubble',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './thought-bubble.component.html',
  styleUrl: './thought-bubble.component.css'
})
export class ThoughtBubbleComponent implements OnInit, OnDestroy {
  bubbles: ThoughtBubble[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    EventBus.on('thought-bubble-update', this.handleUpdate, this);
  }

  ngOnDestroy() {
    EventBus.off('thought-bubble-update', this.handleUpdate, this);
  }

  handleUpdate(data: { id: string, text: string, screenX: number, screenY: number, duration?: number }) {
    const existing = this.bubbles.find(b => b.id === data.id);

    if (existing) {
        existing.text = data.text;
        existing.x = data.screenX;
        existing.y = data.screenY;

        // Reset timer if text changed? Or just let it run out?
        // Let's reset for new thoughts
        clearTimeout(existing.timer);
        existing.timer = setTimeout(() => this.removeBubble(data.id), data.duration || CONSTANTS.THOUGHT_BUBBLE.DEFAULT_DURATION);
    } else {
        const bubble: ThoughtBubble = {
            id: data.id,
            text: data.text,
            x: data.screenX,
            y: data.screenY,
            timer: setTimeout(() => this.removeBubble(data.id), data.duration || CONSTANTS.THOUGHT_BUBBLE.DEFAULT_DURATION)
        };
        this.bubbles.push(bubble);
    }
    this.cdr.detectChanges();
  }

  removeBubble(id: string) {
    const index = this.bubbles.findIndex(b => b.id === id);
    if (index !== -1) {
        clearTimeout(this.bubbles[index].timer);
        this.bubbles.splice(index, 1);
        this.cdr.detectChanges();
    }
  }
}
