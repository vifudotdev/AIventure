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

import { EventBus } from '../../core/EventBus';
import { Scene } from 'phaser';
import { WorldData } from '../../core/WorldData';
import { CONSTANTS, Direction } from '../../core/Constants';
import { WorldBuilder } from '../WorldBuilder';
import { LevelManager } from '../LevelManager';
import { InteractionSystem } from '../../core/InteractionSystem';
import { CRTPipeline } from '../shaders/CRTShader';

export class Game extends Scene
{
    public worldData: WorldData;
    private worldBuilder!: WorldBuilder;
    private levelManager!: LevelManager;
    private interactionSystem!: InteractionSystem;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor()
    {
        super('Game');
        this.worldData = new WorldData();
    }

    preload()
    {
        this.load.setPath('assets/gamedata');
        // Ensure 'worldData' is loaded in a Boot scene or here if not already
        if (this.cache.json.exists('worldData'))
        {
            this.worldData.loadWorldData(this.cache.json.get('worldData'));
        }

        this.worldBuilder = new WorldBuilder(this, this.worldData);
        this.worldBuilder.generateDefaultTextures();
    }

    create()
    {
        this.levelManager = new LevelManager(this, this.worldData, this.worldBuilder);
        this.levelManager.setGameSize(CONSTANTS.GAME_LOGICAL_WIDTH, CONSTANTS.GAME_LOGICAL_HEIGHT);
        this.interactionSystem = new InteractionSystem(this.levelManager);

        const startLayout = this.worldData.getStartLayout();
        if (startLayout)
        {
            this.levelManager.buildLevel(startLayout);
        }

        // Setup Camera
        this.cameras.main.setBackgroundColor(CONSTANTS.colors.BG);
        this.cameras.main.setZoom(CONSTANTS.ZOOM.X, CONSTANTS.ZOOM.Y);
        this.cameras.main.setPostPipeline(CRTPipeline);

        if (this.input.keyboard)
        {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.input.keyboard.on('keydown', (event: KeyboardEvent) =>
            {
                if (event.key === '`')
                {
                    if (this.levelManager && this.levelManager.player)
                    {
                        this.levelManager.player.godMode = !this.levelManager.player.godMode;
                        EventBus.emit('god-mode-changed', this.levelManager.player.godMode);
                        console.log('God mode:', this.levelManager.player.godMode);
                    }
                }
            });
        }

        EventBus.emit('current-scene-ready', this);

        this.events.on('shutdown', this.onDestroy, this);
        this.events.on('destroy', this.onDestroy, this);
    }

    private onDestroy()
    {
        if (this.interactionSystem)
        {
            this.interactionSystem.unregisterEvents();
        }
    }

    override update(time: number, delta: number)
    {
        if (this.levelManager)
        {
            if (this.levelManager.player && this.cursors)
            {
                const direction = this.getInputDirection();
                if (this.cursors.shift.isDown && this.levelManager.player.godMode)
                {
                    const size = this.levelManager.getGameSize();
                    this.levelManager.player.attemptRoomJump(direction, size.width, size.height);
                } else
                {
                    this.levelManager.player.attemptMove(direction);
                }
            }
            this.levelManager.update(time, delta);
        }
    }

    private getInputDirection(): Direction
    {
        if (this.cursors.left.isDown) return Direction.Left;
        if (this.cursors.right.isDown) return Direction.Right;
        if (this.cursors.up.isDown) return Direction.Up;
        if (this.cursors.down.isDown) return Direction.Down;
        return Direction.None;
    }

    changeScene()
    {
        this.scene.start('GameOver');
    }
}