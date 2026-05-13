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

import { LevelManager } from './LevelManager';
import { GridManager } from '../core/GridManager';
import { InteractionType, CONSTANTS } from '../core/Constants';

describe('Phaser LevelManager', () => {
    let levelManager: LevelManager;
    let mockScene: any;
    let mockWorldData: any;
    let mockWorldBuilder: any;
    let mockGridManager: GridManager;
    let mockPlayer: any;
    let mockPlayerSprite: any;

    beforeEach(() => {
        mockScene = {
            add: jasmine.createSpyObj('add', ['sprite']),
            tweens: jasmine.createSpyObj('tweens', ['add', 'killTweensOf']),
            cameras: {
                main: {
                    scrollX: 0,
                    scrollY: 0,
                    pan: jasmine.createSpy('pan'),
                    setBounds: jasmine.createSpy('setBounds')
                }
            },
            scale: {
                gameSize: { width: 1024, height: 768 }
            }
        };

        mockWorldData = {
            getLayoutByName: jasmine.createSpy('getLayoutByName'),
            unwrapConfig: (c: any) => c,
            resolveInstanceBehaviours: jasmine.createSpy('resolveInstanceBehaviours'),
            resolveInstanceProperties: jasmine.createSpy('resolveInstanceProperties'),
            getClass: jasmine.createSpy('getClass'),
            getValueByKey: jasmine.createSpy('getValueByKey'),
            getTextureFile: jasmine.createSpy('getTextureFile'),
            getTextureList: () => []
        };

        mockWorldBuilder = {
            build: jasmine.createSpy('build')
        };
        
        mockGridManager = new GridManager(100, 100);
        
        // Mock Player
        mockPlayer = {
            x: 0, y: 0,
            setPosition: function(x: number, y: number) { this.x = x; this.y = y; },
            on: jasmine.createSpy('on'),
            destroy: jasmine.createSpy('destroy'),
            setLocked: jasmine.createSpy('setLocked')
        };

        mockPlayerSprite = {
            setPosition: jasmine.createSpy('setPosition'),
            destroy: jasmine.createSpy('destroy')
        };

        levelManager = new LevelManager(mockScene, mockWorldData, mockWorldBuilder);
    });

    it('should initialize and get game size from scene', () => {
        expect(levelManager).toBeDefined();
        // Indirectly check getGameSize via updateCameraTarget usage or similar
        // Or check protected method if needed, but integration logic below covers it.
    });

    it('should set player sprite position on build', () => {
        // Setup initial state
        levelManager.currentLayoutName = 'Level1';
        
        const newLayout = { config: { name: 'Level2', height: { value: 1024 } }, layers: [] };
        mockWorldData.getLayoutByName.and.returnValue(newLayout);

        // Setup buildLevel result
        mockWorldBuilder.build.and.returnValue({
            gridManager: mockGridManager,
            player: mockPlayer,
            playerSprite: mockPlayerSprite,
            npcs: [],
            agents: [],
            npcSprites: new Map(),
            movables: [],
            movableSprites: new Map(),
            mapObjects: []
        });

        // Portal setup
        (newLayout as any).layers = [{ instances: [{}] }];
        mockWorldData.resolveInstanceBehaviours.and.returnValue([
             { type: InteractionType.PORTAL, linkURL: 'Level1' }
        ]);
        mockWorldData.resolveInstanceProperties.and.returnValue({ x: 48, y: 48 });

        levelManager.changeLayout('Level2');

        expect(levelManager.playerSprite).toBe(mockPlayerSprite);
        expect(mockPlayer.on).toHaveBeenCalledWith('move', jasmine.any(Function));
    });

    it('should animate player move', () => {
        const playerHandlers: {[key: string]: Function} = {};
        mockPlayer.on.and.callFake((event: string, handler: Function) => {
            playerHandlers[event] = handler;
        });

        mockWorldBuilder.build.and.returnValue({
            gridManager: mockGridManager,
            player: mockPlayer,
            playerSprite: mockPlayerSprite,
            npcs: [],
            agents: [],
            npcSprites: new Map(),
            movables: [],
            movableSprites: new Map(),
            mapObjects: []
        });

        levelManager.player = mockPlayer;
        (levelManager as any).onLevelBuilt({
            gridManager: mockGridManager,
            player: mockPlayer,
            playerSprite: mockPlayerSprite,
            npcs: [],
            agents: [],
            npcSprites: new Map(),
            movables: [],
            movableSprites: new Map(),
            mapObjects: []
        });

        const moveData = {
            x: 100, y: 100, duration: 200, type: 'move'
        };

        playerHandlers['move'](moveData);

        expect(mockScene.tweens.add).toHaveBeenCalledWith(jasmine.objectContaining({
            targets: mockPlayerSprite,
            x: 100,
            y: 100,
            duration: 200
        }));
    });

    it('should update camera target on player move-complete', () => {
        const playerHandlers: {[key: string]: Function} = {};
        mockPlayer.on.and.callFake((event: string, handler: Function) => {
            playerHandlers[event] = handler;
        });

        mockWorldBuilder.build.and.returnValue({
             gridManager: mockGridManager,
             player: mockPlayer, playerSprite: mockPlayerSprite,
             npcs: [],
             agents: [],
             npcSprites: new Map(),
             movables: [], movableSprites: new Map(),
             mapObjects: []
        });

        levelManager.player = mockPlayer;
        (levelManager as any).onLevelBuilt({
             gridManager: mockGridManager,
             player: mockPlayer, playerSprite: mockPlayerSprite,
             npcs: [],
             agents: [],
             npcSprites: new Map(),
             movables: [], movableSprites: new Map(),
             mapObjects: []
        });

        // Simulate move completion
        mockPlayer.x = 100;
        mockPlayer.y = 100;

        playerHandlers['move-complete']();

        // Screen 1024x768. Player at 100,100 -> Room 0,0.
        // CamX = 0, CamY = 0 (offset assumed 0 for simplification or mocked)
        
        expect(mockScene.cameras.main.pan).toHaveBeenCalled();
        const args = mockScene.cameras.main.pan.calls.mostRecent().args;
        expect(args[0]).toBe(512); // 0 + 1024/2
    });
});
