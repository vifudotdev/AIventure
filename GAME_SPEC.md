# Game Engine Specification: Dynamic Wiring

This document outlines how the static `game.json` data is dynamically consumed and wired into the runtime game engine (Phaser).

## 0. Architecture Diagram

```
+-----------------------------------------------------------------------------+
|                                 DATA LAYER                                  |
|                                                                             |
|   [game.json]                                                               |
|        |                                                                    |
|        v                                                                    |
|   [core/WorldData.ts] ---------------------------------------------------+  |
|   (Parses, Resolves Inheritance,                                         |  |
|    Validates Config)                                                     |  |
+--------------------------------------------------------------------------|--+
                                                                           |
                                                           (Builds World Logic & Visuals)
                                                                           |
+--------------------------------------------------------------------------v-------+
|                       RENDERER IMPLEMENTATION (Phaser)                           |
|                                                                                  |
|   +-----------------------+      +---------------------+                         |
|   |    LevelManager       |      |    InteractionSystem|                         |
|   | (Phaser Impl)         |      | (Core Logic)        |                         |
|   |-----------------------|      |---------------------|                         |
|   | Orchestrates:         |      | Detects:            |                         |
|   | - Logic Entities      |<---->| - Clicks            |                         |
|   | - Visual Sprites      |      | - Room Changes      |                         |
|   | - Camera              |      +----------+----------+                         |
|   +-----------+-----------+                 |                                    |
|               |                             v                                    |
|               |                  +---------------------+                         |
|    (Core)     | Events           |    TriggerSystem    |                         |
|   [Player]----+--------->        | (Core Logic)        |                         |
|   [NPC]       | (Move,           | * Central Logic Brain                         |
|   [Movable]   |  Interact)       | * Evaluates Rules                             |
|               |                  +----------+----------+                         |
|               v                             |                                    |
|    (Visual)                              (Action)                                |
|   [Sprite]    <(Tween)--+                   |                                    |
|                      |                      v                                    |
|                      |           +---------------------+                         |
|                      |           |      EventBus       |                         |
|                      |           |---------------------|                         |
|                      |           | Routes:             |                         |
|                      +-----------| - AI Commands       |                         |
|                                  | - UI Events         |                         |
|                                  +----------^----------+                         |
|                                             |                                    |
+---------------------------------------------|------------------------------------+
                                              |
                                     (Events: "open_blue")
                                              |
+---------------------------------------------v------+
|                 ANGULAR / UI LAYER                 |
|                                                    |
|  [GeminiService]   [Code/Chat UI]                  |
|  (AI Brain)        (User Input)                    |
+----------------------------------------------------+
```

## 1. Data Pipeline

### Loading
- **Entry Point:** `src/game/phaser/scenes/Preloader.ts`
- **Action:** Loads `public/assets/gamedata/game.json` into the engine's cache or memory.

### Parsing & Resolution
- **Handler:** `src/game/core/WorldData.ts`
- **Responsibility:**
    - Wraps the raw JSON structure.
    - **Inheritance:** Resolves `inherit` chains for Classes and Behaviours.
    - **Property Unwrapping:** Converts the verbose editor format into usable primitives.
    - **Accessors:** Provides methods to fetch Layouts, Classes, and Textures.

## 2. World Generation (`WorldBuilder`)

The Builder is responsible for constructing the level, separating logical entities from their visual representations. `phaser/WorldBuilder.ts` extends the abstract `core/BaseWorldBuilder.ts`.

### Build Process (`build`)
1.  **Grid Initialization:** `BaseWorldBuilder` creates a `GridManager` (Core).
2.  **Layer Processing:** `BaseWorldBuilder` iterates through all layers and their instances.
3.  **Entity Creation:**
    - **Logic:** `BaseWorldBuilder` instantiates `Player`, `NPC`, or `MovableObject` (from `src/game/core/`).
    - **Visual:** Subclasses (`phaser`) implement abstract methods (`createNPCVisual`, `createObjectVisual`) to instantiate sprites.
    - **Mapping:** Stores both in a `BuiltLevel` structure.

### Instance Factory (`processLayer`)
For every instance found in a layout layer, the builder determines its runtime type:

