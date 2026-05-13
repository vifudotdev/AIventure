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

import { Direction, InteractionType } from './Constants';
import { GridManager } from './GridManager';
import { EventBus } from './EventBus';
import { SimpleEventEmitter } from './utils/SimpleEventEmitter';

export class MovableObject extends SimpleEventEmitter {
    public x: number;
    public y: number;
    public name: string;
    private gridManager: GridManager;
    public isMoving: boolean = false;
    private startGx: number;
    private startGy: number;
    private context: string = '';
    private targetNPC: string = '';

    constructor(props: any, gridManager: GridManager) {
        super();
        this.x = props.x;
        this.y = props.y;
        this.name = props.name || '';
        this.gridManager = gridManager;
        this.startGx = this.gridManager.toGrid(props.x);
        this.startGy = this.gridManager.toGrid(props.y);
    }

    public reset() {
        const currentGx = this.gridManager.toGrid(this.x);
        const currentGy = this.gridManager.toGrid(this.y);

        // If already at start, do nothing
        if (currentGx === this.startGx && currentGy === this.startGy) return;

        // Clear current position
        this.gridManager.setBlocker(currentGx, currentGy, false);
        this.gridManager.moveMovable(currentGx, currentGy, this.startGx, this.startGy); 

        // Force set to start
        this.gridManager.setBlocker(this.startGx, this.startGy, true);
        
        if (this.gridManager.getMovable(currentGx, currentGy) === this) {
             this.gridManager.setMovable(currentGx, currentGy, null);
        }
        this.gridManager.setMovable(this.startGx, this.startGy, this);

        // Reset Position
        this.x = this.gridManager.toPixel(this.startGx);
        this.y = this.gridManager.toPixel(this.startGy);
        this.isMoving = false;
        
        this.emit('reset', this.x, this.y);
    }

    setContext(context: string) {
        this.context = context;
    }

    setTargetNPC(name: string) {
        this.targetNPC = name;
    }

    getContext() {
        return this.context;
    }

    push(direction: Direction) {
        if (this.isMoving) return;

        const currentGx = this.gridManager.toGrid(this.x);
        const currentGy = this.gridManager.toGrid(this.y);
        
        let dx = 0;
        let dy = 0;

        switch (direction) {
            case Direction.Up: dy = -1; break;
            case Direction.Down: dy = 1; break;
            case Direction.Left: dx = -1; break;
            case Direction.Right: dx = 1; break;
            default: return;
        }

        const targetGx = currentGx + dx;
        const targetGy = currentGy + dy;

        if (!this.gridManager.isBlocked(targetGx, targetGy)) {
            this.slide(currentGx, currentGy, targetGx, targetGy);
        }
    }

    // Needed for LevelManager cleanup
    destroy() {
        // no-op or clear listeners
    }

    private slide(fromGx: number, fromGy: number, toGx: number, toGy: number) {
        this.isMoving = true;

        // Check for Slot interaction at target
        const targetInteraction = this.gridManager.getInteraction(toGx, toGy);
        if (targetInteraction && targetInteraction.type === InteractionType.SLOT) {
             EventBus.emit('interaction', {
                 type: InteractionType.SLOT,
                 item: this,
                 slotInteraction: targetInteraction,
                 gridX: toGx,
                 gridY: toGy
             });
        }

        // Update Grid Manager immediately
        this.gridManager.setBlocker(fromGx, fromGy, false);
        this.gridManager.setBlocker(toGx, toGy, true);
        this.gridManager.moveMovable(fromGx, fromGy, toGx, toGy);
        
        const distance = Math.abs(toGx - fromGx) + Math.abs(toGy - fromGy);
        const duration = distance * 100; // 100ms per tile
        const targetX = this.gridManager.toPixel(toGx);
        const targetY = this.gridManager.toPixel(toGy);

        this.emit('move', {
            x: targetX,
            y: targetY,
            duration: duration,
            type: 'slide',
            onComplete: () => {
                this.x = targetX;
                this.y = targetY;
                this.isMoving = false;
                this.checkInteraction(toGx, toGy)
            }
        });
    }

    private checkInteraction(gx: number, gy: number) {
        const interaction = this.gridManager.getInteraction(gx, gy);
        if (interaction && interaction.type === InteractionType.SLOT) {
            console.log('Movable moved:', interaction);
            EventBus.emit('movable-moved', { movable: this, gx: gx, gy: gy })
        }
    }
}
