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

import { InteractionSystem } from './InteractionSystem';
import { TriggerSystem } from './trigger/TriggerSystem';
import { TriggerType } from './trigger/TriggerTypes';
import { EventBus } from './EventBus';
import { InteractionType } from './Constants';
import { AgentState } from './AgenticNPC';

describe('InteractionSystem', () => {
    let interactionSystem: InteractionSystem;
    let levelManagerSpy: any;
    let triggerSystemSpy: jasmine.SpyObj<TriggerSystem>;

    beforeEach(() => {
        levelManagerSpy = jasmine.createSpyObj('ILevelManager', ['changeLayout'], {
            player: jasmine.createSpyObj('Player', ['setLocked']),
            agents: [jasmine.createSpyObj('AgenticNPC', ['setLocked', 'getState', 'incrementToolUse'])],
            movables: [jasmine.createSpyObj('MovableObject', ['reset'])]
        });

        // Mock TriggerSystem within InteractionSystem
        // Since TriggerSystem is instantiated inside InteractionSystem constructor, 
        // we might need to spy on prototype or just inspect the calls on the real instance if we can't easily inject.
        // However, looking at the code, it creates `new TriggerSystem(levelManager)`.
        // To properly test interaction -> trigger flow without depending on real TriggerSystem logic,
        // we can spy on the `processEvent` method of the implicitly created triggerSystem.

        interactionSystem = new InteractionSystem(levelManagerSpy);
        
        // Access the private triggerSystem property to spy on it
        triggerSystemSpy = (interactionSystem as any).triggerSystem;
        spyOn(triggerSystemSpy, 'processEvent'); 
    });

    afterEach(() => {
        interactionSystem.unregisterEvents();
    });

    it('should initialize and register events', () => {
        expect(interactionSystem).toBeDefined();
        // Indirectly verify registration by emitting events and checking effects
    });

    describe('Event Handling', () => {
        it('should handle lock-input event', () => {
            EventBus.emit('lock-input', true);
            expect(levelManagerSpy.player.setLocked).toHaveBeenCalledWith(true);
            expect(levelManagerSpy.agents[0].setLocked).toHaveBeenCalledWith(true);

            EventBus.emit('lock-input', false);
            expect(levelManagerSpy.player.setLocked).toHaveBeenCalledWith(false);
            expect(levelManagerSpy.agents[0].setLocked).toHaveBeenCalledWith(false);
        });

        it('should handle model-function-call event', () => {
            const callData = { name: 'test_func', args: [] };
            const agentMock = levelManagerSpy.agents[0];
            agentMock.getState.and.returnValue(AgentState.EXECUTE);

            EventBus.emit('model-function-call', callData);
            
            expect(agentMock.incrementToolUse).toHaveBeenCalled();
            expect(triggerSystemSpy.processEvent).toHaveBeenCalledWith({
                type: TriggerType.MODEL_FUNCTION,
                payload: callData,
                subject: agentMock
            });
        });

        it('should handle movable-moved event', () => {
            const movableMock = { name: 'TestMovable' };
            EventBus.emit('movable-moved', { movable: movableMock, gx: 1, gy: 1 });

            expect(triggerSystemSpy.processEvent).toHaveBeenCalledWith({
                type: TriggerType.MOVABLE_LANDED,
                subject: movableMock
            });
        });

        it('should handle run-code-snippet event', () => {
            const data = { interaction: {}, code: 'print("hello")', result: 'hello' };
            EventBus.emit('run-code-snippet', data);

            expect(triggerSystemSpy.processEvent).toHaveBeenCalledWith({
                type: TriggerType.CODE_EXECUTED,
                payload: data
            });
        });

        it('should handle html-puzzle-solved event', () => {
            const data = { interaction: { id: 'puzzle1' } };
            EventBus.emit('html-puzzle-solved', data);

            expect(triggerSystemSpy.processEvent).toHaveBeenCalledWith({
                type: TriggerType.HTML_PUZZLE_SOLVED,
                payload: data.interaction
            });
        });
    });

    describe('Interaction Handling', () => {
        it('should handle PORTAL interaction', () => {
            const interaction = { type: InteractionType.PORTAL, linkURL: 'new-level' };
            EventBus.emit('interaction', interaction);

            expect(levelManagerSpy.changeLayout).toHaveBeenCalledWith('new-level');
        });

        it('should handle CHAT interaction', () => {
            const interaction = { type: InteractionType.CHAT };
            EventBus.emit('interaction', interaction);

            expect(levelManagerSpy.movables[0].reset).toHaveBeenCalled();
        });

        it('should handle SWITCH interaction', () => {
            const interaction = { type: InteractionType.SWITCH };
            EventBus.emit('interaction', interaction);

            expect(triggerSystemSpy.processEvent).toHaveBeenCalledWith({
                type: TriggerType.INTERACTION,
                payload: interaction
            });
        });
    });
});
