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

import { MovableObject } from './MovableObject';
import { GridManager } from './GridManager';
import { Direction, InteractionType, CONSTANTS } from './Constants';

describe('MovableObject', () => {
    let movable: MovableObject;
    let gridManagerSpy: jasmine.SpyObj<GridManager>;

    beforeEach(() => {
        gridManagerSpy = jasmine.createSpyObj('GridManager', [
            'toGrid',
            'toPixel',
            'isBlocked',
            'setBlocker',
            'moveMovable',
            'getInteraction',
            'getMovable',
            'setMovable'
        ]);

        // Basic mock behaviors
        gridManagerSpy.toGrid.and.callFake((val: number) => Math.floor((val - CONSTANTS.HALF_GRID) / CONSTANTS.GRID_SIZE));
        gridManagerSpy.toPixel.and.callFake((val: number) => val * CONSTANTS.GRID_SIZE + CONSTANTS.HALF_GRID);
        gridManagerSpy.isBlocked.and.returnValue(false);
    });

    it('should initialize correctly', () => {
        const props = { x: 48, y: 48, name: 'Box' }; // Grid 1,1
        movable = new MovableObject(props, gridManagerSpy);

        expect(movable.x).toBe(48);
        expect(movable.y).toBe(48);
        expect(movable.name).toBe('Box');
        expect(gridManagerSpy.toGrid).toHaveBeenCalledWith(48);
    });

    it('should set and get context', () => {
        movable = new MovableObject({ x: 48, y: 48 }, gridManagerSpy);
        movable.setContext('Contains a key');
        expect(movable.getContext()).toBe('Contains a key');
    });

    describe('push', () => {
        beforeEach(() => {
            movable = new MovableObject({ x: 48, y: 48 }, gridManagerSpy); // Grid 1,1
        });

        it('should move if direction is valid and not blocked', () => {
            const emitSpy = spyOn(movable, 'emit');
            
            // Push Right (1,1 -> 2,1)
            movable.push(Direction.Right);

            expect(gridManagerSpy.isBlocked).toHaveBeenCalledWith(2, 1);
            expect(gridManagerSpy.setBlocker).toHaveBeenCalledWith(1, 1, false);
            expect(gridManagerSpy.setBlocker).toHaveBeenCalledWith(2, 1, true);
            expect(gridManagerSpy.moveMovable).toHaveBeenCalledWith(1, 1, 2, 1);
            expect(movable.isMoving).toBeTrue();

            expect(emitSpy).toHaveBeenCalled();
            const args = emitSpy.calls.mostRecent().args;
            expect(args[0]).toBe('move');
            expect(args[1].x).toBe(gridManagerSpy.toPixel(2));
        });

        it('should not move if blocked', () => {
            gridManagerSpy.isBlocked.and.returnValue(true);
            const emitSpy = spyOn(movable, 'emit');

            movable.push(Direction.Right);

            expect(gridManagerSpy.moveMovable).not.toHaveBeenCalled();
            expect(movable.isMoving).toBeFalse();
            expect(emitSpy).not.toHaveBeenCalled();
        });

        it('should not move if already moving', () => {
            movable.isMoving = true;
            const emitSpy = spyOn(movable, 'emit');

            movable.push(Direction.Right);

            expect(gridManagerSpy.moveMovable).not.toHaveBeenCalled();
            expect(emitSpy).not.toHaveBeenCalled();
        });
    });

    describe('reset', () => {
        it('should return to start position', () => {
            // Start at 1,1
            movable = new MovableObject({ x: 48, y: 48 }, gridManagerSpy);
            
            // Move it to 3,3 manually
            movable.x = gridManagerSpy.toPixel(3);
            movable.y = gridManagerSpy.toPixel(3);

            const emitSpy = spyOn(movable, 'emit');

            movable.reset();

            expect(gridManagerSpy.setBlocker).toHaveBeenCalledWith(3, 3, false);
            expect(gridManagerSpy.moveMovable).toHaveBeenCalledWith(3, 3, 1, 1);
            expect(gridManagerSpy.setBlocker).toHaveBeenCalledWith(1, 1, true);
            
            expect(movable.x).toBe(48);
            expect(movable.y).toBe(48);
            expect(emitSpy).toHaveBeenCalledWith('reset', 48, 48);
        });
    });

    describe('Interactions', () => {
         beforeEach(() => {
            movable = new MovableObject({ x: 48, y: 48 }, gridManagerSpy); // Grid 1,1
        });

        it('should emit slot interaction when sliding onto a slot', () => {
            const slotInteraction = { type: InteractionType.SLOT, name: 'Slot1' };
            gridManagerSpy.getInteraction.and.returnValue(slotInteraction);

            const eventBusSpy = spyOn(require('./EventBus').EventBus, 'emit');

            // Push Right (1,1 -> 2,1)
            movable.push(Direction.Right);

            expect(eventBusSpy).toHaveBeenCalledWith('interaction', jasmine.objectContaining({
                type: InteractionType.SLOT,
                item: movable,
                slotInteraction: slotInteraction
            }));
        });
    });
});