| Object Type | Detection Criteria | Logic Class (Core) | Visual Class (Phaser) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **NPC** | Has `autoMoves` > 0 | `NPC` | `Phaser.GameObjects.Sprite` | Automated character. Logic handles AI/Pathing. |
| **Movable** | Has `MOVABLE` type | `MovableObject` | `Phaser.GameObjects.Sprite` | Object pushable by player. Logic handles physics. |
| **Player** | Default Spawn | `Player` | `Phaser.GameObjects.Sprite` | Controlled by user input. |
| **Static** | Default | N/A | `Phaser.GameObjects.Sprite` | Visual decoration/walls. Logic handled by Grid blockers. |

### Asset Wiring
- **Textures:** Loaded dynamically.
- **Animations:** Registered as global animations using Phaser's Animation Manager.

## 3. Logic & View Binding (`LevelManager`)

The Level Manager takes the `BuiltLevel` from the builder and wires them together. This is where the decoupled architecture shines. The Phaser renderer has its own implementation (`phaser/LevelManager.ts`) which extends `core/BaseLevelManager.ts`.

### Decoupling Pattern
- **Logic:** Entities (`Player`, `NPC`) calculate their state changes (e.g., coordinates) and emit events via `SimpleEventEmitter`.
- **View:** `BaseLevelManager` provides the structure, while subclasses listen to these events (e.g., `'move'`) and update the corresponding Visual Object (e.g., creating a Tween for smooth movement).

### Grid Wiring
- **Behaviours:**
    - **BLOCKER:** `gridManager.setBlocker(x, y, true)`
    - **INTERACTIVE:** `gridManager.setInteraction(x, y, data)`
    - **GEMINI:** `gridManager.setGeminiToolMap(x, y, data)`

## 4. Dynamic Systems

### Interaction System (`src/game/core/InteractionSystem.ts`)
- **Input:** The active Game engine captures input and calls `player.attemptMove(direction)`.
- **Logic:** `Player` logic checks `GridManager` for collisions.
- **Feedback:** If blocked by an interactive object, `EventBus.emit('interaction')` is triggered.

### AI Integration (`GeminiService` <-> `Game`)
- **Context:** The game pushes "Visible Gemini Tools" to the AI via `EventBus`.
- **Function Calls:** The AI can execute commands via `EventBus` which are picked up by `InteractionSystem` / `TriggerSystem`.

### Camera System (Zelda-style)
- **Logic:** Tracks `player` logic coordinates.
- **Update:** When `player` emits `'move-complete'`, the Manager checks if the room boundary is crossed.
- **Action:** Pans camera and resets movable objects if room changed.

## 5. Generic Trigger/Action System (`src/game/core/trigger/TriggerSystem.ts`)

A data-oriented system replacing hardcoded checks, organized into modular components.

### Core Concepts
- **Trigger:** An event (e.g., `MOVABLE_LANDED`).
- **Rule:** Links a Trigger to Actions.
- **Action:** A concrete effect (e.g., `OPEN_DOOR`).

### Default Rules
- **Apple Puzzle:** Movable "Apple" on Slot -> Open "AppleDoor".
- **Scroll Puzzle:** Movable "Scroll" on Slot -> Ask Gemini.
- **Light Switch:** Interact "light" -> Toggle "dark" objects.
- **Gemini Commands:** `open_[color]`, `light_on`.

## 6. NPC System

The NPC system adds life and agency to the game world, utilizing a hierarchy of classes to support different levels of complexity.

### Architecture
- **Base Class:** `src/game/core/MovingNPC.ts`
    - Handles basic grid movement, collision detection, and simple autonomous behaviors.
    - **Movement Types:**
        - `IDLE`: Stationary.
        - `RANDOM`: Wanders within a short radius of spawn.
        - `PATROL`: Moves back and forth along a defined axis.
- **Advanced Class:** `src/game/core/AgenticNPC.ts`
    - Extends `MovingNPC`.
    - Adds support for complex, goal-oriented behaviors and AI overrides.
    - **Capabilities:**
        - `FOLLOW`: Tracks the player's movement.
        - `COMMAND`: Executes specific instructions (e.g., "Go to X,Y and Interact").

### Interaction Flow
1.  **Player -> NPC:**
    - Player bumps into an NPC tile.
    - `GridManager` detects collision with an "Interactive" blocker.
    - Triggers the standard `INTERACTION` event (displaying dialogue or triggering a script).

2.  **AI -> NPC:**
    - The LLM (Gemini) determines the NPC should act.
    - Emits a specific function call event (e.g., `npc_find_switch`).
    - The `TriggerSystem` intercepts this and dispatches a command to the `AgenticNPC` instance.
    - The NPC calculates a path, moves to the target, and performs the action.
