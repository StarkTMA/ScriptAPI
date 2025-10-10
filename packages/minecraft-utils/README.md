# @starktma/minecraft-utils — utilities for Minecraft scripting

This package provides a small collection of TypeScript utilities. The code is split into focused modules; this README gives a short summary and points to the source files for details.

## Configuration

### Setting a Custom Namespace

By default, this package uses the namespace `"starktma"` for internal identifiers, database keys, and event names. You can configure a custom namespace for your project to avoid conflicts with other add-ons.

**Important:** The namespace should be set once at the very beginning of your application, before any other package functionality is used.

```typescript
import { setNamespace } from "@starktma/minecraft-utils/config";

// Set your custom namespace early in your application
setNamespace("myproject");

// Now use other package features
import { StateMachine } from "@starktma/minecraft-utils/game-state-machine";
import { SimpleDatabase } from "@starktma/minecraft-utils/database";
```

The namespace affects:

- Database property keys (e.g., `"myproject:playerData"` instead of `"starktma:playerData"`)
- Game state machine event IDs (e.g., `"myproject:reset"` instead of `"starktma:reset"`)
- Branch identifiers in the state machine

### Configuration API

```typescript
import { setNamespace, getNamespace, resetNamespace } from "@starktma/minecraft-utils/config";

// Set a custom namespace
setNamespace("myproject");

// Get the current namespace
const currentNamespace = getNamespace(); // Returns "myproject"

// Reset to default (primarily for testing)
resetNamespace(); // Resets to "starktma"
```

## Quick summary

- **database** — lightweight JSON storage helpers for Minecraft's dynamic properties. Implements a `DatabaseManager` (low-level serialization/partitioning) and `SimpleDatabase` (convenience base class for storing objects by id). See `src/database` for full details and examples.
- **math** — common math utilities used across the packages. See `src/math`.
- **minecraft** — helpers for Minecraft-specific operations and types. See `src/minecraft`.
- **player-event** — convenience helpers to handle player-related events and payloads. See `src/player-event`.

## Short database note

The database utilities are intentionally small: `DatabaseManager` handles serializing/partitioning JSON so it can be stored within Minecraft dynamic property limits, and `SimpleDatabase` provides a straightforward API for storing objects keyed by `id`. For full API and examples, open `src/database`.

## Installation & quick dev

- **To use the published package**: `npm install @starktma/minecraft-utils` (if published to npm or a registry).

## Where to look next

- See the module source for exact types, exported functions, and examples:
  - `src/database` — database manager, simple database base class, and interfaces
  - `src/math` — math helpers
  - `src/minecraft` — Minecraft helpers
  - `src/player-event` — player event helpers

# StateMachine for Minecraft Add-on

## Overview

The StateMachine module is a comprehensive Minecraft system designed for dynamically managing game states, player interactions, and level progression within custom Minecraft maps and add-ons. It leverages the Minecraft scripting API to offer a robust framework for creating complex gameplay mechanics.

The StateMachine is still under development.

## Features

- **Branch Management:** Facilitates the creation and management of multiple game branches, each representing a unique pathway or storyline within the game world.
- **Level Progression:** Each branch can contain multiple levels, with a system to manage player progression through these levels.
- **Dynamic Player State Handling:** Tracks and updates player states based on their interactions and progress within the game.
- **Event-Driven Architecture:** Utilizes custom events for player actions like joining/leaving the server, respawning, or dying, and level-specific events such as level load, loop, and exit.

## Installation

1. Ensure you have the Minecraft server set up with the appropriate scripting API support.
2. Clone or download this repository.
3. Place the StateMachine module in your server's script directory or in the assets/javascript directory if you're using Anvil.

## Usage

First, configure your namespace (recommended):

```typescript
import { setNamespace } from "@starktma/minecraft-utils/config";

// Set your project's namespace before using other features
setNamespace("myproject");
```

Import the StateMachine at the beginning of your server script:

```typescript
import { stateMachine, mainBranch, mainLevel0 } from "@starktma/minecraft-utils/game-state-machine";
```

Use the provided methods to create and manage branches and levels, and to handle player states and events.

### Example

```typescript
// Configure namespace first
import { setNamespace } from "@starktma/minecraft-utils/config";
setNamespace("myproject");

// Import other functionality
import { stateMachine } from "@starktma/minecraft-utils/game-state-machine";

// Create a new branch
const myBranch = stateMachine.createBranch("myCustomBranch");

// Add levels to the branch
const level1 = myBranch.addLevel();
const level2 = myBranch.addLevel();

// Set up event listeners for player actions
level1.events.onPlayerJoinLevel((player) => {
	// Custom logic when a player joins level 1
});
```

## API Reference

Detailed documentation of classes, methods, and their usage can be found in the respective TypeScript files within the module.

- **StateMachine**: Core class for managing branches, levels, and player states.
- **Branch**: Class representing a game branch, capable of holding multiple levels.
- **Level**: Class for individual levels within a branch, with its own lifecycle and events.
- **PlayerDatabase & StateMachineDatabase**: Classes for managing persistent data related to players and game states.
