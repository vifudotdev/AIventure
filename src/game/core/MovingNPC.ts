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

import { CONSTANTS, NPCMovementType } from './Constants';
import { GridManager } from './GridManager';
import { SimpleEventEmitter } from './utils/SimpleEventEmitter';
import { Player } from './Player';

export class MovingNPC extends SimpleEventEmitter {
    public x: number;
    public y: number;
    protected gridManager: GridManager;
    public isMoving: boolean = false;
    protected moveType: NPCMovementType;
    public portrait: any = null;
    public interaction: any = null;
    protected originalGx: number;
    protected originalGy: number;
    protected moveTimer: number = 0;
    protected moveInterval: number = CONSTANTS.NPC_MOVE_INTERVAL; // Move every 2 seconds
    protected patrolDirection: number = 1; // 1 for right, -1 for left
    public props: any;

    constructor(props: any, gridManager: GridManager, autoMoves: number, portrait: any = null) {
        super();
        this.props = props;
        this.x = props.x;
        this.y = props.y;
        this.gridManager = gridManager;
        this.moveType = autoMoves as NPCMovementType;
        this.portrait = portrait;
        this.originalGx = this.gridManager.toGrid(props.x);
        this.originalGy = this.gridManager.toGrid(props.y);
    }

    // Needed for cleanup
    destroy() {}

    updateNPC(time: number, delta: number, player?: Player) {
        if (this.isMoving) return;

        this.moveTimer += delta;

        if (this.moveTimer < this.moveInterval) return;

        this.moveTimer = 0;
        
        if (this.moveType === NPCMovementType.IDLE) {
            return;
        }

        this.decideMove(player);
    }

    protected decideMove(player?: Player) {
        const currentGx = this.gridManager.toGrid(this.x);
        const currentGy = this.gridManager.toGrid(this.y);

        switch (this.moveType) {
            case NPCMovementType.RANDOM:
                this.handleRandomMovement(currentGx, currentGy);
                break;
            case NPCMovementType.PATROL:
                this.handlePatrolMovement(currentGx, currentGy);
                break;
        }
    }

    protected handleRandomMovement(currentGx: number, currentGy: number) {
        const directions = [
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 }
        ];
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const targetGx = currentGx + dir.dx;
        const targetGy = currentGy + dir.dy;

        // Check distance from original
        const dist = Math.abs(targetGx - this.originalGx) + Math.abs(targetGy - this.originalGy);
        if (dist > 2) return; // Too far

        if (!this.gridManager.isBlocked(targetGx, targetGy, 'npc')) {
            this.moveTo(targetGx, targetGy);
        }
    }

    protected handlePatrolMovement(currentGx: number, currentGy: number) {
         let targetGx = currentGx + this.patrolDirection;
         const targetGy = currentGy; // Patrols only horizontally for now

        if (this.gridManager.isBlocked(targetGx, targetGy, 'npc')) {
            this.patrolDirection *= -1;
            // Optionally try moving in the new direction immediately?
            // For now, just wait for next tick.
        } else {
             this.moveTo(targetGx, targetGy);
        }
    }

    protected moveTo(gx: number, gy: number) {
        this.isMoving = true;
        
        const currentGx = this.gridManager.toGrid(this.x);
        const currentGy = this.gridManager.toGrid(this.y);

        // Reserve the target tile
        this.gridManager.setBlocker(gx, gy, true);

        const targetX = this.gridManager.toPixel(gx);
        const targetY = this.gridManager.toPixel(gy);

        this.emit('move', {
            x: targetX,
            y: targetY,
            duration: CONSTANTS.TWEEN.MOVE_DURATION,
            type: 'move',
            onComplete: () => {
                this.x = targetX;
                this.y = targetY;
                this.isMoving = false;
                // Release the old tile
                this.gridManager.setBlocker(currentGx, currentGy, false);
            }
        });
    }
}
