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
import { GridManager } from './GridManager';
import { NPCMovementType, CONSTANTS } from './Constants';

describe('MovingNPC', () => {
    let npc: MovingNPC;
    let gridManagerSpy: jasmine.SpyObj<GridManager>;

    beforeEach(() => {
        gridManagerSpy = jasmine.createSpyObj('GridManager', [
            'toGrid',
            'toPixel',
            'isBlocked',
            'setBlocker',
            'getInteraction'
        ]);

        // Basic mock behaviors
        gridManagerSpy.toGrid.and.callFake((val: number) => Math.floor((val - CONSTANTS.HALF_GRID) / CONSTANTS.GRID_SIZE));
        gridManagerSpy.toPixel.and.callFake((val: number) => val * CONSTANTS.GRID_SIZE + CONSTANTS.HALF_GRID);
        gridManagerSpy.isBlocked.and.returnValue(false);
    });

    it('should initialize correctly', () => {
        const props = { x: 48, y: 48 }; // Grid 1,1
        npc = new MovingNPC(props, gridManagerSpy, NPCMovementType.IDLE);

        expect(npc.x).toBe(48);
        expect(npc.y).toBe(48);
        expect(gridManagerSpy.toGrid).toHaveBeenCalledWith(48);
    });

    describe('updateNPC', () => {
        beforeEach(() => {
            npc = new MovingNPC({ x: 48, y: 48 }, gridManagerSpy, NPCMovementType.RANDOM);
        });

        it('should not move if IDLE', () => {
            npc = new MovingNPC({ x: 48, y: 48 }, gridManagerSpy, NPCMovementType.IDLE);
            spyOn<any>(npc, 'decideMove');

            npc.updateNPC(0, 3000);

            expect((npc as any).decideMove).not.toHaveBeenCalled();
        });

        it('should not move if already moving', () => {
            npc.isMoving = true;
            spyOn<any>(npc, 'decideMove');

            npc.updateNPC(0, 3000);

            expect((npc as any).decideMove).not.toHaveBeenCalled();
        });

        it('should not move if interval not reached', () => {
            spyOn<any>(npc, 'decideMove');

            npc.updateNPC(0, 1000); // Less than 2000

            expect((npc as any).decideMove).not.toHaveBeenCalled();
        });

        it('should decide move if conditions met', () => {
            spyOn<any>(npc, 'decideMove');

            npc.updateNPC(0, 2500);

            expect((npc as any).decideMove).toHaveBeenCalled();
        });
    });

    describe('decideMove', () => {
        let moveToSpy: jasmine.Spy;

        describe('RANDOM movement', () => {
            beforeEach(() => {
                npc = new MovingNPC({ x: 48, y: 48 }, gridManagerSpy, NPCMovementType.RANDOM);
                moveToSpy = spyOn<any>(npc, 'moveTo');
            });

            it('should move to valid random neighbor', () => {
                // Mock Math.random to pick specific direction (e.g., first one: { dx: 0, dy: 1 })
                spyOn(Math, 'random').and.returnValue(0);

                // 1,1 -> 1,2 (down)
                // Distance from original (1,1) is 1, so valid.

                (npc as any).decideMove();

                expect(moveToSpy).toHaveBeenCalledWith(1, 2);
            });

            it('should not move if too far from original position', () => {
                // Original at 1,1
                // Move NPC manually to 1,3 (distance 2)
                npc.x = gridManagerSpy.toPixel(1);
                npc.y = gridManagerSpy.toPixel(3);

                // Try moving to 1,4 (distance 3) - should be blocked by distance check
                // Mock direction { dx: 0, dy: 1 } (index 0) which is (0, 1) relative
                spyOn(Math, 'random').and.returnValue(0);

                (npc as any).decideMove();

                expect(moveToSpy).not.toHaveBeenCalled();
            });

            it('should not move if target is blocked', () => {
                gridManagerSpy.isBlocked.and.returnValue(true);

                (npc as any).decideMove();

                expect(moveToSpy).not.toHaveBeenCalled();
            });
        });

        describe('PATROL movement', () => {
            beforeEach(() => {
                npc = new MovingNPC({ x: 48, y: 48 }, gridManagerSpy, NPCMovementType.PATROL);
                moveToSpy = spyOn<any>(npc, 'moveTo');
            });

            it('should move in patrol direction', () => {
                // Default direction is 1 (right)
                // 1,1 -> 2,1

                (npc as any).decideMove();

                expect(moveToSpy).toHaveBeenCalledWith(2, 1);
            });

            it('should reverse direction if blocked', () => {
                gridManagerSpy.isBlocked.and.returnValue(true);

                // Initial direction 1. Target 2,1 is blocked.
                (npc as any).decideMove();

                expect(moveToSpy).not.toHaveBeenCalled();

                // Now unblock and check if direction reversed (should be -1)
                gridManagerSpy.isBlocked.and.returnValue(false);
                (npc as any).decideMove();

                // Should move to 0,1 (left)
                expect(moveToSpy).toHaveBeenCalledWith(0, 1);
            });
        });
    });

    describe('moveTo', () => {
        beforeEach(() => {
            npc = new MovingNPC({ x: 48, y: 48 }, gridManagerSpy, NPCMovementType.IDLE);
        });

        it('should execute move logic correctly', () => {
            const emitSpy = spyOn(npc, 'emit');

            // Move from 1,1 to 2,1
            (npc as any).moveTo(2, 1);

            expect(npc.isMoving).toBeTrue();
            expect(gridManagerSpy.setBlocker).toHaveBeenCalledWith(2, 1, true);

            expect(emitSpy).toHaveBeenCalled();
            const emitArgs = emitSpy.calls.mostRecent().args;
            expect(emitArgs[0]).toBe('move');
            const data = emitArgs[1];
            expect(data.x).toBe(gridManagerSpy.toPixel(2));
            expect(data.y).toBe(gridManagerSpy.toPixel(1));

            // Simulate onComplete
            data.onComplete();

            expect(npc.x).toBe(gridManagerSpy.toPixel(2));
            expect(npc.y).toBe(gridManagerSpy.toPixel(1));
            expect(npc.isMoving).toBeFalse();
            expect(gridManagerSpy.setBlocker).toHaveBeenCalledWith(1, 1, false);
        });
    });
});
