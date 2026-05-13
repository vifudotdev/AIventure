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
import { TriggerType, TriggerContext, ActionType } from './TriggerTypes';
import { EventBus } from '../EventBus';
import { ILevelManager } from '../Interfaces';

describe('TriggerSystem', () => {
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
        levelManagerMock.gridManager.width = 10;
        levelManagerMock.gridManager.height = 10;

        triggerSystem = new TriggerSystem(levelManagerMock);
        eventBusEmitSpy = spyOn(EventBus, 'emit');
    });

    it('should initialize and load rules', () => {
        expect(triggerSystem).toBeDefined();
        expect((triggerSystem as any).rules.length).toBeGreaterThan(0);
    });

    describe('Process Event', () => {
        it('should trigger MOVABLE_LANDED (Apple Puzzle) and Open Door', () => {
            const context: TriggerContext = {
                type: TriggerType.MOVABLE_LANDED,
                subject: { name: 'Apple' }
            };

            // Mock object to be destroyed
            const doorMock = { destroy: jasmine.createSpy('destroy'), props: { x: 32, y: 32, width: 32, height: 32 } };
            levelManagerMock.getObjectsByTag.and.returnValue([doorMock]);
            levelManagerMock.mapObjects = [doorMock];

            triggerSystem.processEvent(context);

            expect(levelManagerMock.getObjectsByTag).toHaveBeenCalledWith('AppleDoor');
            expect(doorMock.destroy).toHaveBeenCalled();
        });

        it('should trigger MOVABLE_LANDED (Scroll Puzzle) and Ask Model', () => {
            const context: TriggerContext = {
                type: TriggerType.MOVABLE_LANDED,
                subject: { name: 'Scroll', getContext: () => 'Scroll contains: 8452' }
            };

            triggerSystem.processEvent(context);

            expect(eventBusEmitSpy).toHaveBeenCalledWith('ask-model', 'Scroll contains: 8452', "What's the code?");
        });

        it('should trigger INTERACTION (Light Switch) and Toggle Light', () => {
            const context: TriggerContext = {
                type: TriggerType.INTERACTION,
                payload: { linkURL: 'light' }
            };

            // Mock objects for light
            const lightObj = { destroy: jasmine.createSpy('destroy'), props: { x: 32, y: 32, width: 32, height: 32 } };
            levelManagerMock.getObjectsByTag.and.returnValue([lightObj]);
            levelManagerMock.mapObjects = [lightObj];

            triggerSystem.processEvent(context);

            expect(levelManagerMock.getObjectsByTag).toHaveBeenCalledWith('Dark');
            expect(lightObj.destroy).toHaveBeenCalled();
            // It also opens door 'light'
            expect(levelManagerMock.getObjectsByTag).toHaveBeenCalledWith('LightDoor');
        });

        it('should trigger MODEL_FUNCTION (Open Door)', () => {
            const context: TriggerContext = {
                type: TriggerType.MODEL_FUNCTION,
                payload: { name: 'open_Blue' }
            };

            const doorMock = { destroy: jasmine.createSpy('destroy'), props: { x: 32, y: 32, width: 32, height: 32 } };
            levelManagerMock.getObjectsByTag.and.returnValue([doorMock]);
            levelManagerMock.mapObjects = [doorMock];

            triggerSystem.processEvent(context);

            expect(levelManagerMock.getObjectsByTag).toHaveBeenCalledWith('BlueDoor');
            expect(doorMock.destroy).toHaveBeenCalled();
        });

        it('should trigger NPC Skill (Find Switch)', () => {
            const context: TriggerContext = {
                type: TriggerType.MODEL_FUNCTION,
                payload: { name: 'find_switch' }
            };

            levelManagerMock.gridManager.getInteraction.and.returnValue({ type: 'switch', linkURL: 'test' });

            triggerSystem.processEvent(context);

            expect(levelManagerMock.agents[0].setThought).toHaveBeenCalled();
            expect(eventBusEmitSpy).toHaveBeenCalledWith('model-tool-execution-result', jasmine.objectContaining({
                name: 'find_switch'
            }));
        });
    });
});
