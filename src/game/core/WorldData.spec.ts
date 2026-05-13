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

import { WorldData, GameData } from './WorldData';

describe('WorldData', () => {
  let worldData: WorldData;
  let mockGameData: GameData;

  beforeEach(() => {
    worldData = new WorldData();
    mockGameData = {
      game: {
        id: 'test-game',
        classes: [
          {
            id: 'parentClass',
            type: 'sprite',
            inherit: '',
            config: {
              prop1: { type: 'string', value: 'parentValue' },
              prop2: { type: 'integer', value: '10' }
            },
            behaviours: [],
            animations: []
          },
          {
            id: 'childClass',
            type: 'sprite',
            inherit: 'parentClass',
            config: {
              prop1: { type: 'string', value: 'childValue' },
              prop3: { type: 'boolean', value: 'true' }
            },
            behaviours: [],
            animations: []
          }
        ],
        layouts: [
          {
            id: 'layout1',
            type: 'layout',
            config: { name: { type: 'string', value: 'Main Layout' } },
            layers: []
          }
        ],
        behaviours: [
          {
            id: 'globalBehaviour',
            type: 'behaviour',
            inherit: '',
            config: { bProp: { type: 'string', value: 'global' } }
          }
        ],
        textures: [
          {
            id: 'tex1',
            type: 'texture',
            config: { md5: { type: 'string', value: 'hash1' } }
          }
        ],
        config: {
          startLayout: { type: 'string', value: 'layout1' }
        }
      }
    };
  });

  it('should load and get world data', () => {
    worldData.loadWorldData(mockGameData);
    expect(worldData.getData()).toEqual(mockGameData);
  });

  it('should get start layout', () => {
    worldData.loadWorldData(mockGameData);
    const startLayout = worldData.getStartLayout();
    expect(startLayout).toBeDefined();
    expect(startLayout?.id).toBe('layout1');
  });

  it('should return undefined for start layout if no data loaded', () => {
    expect(worldData.getStartLayout()).toBeUndefined();
  });

  it('should get layout by id', () => {
    worldData.loadWorldData(mockGameData);
    expect(worldData.getLayout('layout1')).toBeDefined();
    expect(worldData.getLayout('nonexistent')).toBeUndefined();
  });

  it('should get layout by name', () => {
    worldData.loadWorldData(mockGameData);
    expect(worldData.getLayoutByName('Main Layout')).toBeDefined();
    expect(worldData.getLayoutByName('main layout')).toBeDefined(); // Case insensitive
    expect(worldData.getLayoutByName('nonexistent')).toBeUndefined();
  });

  describe('unwrapConfig', () => {
    it('should unwrap various types correctly', () => {
      const config = {
        int: { type: 'integer', value: '42' },
        float: { type: 'float', value: '3.14' },
        boolTrue: { type: 'boolean', value: 'true' },
        bool1: { type: 'boolean', value: '1' },
        boolFalse: { type: 'boolean', value: 'false' },
        bool0: { type: 'boolean', value: '0' },
        json: { type: 'json', value: '{"a": 1}' },
        string: { type: 'string', value: 'hello' }
      };
      const unwrapped = worldData.unwrapConfig(config);
      expect(unwrapped.int).toBe(42);
      expect(unwrapped.float).toBe(3.14);
      expect(unwrapped.boolTrue).toBeTrue();
      expect(unwrapped.bool1).toBeTrue();
      expect(unwrapped.boolFalse).toBeFalse();
      expect(unwrapped.bool0).toBeFalse();
      expect(unwrapped.json).toEqual({ a: 1 });
      expect(unwrapped.string).toBe('hello');
    });

    it('should handle invalid values with safe fallbacks', () => {
      const config = {
        badInt: { type: 'integer', value: 'abc' },
        badFloat: { type: 'float', value: 'abc' },
        badJson: { type: 'json', value: 'invalid json' }
      };
      const unwrapped = worldData.unwrapConfig(config);
      expect(unwrapped.badInt).toBe(0);
      expect(unwrapped.badFloat).toBe(0.0);
      expect(unwrapped.badJson).toBeNull();
    });

    it('should skip --marker property', () => {
      const config = {
        '--marker': { type: 'string', value: 'ignored' },
        real: { type: 'string', value: 'kept' }
      };
      const unwrapped = worldData.unwrapConfig(config);
      expect(unwrapped['--marker']).toBeUndefined();
      expect(unwrapped.real).toBe('kept');
    });
  });

  it('should get class hierarchy', () => {
    worldData.loadWorldData(mockGameData);
    const hierarchy = worldData.getClassHierarchy('childClass');
    expect(hierarchy.length).toBe(2);
    expect(hierarchy[0].id).toBe('parentClass');
    expect(hierarchy[1].id).toBe('childClass');
  });

  it('should resolve class properties with inheritance', () => {
    worldData.loadWorldData(mockGameData);
    const props = worldData.resolveClassProperties('childClass');
    expect(props.prop1).toBe('childValue'); // Overridden
    expect(props.prop2).toBe(10); // Inherited (and unwrapped)
    expect(props.prop3).toBeTrue(); // Own
  });

  it('should resolve instance properties', () => {
    worldData.loadWorldData(mockGameData);
    const instance = {
      id: 'inst1',
      inherit: 'childClass',
      config: {
        prop2: { type: 'integer', value: '20' }
      },
      behaviours: [],
      animations: []
    } as any;

    const props = worldData.resolveInstanceProperties(instance);
    expect(props.prop1).toBe('childValue'); // From childClass
    expect(props.prop2).toBe(20); // Overridden in instance
    expect(props._classId).toBe('childClass');
    expect(props._instanceId).toBe('inst1');
  });

  it('should apply layer Z to instance properties', () => {
    worldData.loadWorldData(mockGameData);
    const instance = {
      id: 'inst1',
      inherit: 'parentClass',
      config: { z: { type: 'float', value: '5' } },
      behaviours: [],
      animations: []
    } as any;
    const layer = {
      config: { z: { type: 'float', value: '10' } }
    } as any;

    const props = worldData.resolveInstanceProperties(instance, layer);
    expect(props.z).toBe(15);
  });

  it('should resolve class behaviours with multi-depth inheritance', () => {
    const gameData: GameData = {
      game: {
        ...mockGameData.game,
        behaviours: [
          {
            id: 'globalMove',
            type: 'b',
            inherit: '',
            config: { speed: { type: 'number', value: 10 } }
          }
        ],
        classes: [
          {
            id: 'A',
            type: 'sprite',
            inherit: '',
            config: {},
            behaviours: [
              { id: 'move', type: 'b', inherit: 'globalMove', config: { speed: { type: 'number', value: 20 } } }
            ],
            animations: []
          },
          {
            id: 'B',
            type: 'sprite',
            inherit: 'A',
            config: {},
            behaviours: [
              { id: 'fastMove', type: 'b', inherit: 'move', config: { speed: { type: 'number', value: 30 } } }
            ],
            animations: []
          },
          {
            id: 'C',
            type: 'sprite',
            inherit: 'B',
            config: {},
            behaviours: [
              { id: 'superFastMove', type: 'b', inherit: 'fastMove', config: { speed: { type: 'number', value: 40 } } }
            ],
            animations: []
          }
        ]
      }
    };
    worldData.loadWorldData(gameData);
    const behaviours = worldData.resolveClassBehaviours('C');
    
    expect(behaviours.has('move')).toBeTrue();
    expect(behaviours.get('move').speed).toBe(20);

    expect(behaviours.has('fastMove')).toBeTrue();
    expect(behaviours.get('fastMove').speed).toBe(30);

    expect(behaviours.has('superFastMove')).toBeTrue();
    expect(behaviours.get('superFastMove').speed).toBe(40);
  });

  it('should resolve instance behaviours with overrides', () => {
     const gameDataWithBehaviours: GameData = {
      game: {
        ...mockGameData.game,
        classes: [
          {
            id: 'pClass',
            type: 'sprite',
            inherit: '',
            config: {},
            behaviours: [
              { id: 'b1', type: 'b', inherit: 'globalBehaviour', config: { p: { type: 'string', value: 'v1' } } }
            ],
            animations: []
          }
        ]
      }
    };
    worldData.loadWorldData(gameDataWithBehaviours);
    const instance = {
      id: 'inst1',
      inherit: 'pClass',
      behaviours: [
        { id: 'overrideB1', type: 'b', inherit: 'b1', config: { p: { type: 'string', value: 'instV' } } },
        { id: 'newB', type: 'b', inherit: 'globalBehaviour', config: { newP: { type: 'string', value: 'newV' } } }
      ],
      animations: []
    } as any;

    const resolved = worldData.resolveInstanceBehaviours(instance);
    expect(resolved.length).toBe(2);

    const b1 = resolved.find(b => b.p === 'instV');
    expect(b1).toBeDefined();
    expect(b1.bProp).toBe('global');

    const newB = resolved.find(b => b.newP === 'newV');
    expect(newB).toBeDefined();
  });

  it('should resolve class animations with overrides', () => {
    const gameDataWithAnims: GameData = {
      game: {
        ...mockGameData.game,
        classes: [
          {
            id: 'pClass',
            type: 'sprite',
            inherit: '',
            config: {},
            behaviours: [],
            animations: [
              { id: 'anim1', type: 'a', inherit: '', config: { speed: { type: 'integer', value: '10' } }, frames: [] }
            ]
          },
          {
            id: 'cClass',
            type: 'sprite',
            inherit: 'pClass',
            config: {},
            behaviours: [],
            animations: [
              { id: 'overrideAnim1', type: 'a', inherit: 'anim1', config: { speed: { type: 'integer', value: '20' } }, frames: [] }
            ]
          }
        ]
      }
    };
    worldData.loadWorldData(gameDataWithAnims);
    const anims = worldData.resolveClassAnimations('cClass');
    expect(anims.has('anim1')).toBeTrue();
    expect(worldData.unwrapConfig(anims.get('anim1')!.config).speed).toBe(20);
  });

  it('should resolve instance animations', () => {
    const gameDataWithAnims: GameData = {
      game: {
        ...mockGameData.game,
        classes: [
          {
            id: 'pClass',
            type: 'sprite',
            inherit: '',
            config: {},
            behaviours: [],
            animations: [
              { id: 'anim1', type: 'a', inherit: '', config: { speed: { type: 'integer', value: '10' } }, frames: [] }
            ]
          }
        ]
      }
    };
    worldData.loadWorldData(gameDataWithAnims);
    const instance = {
      id: 'inst1',
      inherit: 'pClass',
      animations: [
        { id: 'anim1', type: 'a', inherit: '', config: { speed: { type: 'integer', value: '30' } }, frames: [] }
      ]
    } as any;

    const resolved = worldData.resolveInstanceAnimations(instance);
    expect(resolved.length).toBe(1);
    expect(worldData.unwrapConfig(resolved[0].config).speed).toBe(30);
  });

  it('should get texture list and file', () => {
    worldData.loadWorldData(mockGameData);
    expect(worldData.getTextureList()?.length).toBe(1);
    expect(worldData.getTextureFile('tex1')).toBe('hash1');
    expect(worldData.getTextureFile('nonexistent')).toBeUndefined();
  });

  it('should get class and global behaviour', () => {
    worldData.loadWorldData(mockGameData);
    expect(worldData.getClass('parentClass')).toBeDefined();
    expect(worldData.getClass('nonexistent')).toBeUndefined();
    expect(worldData.getGlobalBehaviour('globalBehaviour')).toBeDefined();
    expect(worldData.getGlobalBehaviour('nonexistent')).toBeUndefined();
  });

  it('should get class animations as array', () => {
    const gameDataWithAnims: GameData = {
      game: {
        ...mockGameData.game,
        classes: [
          {
            id: 'c1',
            type: 'sprite',
            inherit: '',
            config: {},
            behaviours: [],
            animations: [{ id: 'a1', type: 'a', inherit: '', config: {}, frames: [] }]
          }
        ]
      }
    };
    worldData.loadWorldData(gameDataWithAnims);
    const anims = worldData.getClassAnimations('c1');
    expect(anims.length).toBe(1);
    expect(anims[0].id).toBe('a1');
  });

  it('should resolve animation and frame properties', () => {
    const anim = { config: { speed: { type: 'integer', value: '10' } } } as any;
    const frame = { config: { duration: { type: 'integer', value: '100' } } } as any;
    expect(worldData.resolveAnimationProperties(anim).speed).toBe(10);
    expect(worldData.resolveFrameProperties(frame).duration).toBe(100);
  });
});
