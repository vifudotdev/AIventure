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

import { MovingNPC } from './MovingNPC';
import { CONSTANTS, NPCMovementType } from './Constants';
import { Player } from './Player';
import { GridManager } from './GridManager';
import { EventBus } from './EventBus';

export enum AgentState {
    FOLLOW,
    BUMPED,
    THINKING,
    EXECUTE,
    VERIFY,
    GOAL,
    FAILED,
};

export class AgenticNPC extends MovingNPC {
    protected isLocked: boolean = false;
    protected currentState: AgentState = AgentState.FOLLOW;
    protected commandTarget: { gx: number, gy: number, action: string } | null = null;
    protected thoughtQueue: {text: string, duration: number}[] = [];
    protected currentThoughtTimer: number = 0;
    protected toolUseCount: number = 0;

    constructor(props: any, gridManager: GridManager, autoMoves: number, portrait: any = null) {
        super(props, gridManager, autoMoves, portrait);
    }

    setLocked(locked: boolean) {
        this.isLocked = locked;
    }

    incrementToolUse() {
        this.toolUseCount++;
        if (this.toolUseCount >= CONSTANTS.AGENT_MAX_TOOL_USE) {
            this.setState(AgentState.FAILED);
            this.commandTarget = null;
            this.setThought("I've reached my limit...", CONSTANTS.THOUGHT_BUBBLE.LONG_DURATION);
        }
    }

    setCommand(gx: number, gy: number, action: string) {
        this.commandTarget = { gx, gy, action };
        this.isMoving = false; // Reset moving state to allow immediate decision
        this.moveTimer = this.moveInterval; // Force immediate update
    }

    setThought(text: string, duration: number = CONSTANTS.THOUGHT_BUBBLE.DEFAULT_DURATION) {
        this.thoughtQueue.push({ text, duration });
    }

    setState(state: AgentState) {
        if (state == AgentState.THINKING) {
            // reset tool use count
            this.toolUseCount = 0;
        }
        this.currentState = state;
    }

    getState(): AgentState {
        return this.currentState;
    }

    reset() {
        this.currentState = AgentState.FOLLOW;
        this.commandTarget = null;
        this.thoughtQueue = [];
        this.currentThoughtTimer = 0;
        this.toolUseCount = 0;
    }

    override updateNPC(time: number, delta: number, player?: Player) {
        if (this.currentThoughtTimer > 0) {
            this.currentThoughtTimer -= delta;
        }

        if (this.currentThoughtTimer <= 0 && this.thoughtQueue.length > 0) {
            const thought = this.thoughtQueue.shift();
            if (thought) {
                this.emit('thought', { text: thought.text, x: this.x, y: this.y, name: this.props.name, duration: thought.duration });
                this.currentThoughtTimer = thought.duration;
            }
        }

        if (this.isLocked) return;
        if (this.isMoving) return;

        this.moveTimer += delta;
        
        // Command override
        if (this.commandTarget) {
             // Continue
        } else if (this.moveType === NPCMovementType.IDLE) {
            return;
        }

        if (this.moveTimer < this.moveInterval) return;

        this.moveTimer = 0;
        
        if (this.commandTarget) {
            this.handleCommand();
        } else {
            this.decideMove(player);
        }
    }

    protected override decideMove(player?: Player) {
        if (this.currentState != AgentState.FOLLOW) {
            switch(this.currentState) {
            case AgentState.BUMPED:
                this.setThought("Waiting..", CONSTANTS.THOUGHT_BUBBLE.SHORT_DURATION*2);
                break;
            case AgentState.FAILED:
                if (this.thoughtQueue.length === 0) {
                    this.setThought("Sob Sob", CONSTANTS.THOUGHT_BUBBLE.SHORT_DURATION*2);
                }
                break;
            }
            return;
        }

        const currentGx = this.gridManager.toGrid(this.x);
        const currentGy = this.gridManager.toGrid(this.y);

        if (this.moveType === NPCMovementType.FOLLOW && player) {
            this.handleFollowMovement(this.gridManager.toGrid(this.x), this.gridManager.toGrid(this.y), player);
        } else {
            super.decideMove();
        }
    }

    protected handleCommand() {
        if (!this.commandTarget) return;

        const currentGx = this.gridManager.toGrid(this.x);
        const currentGy = this.gridManager.toGrid(this.y);
        const { gx, gy, action } = this.commandTarget;

        const dx = gx - currentGx;
        const dy = gy - currentGy;
        const dist = Math.abs(dx) + Math.abs(dy);

        if (dist <= 1) {
            if (action === 'interact') {
                 // Trigger interaction
                 const interaction = this.gridManager.getInteraction(gx, gy);
                 if (interaction) {
                     EventBus.emit('interaction', interaction);
                 }
            }
            this.commandTarget = null; // Clear command
            return;
        }

        const stepX = Math.sign(dx);
        
        // Simple pathfinding: X then Y
        let nextGx = currentGx + stepX;
        let nextGy = currentGy;
        if (stepX === 0) {
            nextGy = currentGy + Math.sign(dy);
        }
        if (!this.gridManager.isBlocked(nextGx, nextGy, 'npc')) {
            this.moveTo(nextGx, nextGy);
        } else {
            // Try Y if X blocked (or vice versa) - simple retry
            if (stepX !== 0) {
                nextGx = currentGx;
                nextGy = currentGy + Math.sign(dy);
                if (!this.gridManager.isBlocked(nextGx, nextGy, 'npc')) {
                    this.moveTo(nextGx, nextGy);
                }
            }
        }
    }

    protected handleFollowMovement(currentGx: number, currentGy: number, player: Player) {
        const playerGx = this.gridManager.toGrid(player.x);
        const playerGy = this.gridManager.toGrid(player.y);

        // Simple Manhattan logic or direction
        const dx = playerGx - currentGx;
        const dy = playerGy - currentGy;

        if (dx === 0 && dy === 0) return; // Already on top of player?

        let targetGx = currentGx;
        let targetGy = currentGy;

        // Move along the axis with greater distance, or prioritize one
        if (Math.abs(dx) > Math.abs(dy)) {
            targetGx += Math.sign(dx);
        } else {
            targetGy += Math.sign(dy);
        }

        if (targetGx === playerGx && targetGy === playerGy) {
            // Bumped into player
            this.currentState = AgentState.BUMPED;

            if (this.interaction) {
                let interaction = this.interaction;
                interaction.origin = this;
                EventBus.emit('interaction', interaction);
            }
            this.setThought("Bumped!");
        } else if (this.gridManager.isBlocked(targetGx, targetGy, 'npc')) {
            // Try alternative axis if primary is blocked
            if (targetGx !== currentGx) {
                 // Was trying horizontal, try vertical
                 targetGx = currentGx;
                 targetGy += Math.sign(dy) || 1; // Default to down if dy is 0
            } else {
                 targetGy = currentGy;
                 targetGx += Math.sign(dx) || 1;
            }

            if (!this.gridManager.isBlocked(targetGx, targetGy, 'npc')) {
                this.moveTo(targetGx, targetGy);
            }
        } else {
            this.moveTo(targetGx, targetGy);
        }
    }

    protected override moveTo(gx: number, gy: number) {
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
                this.setThought("Move..", CONSTANTS.THOUGHT_BUBBLE.SHORT_DURATION);
            }
        });
    }
}
