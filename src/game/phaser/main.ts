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

import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { CONSTANTS } from '../core/Constants';
import { CRTPipeline } from './shaders/CRTShader';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: CONSTANTS.GAME_LOGICAL_WIDTH,
    height: CONSTANTS.GAME_LOGICAL_HEIGHT,
    pixelArt: true,
    parent: 'game-container',
    backgroundColor: '#000000',
    scale: {
	mode: Scale.FIT,
	autoCenter: Scale.CENTER_BOTH
    },
    pipeline: { 'CRTPipeline': CRTPipeline } as any,
    scene: [
        Boot,
        Preloader,
        MainGame,
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
