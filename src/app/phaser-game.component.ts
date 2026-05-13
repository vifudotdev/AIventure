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

import { Component, OnInit } from "@angular/core";
import Phaser from "phaser";
import StartGame from "../game/phaser/main";
import { EventBus } from "../game/core/EventBus";
import { ChatInputComponent } from "./components/chat-input/chat-input.component";
import { NpcDialogComponent } from "./components/npc-dialog/npc-dialog.component";
import { CommonModule } from "@angular/common";

@Component({
    selector: 'phaser-game',
    template: `
    <app-npc-dialog></app-npc-dialog>
    <app-chat-input></app-chat-input>
    <div id="game-container" (mousedown)="onGameFocus()"></div>
    `,
    styles: [`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            position: relative;
        }
        #game-container {
            width: calc(100% - 20px);
            height: calc(100% - 20px);
            margin: 10px;
            border-radius: 10px;
            overflow: hidden;
            background-color: #000;
        }
    `],
    standalone: true,
    imports: [ChatInputComponent, NpcDialogComponent, CommonModule]
})
export class PhaserGame implements OnInit
{
    scene: Phaser.Scene | any;
    game: Phaser.Game;
    sceneCallback: (scene: Phaser.Scene | any) => void;

    ngOnInit()
    {
        this.initGame();

        EventBus.on('current-scene-ready', (scene: any) =>
        {
            this.scene = scene;

            if (this.sceneCallback)
            {
                this.sceneCallback(scene);
            }
        });

        EventBus.on('restart-game', () => {
            this.initGame();
        });
    }

    initGame()
    {
        if (this.game)
        {
            this.game.destroy(true);
        }

        this.game = StartGame('game-container');
    }

    onGameFocus()
    {
        EventBus.emit('game-focused');
    }

    ngOnDestroy()
    {
        EventBus.off('restart-game');
        if (this.game)
        {
            this.game.destroy(true);
        }
    }
}
