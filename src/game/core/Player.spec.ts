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

import { Player } from './Player';
import { GridManager } from './GridManager';
import { CONSTANTS, Direction } from './Constants';
import { EventBus } from './EventBus';
import { MovableObject } from './MovableObject';
import { AgenticNPC, AgentState } from './AgenticNPC';

describe('Player', () => {
    let player: Player;
    let gridManagerSpy: jasmine.SpyObj<GridManager>;

    beforeEach(() => {
        // Create a spy object for GridManager with all necessary methods
        gridManagerSpy = jasmine.createSpyObj('GridManager', [
            'toGrid',
            'toPixel',
            'isBlocked',
            'getMovable',
            'getInteraction',
            'setBlocker',
            'moveMovable',
            'setMovable',
            'getModelToolMap',
            'setModelToolMap',
            'setInteraction'
        ]);

        // Default behavior for coordinate conversion
        gridManagerSpy.toGrid.and.callFake((pixel: number) => Math.floor((pixel - CONSTANTS.HALF_GRID) / CONSTANTS.GRID_SIZE));
        gridManagerSpy.toPixel.and.callFake((grid: number) => grid * CONSTANTS.GRID_SIZE + CONSTANTS.HALF_GRID);

        // Default behavior for other methods
        gridManagerSpy.isBlocked.and.returnValue(false);
        gridManagerSpy.getMovable.and.returnValue(null);
        gridManagerSpy.getInteraction.and.returnValue(null);

        // Initialize Player at (1, 1) in grid coordinates -> (48, 48) in pixel coordinates
        // 1 * 32 + 16 = 48
        player = new Player(48, 48, gridManagerSpy, [], []);
    });

    it('should initialize correctly', () => {
        expect(player.x).toBe(48);
        expect(player.y).toBe(48);
        expect(player.isMoving).toBeFalse();
        expect(player.isLocked).toBeFalse();
    });

    describe('attemptMove', () => {
        it('should move successfully when path is clear', () => {
            const moveSpy = spyOn(player, 'emit').and.callThrough();

            // Move Right from (1, 1) to (2, 1)
            player.attemptMove(Direction.Right);

            expect(gridManagerSpy.toGrid).toHaveBeenCalledWith(48);
            expect(gridManagerSpy.isBlocked).toHaveBeenCalledWith(2, 1, 'player');
            expect(player.isMoving).toBeTrue();
            expect(moveSpy).toHaveBeenCalledWith('move', jasmine.objectContaining({
                x: 80, // 2 * 32 + 16
                y: 48, // 1 * 32 + 16
                type: 'move'
            }));
        });

        it('should bump when blocked by a wall', () => {
            gridManagerSpy.isBlocked.and.returnValue(true);
            const moveSpy = spyOn(player, 'emit').and.callThrough();

            // Try to move Right
            player.attemptMove(Direction.Right);

            expect(gridManagerSpy.isBlocked).toHaveBeenCalledWith(2, 1, 'player');
            expect(player.isMoving).toBeTrue(); // Bump sets moving to true
            expect(moveSpy).toHaveBeenCalledWith('move', jasmine.objectContaining({
                type: 'bump'
            }));
        });

        it('should push a MovableObject when blocked by one', () => {
            gridManagerSpy.isBlocked.and.returnValue(true);

            // Create a mock MovableObject
            const movable = new MovableObject({ x: 80, y: 48 }, gridManagerSpy);
            const pushSpy = spyOn(movable, 'push');

            gridManagerSpy.getMovable.and.returnValue(movable);

            // Try to move Right
            player.attemptMove(Direction.Right);

            expect(gridManagerSpy.getMovable).toHaveBeenCalledWith(2, 1);
            expect(pushSpy).toHaveBeenCalledWith(Direction.Right);
            // Player should also bump
            expect(player.isMoving).toBeTrue();
        });

        it('should trigger interaction when blocked and interaction exists', () => {
            gridManagerSpy.isBlocked.and.returnValue(true);
            const interaction = { type: 'test' };
            gridManagerSpy.getInteraction.and.returnValue(interaction);

            const eventBusSpy = spyOn(EventBus, 'emit');

            // Try to move Right
            player.attemptMove(Direction.Right);

            expect(gridManagerSpy.getInteraction).toHaveBeenCalledWith(2, 1);
            expect(eventBusSpy).toHaveBeenCalledWith('interaction', interaction);
        });

        it('should set AgenticNPC state to BUMPED when bumping into it', () => {
            gridManagerSpy.isBlocked.and.returnValue(true);
            
            // Create a mock AgenticNPC
            const agentMock = Object.create(AgenticNPC.prototype);
            agentMock.x = 80; // (2, 1)
            agentMock.y = 48;
            agentMock.interaction = { type: 'test_agent' };
            agentMock.setState = jasmine.createSpy('setState');
            
            // Re-initialize player with the agent
            player = new Player(48, 48, gridManagerSpy, [], [agentMock]);

            // Try to move Right (towards the agent)
            player.attemptMove(Direction.Right);

            expect(agentMock.setState).toHaveBeenCalledWith(AgentState.BUMPED);
        });

        it('should not move if locked', () => {
            player.setLocked(true);
            const moveSpy = spyOn(player, 'emit');

            player.attemptMove(Direction.Right);

            expect(moveSpy).not.toHaveBeenCalled();
            expect(gridManagerSpy.toGrid).not.toHaveBeenCalled();
        });

        it('should not move if already moving', () => {
            player.isMoving = true;
            const moveSpy = spyOn(player, 'emit');

            player.attemptMove(Direction.Right);

            expect(moveSpy).not.toHaveBeenCalled();
        });

        it('should not move if direction is None', () => {
            const moveSpy = spyOn(player, 'emit');

            player.attemptMove(Direction.None);

            expect(moveSpy).not.toHaveBeenCalled();
        });
    });
});

