# Puzzle List

This document lists the active puzzles and interaction mechanics implemented in the `src` directory.

## 1. Code Puzzle
**Goal:** Write and execute JavaScript code that returns the specific value `5050`.
- **Location:** `src/app/components/right-panel/right-panel.component.ts` (UI), `src/game/core/trigger/PuzzleRules.ts` (Logic).
- **Mechanism:**
    1. User enters code in the "Code" tab manually, OR asks the model to generate it.
    2. Code execution emits `run-code-snippet`.
    3. `TriggerSystem` checks rule `code_puzzle_success`: `CODE_EXECUTED` event with result `5050`.
    4. Success executes `OPEN_DOOR` action.

## 2. HTML/Build Puzzle
**Goal:** Construct an HTML interface or interaction that leads to the Model calling an NPC skill (e.g., `open_pink_door`).
- **Location:** `src/app/components/right-panel/right-panel.component.ts` (UI), `src/game/core/trigger/PuzzleRules.ts` (Logic).
- **Mechanism:**
    1. User uses the "Build" tab to generate HTML/JS content.
    2. The interaction (or the instructions provided to the model) triggers the Model to execute a function call (e.g., `open_pink_door`).
    3. The `TriggerSystem` detects the `MODEL_FUNCTION` event.
    4. Rule `model_open_door` matches function names starting with `open_`.
    5. Action `OPEN_DOOR` is executed with the extracted color.

## 3. Apple Puzzle
**Goal:** Move the "Apple" object onto a target slot.
- **Location:** `src/game/core/trigger/PuzzleRules.ts`
- **Mechanism:**
    1. User pushes the "Apple" movable object.
    2. Object lands on a valid Slot.
    3. `TriggerSystem` detects `MOVABLE_LANDED` for "Apple".
    4. Rule `apple_puzzle` triggers `OPEN_DOOR` action for "Apple" color.

## 4. Scroll Puzzle
**Goal:** Move the "Scroll" object onto a target slot and correctly answer a model query.
- **Location:** `src/game/core/trigger/PuzzleRules.ts`, `src/game/core/trigger/actions/ActionHandlers.ts`
- **Mechanism:**
    1. User pushes the "Scroll" movable object.
    2. Object lands on a valid Slot.
    3. Rule `scroll_puzzle` triggers `ASK_MODEL` action.
    4. **Demonstrates RAG (Retrieval-Augmented Generation):** The system retrieves context from the "Scroll" object's property.
    5. **Current Implementation Detail:** The system checks the *scroll context* directly for the string "8452". If present, the door opens. The model is also asked "What's the code?", but the door opening logic is currently synchronous based on the scroll's content.

## 5. Switch Puzzles
**Goal:** Interact with switch objects to control environment elements.
- **Location:** `src/game/core/trigger/PuzzleRules.ts`
- **Mechanisms:**
    - **Light Switch:** Rule `light_switch` matches `INTERACTION` with `linkURL='light'`. Triggers `TOGGLE_LIGHT` and `OPEN_DOOR`.
    - **Door Switch:** Rule `door_switch` matches `INTERACTION` with other `linkURL`s. Triggers `OPEN_DOOR`.

## 6. NPC Social & Puzzle Mechanics
**Goal:** Interact with the NPC to utilize their unique capabilities, often requiring the Model (Gemini) to act as an intermediary or commander.
- **Location:** `src/game/core/trigger/PuzzleRules.ts`, `src/game/core/AgenticNPC.ts`
- **Mechanics:**
    1. **Direct Interaction:** The player can "bump" into an NPC to trigger a dialogue or event.
    2. **Model Commands:** The AI can issue commands to the NPC based on player requests (e.g., "Ask the helper to check the switch").
- **Available Functions (Model Tools):**
    - `open_[color]_door`: Direct environment control.
    - `light_on`: Toggles the light.
    - `find_switch`: Triggers the NPC to pathfind to the nearest switch.
    - `handle_switch`: Triggers the NPC to move to a switch and perform the `interact` action on it.
