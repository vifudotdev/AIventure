# Game JSON Specification

This document describes the structure of `public/assets/gamedata/game.json`, which serves as the central database for the game's static data, including assets, object definitions, levels (layouts), and configuration.

## Root Structure

The file contains a single JSON object with a `game` property.

```json
{
  "game": {
    "id": "string",
    "type": "game",
    "config": { ... },
    "inherit": null,
    "childCount": 115,    // Sum of all direct children (textures, behaviours, classes, layouts)
    "streamed": true,     // Boolean flag indicating if data is streamed
    "textures": [ ... ],
    "behaviours": [ ... ],
    "classes": [ ... ],
    "layouts": [ ... ]
  }
}
```

### Top-Level Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Unique identifier for the game project. |
| `type` | String | Fixed value "game". |
| `config` | [ConfigObject](#configobject) | Global game configuration (e.g., project name, starting layout). |
| `inherit` | String / Null | Inheritance reference (can be null for root objects). |
| `childCount` | Integer | Count of child elements (e.g., layers, instances, behaviours, animations). |
| `streamed` | Boolean | Flag indicating if the object is streamed (typically true). |
| `textures` | Array<[Texture](#texture)> | List of image assets. |
| `behaviours` | Array<[BehaviourDefinition](#behaviourdefinition)> | List of reusable logic/behavior definitions. |
| `classes` | Array<[ClassDefinition](#classdefinition)> | List of game object templates (Prefabs/Actors). |
| `layouts` | Array<[Layout](#layout)> | List of scenes/levels. |

---

## Common Structures

### ConfigObject

A key-value dictionary defining properties. Each key is a property name, and the value is an object describing the property's type, value, and metadata.

```json
{
  "propertyName": {
    "type": "string" | "integer" | "boolean" | "float" | "text" | "localised" | "enum" | "json" | "file" | "layout-reference" | "texture-reference" | "animation-reference" | "class-reference" | "instance-reference" | "behaviour-reference" | "layer-reference" | "*-reference-array" | "hidden" | "inherited",
    "value": "...",
    "order": 100,         // Optional: Display order in editor
    "rootProperty": true, // Optional: Flags if this is a primary property
    "meta": {             // Optional: Metadata object
      "custom": true,     // Optional: Boolean flag for custom properties
      "options": {        // Optional: Enum options dictionary
        "key": "value"
      }
    },
    "comments": "..."     // Optional: Comments string
  }
}
```

**Common Config Properties (Class/Instance):**
- `name`: Human-readable name (String).
- `width`, `height`: Dimensions (Integer).
- `x`, `y`: Position coordinates (Integer/Float).
- `z`: Z-index/Depth (Integer).
- `image`: Reference to a texture ID (texture-reference).
- `flipX`, `flipY`: Horizontal/Vertical flip state (Boolean).

**Special Config Property:**
- `startLayout`: Reference to the initial layout ID (layout-reference).

---

## Definitions

### Texture

Defines an image asset used in the game.

```json
{
  "id": "string",
  "type": "texture",
  "inherit": null,
  "childCount": 0,
  "streamed": true,
  "config": {
    "name": { "type": "string", "value": "filename.png" },
    "md5": { "type": "string", "value": "hash_of_file" }
  }
}
```

### BehaviourDefinition

Defines a reusable logic component that can be attached to Classes, Layouts, Layers, or Instances.

```json
{
  "id": "string",
  "type": "behaviour",
  "inherit": "intrinsic:behaviour" | "parent_behaviour_id" | null,
  "childCount": 0,
  "streamed": true,
  "config": { ... } // Default properties for this behaviour
}
```

### ClassDefinition

Defines a template for game objects (e.g., Player, Wall, Item).

```json
{
  "id": "string",
  "type": "class",
  "inherit": "intrinsic:actor" | "intrinsic:backdrop" | "parent_class_id",
  "childCount": 2, // Sum of behaviours + animations
  "streamed": true,
  "config": { ... }, // Default properties (image, dimensions, etc.)
  "behaviours": [    // Logic attached to this class
    {
      "id": "string",
      "type": "behaviour",
      "inherit": "behaviour_definition_id",
      "childCount": 0,
      "streamed": true,
      "config": { ... } // Overrides for behaviour properties
    }
  ],
  "animations": [ ... ]
}
```

**Note on Inheritance:** The `inherit` field supports multiple inheritance by providing a comma-separated list of IDs (e.g., `"parent_id_1, parent_id_2"`). Intrinsic types (starting with `intrinsic:`) are filtered out during property resolution.


### Animation

Defines a sequence of frames.

```json
{
  "id": "string",
  "type": "animation",
  "inherit": "parent_animation_id" | null,
  "childCount": 2, // Number of frames
  "streamed": true,
  "config": {
    "name": { "type": "string", "value": "New Animation" },
    "fps": { "type": "integer", "value": "60" }
  },
  "frames": [ ... ]
}
```

### Frame

A single frame within an animation.

```json
{
  "id": "string",
  "type": "frame",
  "inherit": null,
  "childCount": 0,
  "streamed": true,
  "config": {
    "name": { "type": "string", "value": "New Frame" },
    "image": { "type": "texture-reference", "value": "" },
    "length": { "type": "integer", "value": "1" },
    "order": { "type": "float", "value": "0" }
  }
}
```

---

## Layout Structure (Levels)

### Layout

Represents a single scene or level.

```json
{
  "id": "string",
  "type": "layout",
  "inherit": null,
  "childCount": 1, // Number of layers (+ behaviours if any)
  "streamed": true,
  "config": { ... }, // width, height, background color, etc.
  "layers": [ ... ],
  "behaviours": [ ... ]
}
```

### Layer

A container for instances within a layout, allowing for grouping and depth sorting.

```json
{
  "id": "string",
  "type": "layer",
  "inherit": "intrinsic:layer" | null,
  "childCount": 21, // Number of instances (+ behaviours if any)
  "streamed": true,
  "config": {
    "name": { "type": "string", "value": "Main Layer" },
    "z": { "type": "integer", "value": "0" }
  },
  "instances": [ ... ],
  "behaviours": [ ... ]
}
```

### Instance

A concrete occurrence of a Class within a Layout.

```json
{
  "id": "string",
  "type": "instance",
  "inherit": "class_definition_id", // The template this instance is based on
  "childCount": 0, // Number of behaviours (if any)
  "streamed": true,
  "config": {
    "x": { "type": "integer", "value": "100" },
    "y": { "type": "integer", "value": "200" }
    // Other properties here override the Class definition
  },
  "behaviours": [ ... ], // Instance-specific behaviour overrides
  "animations": [ ... ] // Instance-specific animation overrides (rarely used)
}
```

**Behaviour Overrides:** To override a behaviour defined in the parent Class, add a behaviour entry to the Instance where the `inherit` property matches the `id` of the specific behaviour entry in the Class definition (not the global behaviour definition ID).


## Data Types

The `type` field in `ConfigObject` values determines how the `value` string should be interpreted and edited:

- **string**: Plain text (single line).
- **text**: Multiline text.
- **localised**: Text key for localization.
- **integer**: Whole number.
- **float**: Decimal number.
- **boolean**: `true` / `false` or `1` / `0`.
- **enum**: One of a set of predefined values (options defined in `meta.options`).
- **json**: A JSON string.
- **file**: Reference to a file (often used for texture hashes).
- **texture-reference**: The ID string of a Texture.
- **layout-reference**: The ID string of a Layout.
- **class-reference**: The ID string of a Class.
- **instance-reference**: The ID string of an Instance.
- **behaviour-reference**: The ID string of a Behaviour.
- **animation-reference**: The ID string of an Animation.
- **layer-reference**: The ID string of a Layer.
- **\*-reference-array**: A comma-separated list of IDs for the corresponding reference type (e.g., `instance-reference-array`).
- **hidden**: Internal metadata, usually ignored by game logic.
- **inherited**: Indicates the value is inherited from the parent class or behaviour.
