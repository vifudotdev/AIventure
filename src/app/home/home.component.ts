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

import { Component, viewChild, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhaserGame } from '../phaser-game.component';
import { EventBus } from '../../game/core/EventBus';
import { ChatPanelComponent } from '../components/chat-panel/chat-panel.component';
import { RightPanelComponent } from '../components/right-panel/right-panel.component';
import { ConfirmationModalComponent } from '../components/confirmation-modal/confirmation-modal.component';
import { NpcDialogComponent } from '../components/npc-dialog/npc-dialog.component';
import { ThoughtBubbleComponent } from '../components/thought-bubble/thought-bubble.component';
import { SocketService } from '../services/socket.interface';
import { SOCKET_SERVICE } from '../services/socket-token';
import { MODEL_BACKEND } from '../services/model-token';
import { ModelBackend } from '../services/model-backend.interface';
import { TransformersService } from '../services/transformers.service';
import { MediaPipeService } from '../services/mediapipe.service';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, PhaserGame, ChatPanelComponent, RightPanelComponent, ConfirmationModalComponent, NpcDialogComponent, ThoughtBubbleComponent],
    templateUrl: './home.component.html',
    styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit
{
    public messages: string[] = [];
    public isModalVisible: boolean = false;
    public currentLinkUrl: string = '';
    public currentLinkName: string = '';

    public isLoadingModel: boolean = false;
    public loadingProgress: number = 0;
    public loadingStatus: string = '';
    public downloads: any[] = [];
    public isGodMode: boolean = false;

    // New way to get the component instance
    phaserRef = viewChild(PhaserGame);

    constructor(
        @Inject(SOCKET_SERVICE) private socketService: SocketService | null,
        @Inject(MODEL_BACKEND) private modelBackend: ModelBackend
    )
    {
    }

    ngOnInit() {
        // Check if using TransformersService or MediaPipeService and if it needs loading
        if (this.modelBackend instanceof TransformersService || this.modelBackend instanceof MediaPipeService) {
            this.isLoadingModel = true;
            this.modelBackend.loadingProgress$.subscribe(p => this.loadingProgress = p);
            this.modelBackend.loadingStatus$.subscribe(s => this.loadingStatus = s);
            
            if (this.modelBackend instanceof TransformersService) {
                this.modelBackend.downloads$.subscribe(d => this.downloads = d);
            }

            this.modelBackend.isReady$.subscribe(ready => {
                if (ready) {
                    this.isLoadingModel = false;
                }
            });

            (this.modelBackend as any).init();
        }

        // Connect to socket
        this.socketService?.connect();

        EventBus.on('god-mode-changed', (isGodMode: boolean) => {
            this.isGodMode = isGodMode;
        });

        // Listen for interaction events from the game
        EventBus.on('interaction', (data: any) => {
            switch (data.type) {
                case 'link':
                    if (data.linkURL) {
                        this.currentLinkUrl = data.linkURL;
                        this.currentLinkName = data.linkName || data.linkURL;
                        this.isModalVisible = true;
                        EventBus.emit('lock-input', true);
                    }
                    break;
                case 'door':
                    // Handle door interaction
                    break;
                case 'treasure':
                    // Handle treasure interaction
                    break;
            }
        });

        // Listen for local chat messages (from user input)
        EventBus.on('chat-message', (msg: string) => {
            this.messages.push(msg);
        });

        // Listen for incoming socket messages
        this.socketService?.getMessages().subscribe((data: any) => {
            // Assuming data is { message: string, ... } or just a string
            const msg = typeof data === 'string' ? data : data.message;
            this.messages.push(msg);
        });
    }

    onConfirmLink() {
        if (this.currentLinkUrl) {
            window.open(this.currentLinkUrl, '_blank');
        }
        this.closeModal();
    }

    onCancelLink() {
        this.closeModal();
    }

    private closeModal() {
        this.isModalVisible = false;
        this.currentLinkUrl = '';
        this.currentLinkName = '';
        // Delay unlocking to prevent the current keypress from triggering other listeners (like chat)
        setTimeout(() => {
            EventBus.emit('lock-input', false);
        }, 100);
    }
}
