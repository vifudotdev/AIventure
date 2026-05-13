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

import { AgenticNPC, AgentState } from './AgenticNPC';
import { GridManager } from './GridManager';
import { NPCMovementType, CONSTANTS } from './Constants';
import { Player } from './Player';

describe('AgenticNPC', () => {
    let gridManagerSpy: jasmine.SpyObj<GridManager>;
    let npc: AgenticNPC;

    beforeEach(() => {
        gridManagerSpy = jasmine.createSpyObj('GridManager', ['toGrid', 'toPixel', 'isBlocked', 'setBlocker', 'getInteraction']);
        gridManagerSpy.toGrid.and.callFake((val) => Math.floor(val / 32));
        gridManagerSpy.toPixel.and.callFake((val) => val * 32);
        gridManagerSpy.isBlocked.and.returnValue(false);
    });

    it('should be created with FOLLOW type', () => {
        npc = new AgenticNPC({ x: 32, y: 32 }, gridManagerSpy, NPCMovementType.FOLLOW);
        expect(npc).toBeTruthy();
        expect((npc as any).moveType).toBe(NPCMovementType.FOLLOW);
    });

    it('should increment tool use and fail when limit reached', () => {
        npc = new AgenticNPC({ x: 32, y: 32, name: 'Test' }, gridManagerSpy, NPCMovementType.FOLLOW);
        
        for (let i = 0; i < CONSTANTS.AGENT_MAX_TOOL_USE - 1; i++) {
            npc.incrementToolUse();
            expect(npc.getState()).not.toBe(AgentState.FAILED);
        }

        npc.incrementToolUse();
        expect(npc.getState()).toBe(AgentState.FAILED);
    });

    it('should call handleFollowMovement when moveType is FOLLOW', () => {
        npc = new AgenticNPC({ x: 32, y: 32 }, gridManagerSpy, NPCMovementType.FOLLOW);
        const player = { x: 64, y: 32 } as Player; // Player is to the right
        
        // Spy on the protected method handleFollowMovement
        // We cast to any to access protected method for testing
        spyOn<any>(npc, 'handleFollowMovement');
        
        // Trigger update
        // We need to advance timer
        npc.updateNPC(0, 2500, player);
        
        expect((npc as any).handleFollowMovement).toHaveBeenCalled();
    });

    it('should NOT call handleFollowMovement when moveType is RANDOM', () => {
        npc = new AgenticNPC({ x: 32, y: 32 }, gridManagerSpy, NPCMovementType.RANDOM);
        const player = { x: 64, y: 32 } as Player;
        
        spyOn<any>(npc, 'handleFollowMovement');
        spyOn<any>(npc, 'handleRandomMovement');

        npc.updateNPC(0, 2500, player);
        
        expect((npc as any).handleFollowMovement).not.toHaveBeenCalled();
        expect((npc as any).handleRandomMovement).toHaveBeenCalled();
    });
});
