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
import { Player } from './Player';
import { MovingNPC } from './MovingNPC';
import { AgenticNPC } from './AgenticNPC';
import { MovableObject } from './MovableObject';

export interface IGameObject {
    destroy(): void;
    props?: any;
    visible?: boolean;
    instanceId?: string;
}

export interface ILevelManager {
    gridManager: GridManager;
    player: Player;
    npcs: MovingNPC[];
    agents: AgenticNPC[];
    movables: MovableObject[];
    mapObjects: IGameObject[];

    changeLayout(layoutName: string): void;
    getVisibleAgent(): AgenticNPC | null;
    getObjectsByTag(tag: string): IGameObject[];
    removeObject(instanceId: string): void;
    triggerCollectible(name: string): void;
    flipObject(instanceId: string): void;
}
