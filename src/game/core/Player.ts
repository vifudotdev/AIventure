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

import { CONSTANTS, Direction } from './Constants';
import { GridManager } from './GridManager';
import { EventBus } from './EventBus';
import { MovableObject } from './MovableObject';
import { SimpleEventEmitter } from './utils/SimpleEventEmitter';
import { MovingNPC } from './MovingNPC';
import { AgenticNPC, AgentState } from './AgenticNPC';

export class Player extends SimpleEventEmitter {
    public x: number;
    public y: number;
    private gridManager: GridManager;
    private npcs: MovingNPC[];
    private agents: AgenticNPC[];
    private flipY: boolean = false;
    public isMoving: boolean = false;
    public isLocked: boolean = false;
    public godMode: boolean = false;

    constructor(x: number, y: number, gridManager: GridManager, npcs: MovingNPC[], agents: AgenticNPC[], flipY: boolean = true) {
        super();
        this.x = x;
        this.y = y;
        this.gridManager = gridManager;
        this.npcs = npcs;
        this.agents = agents;
        this.flipY = flipY;
    }

    attemptMove(direction: Direction) {
        if (this.isLocked || this.isMoving || direction === Direction.None) return;

        const gx = this.gridManager.toGrid(this.x);
        const gy = this.gridManager.toGrid(this.y);

        let dx = 0;
        let dy = 0;
        if (direction === Direction.Left) dx = -1;
        else if (direction === Direction.Right) dx = 1;
        else if (direction === Direction.Up) dy = 1;
        else if (direction === Direction.Down) dy = -1;
        if (this.flipY) dy *= -1;

        const targetGx = gx + dx;
        const targetGy = gy + dy;

        if (this.godMode || !this.gridManager.isBlocked(targetGx, targetGy, 'player')) {
            this.moveTo(targetGx, targetGy);
        } else {
            const movable = this.gridManager.getMovable(targetGx, targetGy);
            if (movable instanceof MovableObject) {
                movable.push(direction);
            }
            this.bump(gx, gy, direction);
            this.checkInteraction(targetGx, targetGy);
        }
    }

    attemptRoomJump(direction: Direction, roomWidthPixels: number, roomHeightPixels: number) {
        if (this.isLocked || this.isMoving || direction === Direction.None || !this.godMode) return;

        let dxPixels = 0;
        let dyPixels = 0;
        if (direction === Direction.Left) dxPixels = -roomWidthPixels;
        else if (direction === Direction.Right) dxPixels = roomWidthPixels;
        else if (direction === Direction.Up) dyPixels = roomHeightPixels;
        else if (direction === Direction.Down) dyPixels = -roomHeightPixels;
        if (this.flipY) dyPixels *= -1;

        const targetGx = this.gridManager.toGrid(this.x + dxPixels);
        const targetGy = this.gridManager.toGrid(this.y + dyPixels);

        this.moveTo(targetGx, targetGy);
    }

    setLocked(locked: boolean) {
        this.isLocked = locked;
    }

    setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.emit('position-changed', x, y);
    }
    
    // Cleanup method if needed (previously destroy)
    destroy() {
        // Clear listeners if any
    }

    private moveTo(gx: number, gy: number) {
        this.isMoving = true;
        const targetX = this.gridManager.toPixel(gx);
        const targetY = this.gridManager.toPixel(gy);
        
        // Emit move event for renderer
        this.emit('move', {
            x: targetX,
            y: targetY,
            duration: CONSTANTS.TWEEN.MOVE_DURATION,
            type: 'move',
            onComplete: () => {
                this.x = targetX;
                this.y = targetY;
                this.isMoving = false;
                this.emit('move-complete'); 
                this.checkInteraction(gx, gy);
            }
        });
    }

    private bump(gx: number, gy: number, direction: Direction) {
        this.isMoving = true;
        let targetX = this.gridManager.toPixel(gx);
        let targetY = this.gridManager.toPixel(gy);
        let offset = -8;
        if (this.flipY) offset *= -1;

        switch (direction) {
            case Direction.Up: targetY -= offset; break;
            case Direction.Down: targetY += offset; break;
            case Direction.Left: targetX -= offset; break;
            case Direction.Right: targetX += offset; break;
        }

        this.emit('move', {
            x: targetX,
            y: targetY,
            duration: CONSTANTS.TWEEN.BUMP_DURATION,
            type: 'bump', // Renderer handles yoyo
            onComplete: () => {
                this.isMoving = false;
                this.emit('move-complete'); 
            }
        });
    }

    private checkInteraction(gx: number, gy: number) {
        let interaction = this.gridManager.getInteraction(gx, gy);
        
        if (!interaction) {
            const allNPCs = [...this.npcs, ...this.agents];
            const npc = allNPCs.find(n => this.gridManager.toGrid(n.x) === gx && this.gridManager.toGrid(n.y) === gy);
            if (npc && npc.interaction) {
                interaction = npc.interaction;

                if (npc instanceof AgenticNPC) {
                    npc.setState(AgentState.BUMPED);
                    interaction.origin = npc;
                }
            }
        }

        if (interaction) {
            console.log('Interaction triggered:', interaction);
            EventBus.emit('interaction', interaction);
        }
    }
}
