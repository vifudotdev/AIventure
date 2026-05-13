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

import { WorldBuilder, BuiltLevel } from './WorldBuilder';
import { WorldData } from '../core/WorldData';
import { GridManager } from '../core/GridManager';
import { MovingNPC } from '../core/MovingNPC';
import { MovableObject } from '../core/MovableObject';

describe('Phaser WorldBuilder', () => {
    let worldBuilder: WorldBuilder;
    let mockScene: any;
    let mockWorldData: any;
    let mockGridManager: GridManager;

    beforeEach(() => {
        mockScene = {
            add: jasmine.createSpyObj('add', ['sprite', 'image', 'group']),
            load: jasmine.createSpyObj('load', ['image', 'start']),
            textures: jasmine.createSpyObj('textures', ['exists']),
            anims: jasmine.createSpyObj('anims', ['create', 'exists']),
            cameras: {
                main: jasmine.createSpyObj('main', ['setBounds'])
            },
            make: jasmine.createSpyObj('make', ['graphics'])
        };

        mockScene.add.sprite.and.returnValue({
            setDepth: jasmine.createSpy('setDepth'),
            setDisplaySize: jasmine.createSpy('setDisplaySize'),
            setName: jasmine.createSpy('setName'),
            play: jasmine.createSpy('play'),
            setFlip: jasmine.createSpy('setFlip')
        });
        
        mockScene.add.image.and.returnValue({
            setDepth: jasmine.createSpy('setDepth'),
            setDisplaySize: jasmine.createSpy('setDisplaySize'),
            setFlip: jasmine.createSpy('setFlip'),
            setVisible: jasmine.createSpy('setVisible')
        });

        mockWorldData = {
            getClass: jasmine.createSpy('getClass').and.returnValue({ config: {} }),
            unwrapConfig: (c: any) => c,
            resolveInstanceProperties: () => ({}),
            resolveInstanceBehaviours: () => [],
            isFlipY: () => false,
            getTextureFile: jasmine.createSpy('getTextureFile').and.returnValue('test.png'),
            getTextureList: () => [],
            resolveInstanceAnimations: () => [],
            resolveAnimationProperties: () => ({}),
            resolveFrameProperties: () => ({})
        };
        mockGridManager = new GridManager(100, 100);

        worldBuilder = new WorldBuilder(mockScene, mockWorldData);
    });

    it('should initialize correctly', () => {
        expect(worldBuilder).toBeDefined();
    });

    it('should preload textures on build', () => {
        const layout = {
            config: {},
            layers: [{
                instances: [{ inherit: 'TestClass', config: {} }]
            }]
        };

        mockWorldData.getClass.and.returnValue({ config: { image: { value: 'test.png' } } });
        mockWorldData.getTextureFile.and.returnValue('test.png');
        mockScene.textures.exists.and.returnValue(false);

        // Spy on internal methods to avoid crashing
        spyOn<any>(worldBuilder, 'createLevelData').and.returnValue({
            gridManager: mockGridManager,
            npcs: [], npcSprites: new Map(),
            movables: [], movableSprites: new Map(),
            mapObjects: []
        });

        worldBuilder.build(layout as any);

        expect(mockScene.load.image).toHaveBeenCalledWith('test.png', 'test.png');
        expect(mockScene.load.start).toHaveBeenCalled();
    });

    describe('Visual Creation', () => {
        let levelData: BuiltLevel;

        beforeEach(() => {
            levelData = {
                gridManager: mockGridManager,
                playerSprite: null as any,
                npcs: [],
                agents: [],
                npcSprites: new Map(),
                movables: [],
                movableSprites: new Map(),
                mapObjects: [],
                player: null as any
            };
        });

        it('should create player visual', () => {
            (worldBuilder as any).createPlayerVisual(levelData, 100, 100);

            expect(mockScene.add.sprite).toHaveBeenCalledWith(100, 100, '../player-1.png');
            expect(levelData.playerSprite).toBeDefined();
        });

        it('should create NPC visual', () => {
             const npc = new MovingNPC({ x: 0, y: 0 }, mockGridManager, 0);
             const inst = { inherit: 'TestNPC', config: {} };
             const props = { width: 32, height: 32 };
             const pos = { x: 50, y: 50, z: 1 };

             mockWorldData.getClass.and.returnValue({ config: { image: { value: 'npc.png' } } });
             mockWorldData.getTextureFile.and.returnValue('npc.png');

             (worldBuilder as any).createNPCVisual(inst, props, [], [], levelData, npc, pos, 0);

             expect(mockScene.add.sprite).toHaveBeenCalledWith(50, 50, 'npc.png');
             expect(levelData.npcSprites.has(npc)).toBeTrue();
        });

        it('should create Movable visual', () => {
            const movable = new MovableObject({ x: 0, y: 0, name: 'Box' }, mockGridManager);
            const inst = { inherit: 'Box', config: {} };
            const props = { width: 32, height: 32, z: 0, name: 'Box' };
            const pos = { x: 50, y: 50, z: 1 };

            mockWorldData.getClass.and.returnValue({ config: { image: { value: 'box.png' } } });
            mockWorldData.getTextureFile.and.returnValue('box.png');
            
            (worldBuilder as any).createMovableVisual(inst, props, [], [], levelData, movable, pos, 0);

            expect(mockScene.add.sprite).toHaveBeenCalledWith(50, 50, 'box.png');
            expect(levelData.movableSprites.has(movable)).toBeTrue();
            expect(levelData.mapObjects.length).toBe(1);
        });
    });
});
