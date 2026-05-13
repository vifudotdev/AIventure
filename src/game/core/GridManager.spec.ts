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

import { GridManager } from './GridManager';
import { CONSTANTS } from './Constants';

describe('GridManager', () => {
  let gridManager: GridManager;

  beforeEach(() => {
    // 100x100 pixels, grid size 32 -> 4x4 grid
    gridManager = new GridManager(100, 100);
  });

  it('should calculate grid dimensions correctly', () => {
    const expectedWidth = Math.ceil(100 / CONSTANTS.GRID_SIZE);
    const expectedHeight = Math.ceil(100 / CONSTANTS.GRID_SIZE);
    expect(gridManager.width).toBe(expectedWidth);
    expect(gridManager.height).toBe(expectedHeight);
  });

  it('should convert pixel to grid coordinates', () => {
    // 16 is half grid (center of 0,0)
    expect(gridManager.toGrid(16)).toBe(0);
    // 48 is center of 1,1 (16 + 32)
    expect(gridManager.toGrid(48)).toBe(1);
  });

  it('should convert grid to pixel coordinates', () => {
    expect(gridManager.toPixel(0)).toBe(16);
    expect(gridManager.toPixel(1)).toBe(48);
  });

  it('should handle blockers', () => {
    gridManager.setBlocker(1, 1, true);
    expect(gridManager.isBlocked(1, 1)).toBeTrue();
    expect(gridManager.isBlocked(0, 0)).toBeFalse();
  });

  it('should handle overlapping blockers', () => {
    gridManager.setBlocker(1, 1, true); // Count = 1
    gridManager.setBlocker(1, 1, true); // Count = 2
    
    expect(gridManager.isBlocked(1, 1)).toBeTrue();

    gridManager.setBlocker(1, 1, false); // Count = 1
    expect(gridManager.isBlocked(1, 1)).toBeTrue();

    gridManager.setBlocker(1, 1, false); // Count = 0
    expect(gridManager.isBlocked(1, 1)).toBeFalse();
    
    gridManager.setBlocker(1, 1, false); // Count = 0 (clamped)
    expect(gridManager.isBlocked(1, 1)).toBeFalse();
  });

  it('should handle specific blocker types (player-only, npc-only)', () => {
    // Player-only blocker
    gridManager.setBlocker(1, 1, true, 'player-only');
    expect(gridManager.isBlocked(1, 1, 'player')).toBeTrue();
    expect(gridManager.isBlocked(1, 1, 'npc')).toBeFalse();
    expect(gridManager.isBlocked(1, 1, 'any')).toBeTrue();

    // NPC-only blocker
    gridManager.setBlocker(2, 2, true, 'npc-only');
    expect(gridManager.isBlocked(2, 2, 'npc')).toBeTrue();
    expect(gridManager.isBlocked(2, 2, 'player')).toBeFalse();
    expect(gridManager.isBlocked(2, 2, 'any')).toBeTrue();

    // Full blocker
    gridManager.setBlocker(3, 3, true, 'full');
    expect(gridManager.isBlocked(3, 3, 'player')).toBeTrue();
    expect(gridManager.isBlocked(3, 3, 'npc')).toBeTrue();
    expect(gridManager.isBlocked(3, 3, 'any')).toBeTrue();
  });

  it('should handle interactions', () => {
    const interaction = { type: 'test' };
    gridManager.setInteraction(1, 1, interaction);
    expect(gridManager.getInteraction(1, 1)).toBe(interaction);
    expect(gridManager.getInteraction(0, 0)).toBeNull();
  });

  it('should return true for isBlocked when out of bounds', () => {
    expect(gridManager.isBlocked(-1, 0)).toBeTrue();
    expect(gridManager.isBlocked(100, 0)).toBeTrue();
  });
});
