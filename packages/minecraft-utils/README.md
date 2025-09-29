# @starktma/minecraft-utils — utilities for Minecraft scripting

This package provides a small collection of TypeScript utilities. The code is split into focused modules; this README gives a short summary and points to the source files for details.

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