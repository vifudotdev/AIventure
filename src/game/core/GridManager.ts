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

import { CONSTANTS } from './Constants';

export class GridManager {
    public width: number = 0;
    public height: number = 0;
    private collisionMap: { full: number, player: number, npc: number }[][] = [];
    private interactionMap: any[][] = [];
    private modelToolMap: any[][] = [];
    private movableMap: any[][] = [];

    constructor(pixelWidth: number, pixelHeight: number) {
        this.width = Math.ceil(pixelWidth / CONSTANTS.GRID_SIZE);
        this.height = Math.ceil(pixelHeight / CONSTANTS.GRID_SIZE);
        this.resetMaps();
    }

    private resetMaps() {
        this.collisionMap = Array.from({ length: this.height }, () => 
            Array.from({ length: this.width }, () => ({ full: 0, player: 0, npc: 0 }))
        );
        this.interactionMap = Array.from({ length: this.height }, () => 
            Array(this.width).fill(null)
        );
        this.modelToolMap = Array.from({ length: this.height }, () =>
            Array(this.width).fill(null)
        );
        this.movableMap = Array.from({ length: this.height }, () => 
            Array(this.width).fill(null)
        );
    }

    public setBlocker(gx: number, gy: number, isBlocker: boolean, type: string = 'full') {
        if (this.isValid(gx, gy)) {
            const cell = this.collisionMap[gy][gx];
            const key = type === 'player-only' ? 'player' : type === 'npc-only' ? 'npc' : 'full';
            if (isBlocker) {
                cell[key]++;
            } else {
                cell[key] = Math.max(0, cell[key] - 1);
            }
        }
    }

    public setMovable(gx: number, gy: number, movable: any) {
        if (this.isValid(gx, gy)) {
            this.movableMap[gy][gx] = movable;
        }
    }

    public getMovable(gx: number, gy: number): any {
        if (!this.isValid(gx, gy)) return null;
        return this.movableMap[gy][gx];
    }

    public moveMovable(oldGx: number, oldGy: number, newGx: number, newGy: number) {
        if (this.isValid(oldGx, oldGy) && this.isValid(newGx, newGy)) {
            this.movableMap[newGy][newGx] = this.movableMap[oldGy][oldGx];
            this.movableMap[oldGy][oldGx] = null;
        }
    }

    public setModelToolMap(gx: number, gy: number, data: any) {
        if (this.isValid(gx, gy)) {
            this.modelToolMap[gy][gx] = data;
        }
    }

    public getModelToolMap(gx: number, gy: number): any {
        if (!this.isValid(gx, gy)) return null;
        return this.modelToolMap[gy][gx];
    }

    public setInteraction(gx: number, gy: number, data: any) {
        if (this.isValid(gx, gy)) {
            this.interactionMap[gy][gx] = data;
        }
    }

    public getInteraction(gx: number, gy: number): any {
        if (!this.isValid(gx, gy)) return null;
        return this.interactionMap[gy][gx];
    }

    public isBlocked(gx: number, gy: number, entityType: 'player' | 'npc' | 'any' = 'any'): boolean {
        if (!this.isValid(gx, gy)) return true; // Out of bounds is blocked
        const cell = this.collisionMap[gy][gx];
        if (cell.full > 0) return true;
        if (entityType === 'player' && cell.player > 0) return true;
        if (entityType === 'npc' && cell.npc > 0) return true;
        if (entityType === 'any' && (cell.player > 0 || cell.npc > 0)) return true;
        return false;
    }

    public toGrid(pixel: number): number {
        return Math.floor((pixel - CONSTANTS.HALF_GRID) / CONSTANTS.GRID_SIZE);
    }

    public toPixel(grid: number): number {
        return grid * CONSTANTS.GRID_SIZE + CONSTANTS.HALF_GRID;
    }

    private isValid(gx: number, gy: number): boolean {
        return gx >= 0 && gx < this.width && gy >= 0 && gy < this.height;
    }

    public removeObject(x: number, y: number)
    {
        if (this.isValid(x, y))
        {
            this.movableMap[y][x] = null;
            this.interactionMap[y][x] = null;
        }
    }
}
