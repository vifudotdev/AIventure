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

import { TriggerSystem } from './TriggerSystem';
import { TriggerType, TriggerContext } from './TriggerTypes';
import { EventBus } from '../EventBus';

describe('TriggerSystem - FIND_SWITCH', () => {
    let triggerSystem: TriggerSystem;
    let levelManagerMock: any;
    let eventBusEmitSpy: jasmine.Spy;

    beforeEach(() => {
        levelManagerMock = jasmine.createSpyObj('ILevelManager', ['getObjectsByTag'], {
            gridManager: jasmine.createSpyObj('GridManager', ['setBlocker', 'setModelToolMap', 'getInteraction']),
            agents: [jasmine.createSpyObj('AgenticNPC', ['setCommand', 'setThought'])],
            movables: [],
            mapObjects: []
        });
        levelManagerMock.getObjectsByTag.and.returnValue([]);
        levelManagerMock.gridManager.width = 3;
        levelManagerMock.gridManager.height = 3;

        triggerSystem = new TriggerSystem(levelManagerMock);
        eventBusEmitSpy = spyOn(EventBus, 'emit');
    });

    it('should find switches and return their coordinates', () => {
        const context: TriggerContext = {
            type: TriggerType.MODEL_FUNCTION,
            payload: { name: 'find_switch' }
        };

        // Mock grid interactions
        // (1,1) has a switch
        // (2,2) has a treasure (should be ignored)
        levelManagerMock.gridManager.getInteraction.and.callFake((gx: number, gy: number) => {
            if (gx === 1 && gy === 1) return { type: 'switch', name: 'SwitchA' };
            if (gx === 2 && gy === 2) return { type: 'treasure', name: 'Gold' };
            return null;
        });

        triggerSystem.processEvent(context);

        // Check if agent's thought was updated
        expect(levelManagerMock.agents[0].setThought).toHaveBeenCalledWith('I found 1 switch(es).');

        // Check if the result was emitted with correct coordinates
        expect(eventBusEmitSpy).toHaveBeenCalledWith('model-tool-execution-result', jasmine.objectContaining({
            name: 'find_switch',
            output: JSON.stringify([{ x: 1, y: 1, type: 'switch', name: 'SwitchA' }])
        }));
    });

    it('should return empty array if no switches found', () => {
        const context: TriggerContext = {
            type: TriggerType.MODEL_FUNCTION,
            payload: { name: 'find_switch' }
        };

        levelManagerMock.gridManager.getInteraction.and.returnValue(null);

        triggerSystem.processEvent(context);

        expect(levelManagerMock.agents[0].setThought).toHaveBeenCalledWith('I found 0 switch(es).');
        expect(eventBusEmitSpy).toHaveBeenCalledWith('model-tool-execution-result', jasmine.objectContaining({
            name: 'find_switch',
            output: '[]'
        }));
    });
});
