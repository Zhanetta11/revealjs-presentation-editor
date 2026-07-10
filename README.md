# Web-Based Reveal.js Presentation Editor

Local-first presentation editor for creating and editing Reveal.js slide decks in the browser and in an Electron desktop app.

The project provides a PowerPoint-like editing workflow: users can create slides, edit text and media elements, work with layouts and Slide Master placeholders, preview the deck with Reveal.js, save projects locally, and export presentations.

## Project Context

This repository contains the final implementation of a web-based presentation editor. The main application code is located in `frontend/`.

The same React editor runs in two environments:

- Browser mode, using IndexedDB and the File System Access API where supported.
- Electron mode, using native dialogs and filesystem access through Electron IPC.

Reveal.js is used as the presentation runtime for preview and export. The editing canvas itself is a custom React interface.

## Main Features

- Slide creation, deletion, duplication, reordering, and hiding.
- Text, shape, media, table, layout, and Slide Master editing.
- Text formatting, paragraph/list formatting, hyperlinks, and formatting inheritance.
- Undo/redo based on immutable presentation-state history.
- Autosave for draft-backed and project-folder-backed presentations.
- Browser draft storage through IndexedDB.
- Browser project-folder saving through the File System Access API.
- Electron project-folder saving through native filesystem dialogs.
- Reveal.js preview and export.
- ZIP/single-file export paths with portable media/font references.
- Unit, integration, and component test coverage.

## Tech Stack

- React 19
- Vite 8
- JavaScript
- Reveal.js 6
- Electron 43
- Electron Store
- IndexedDB / File System Access API
- Vitest
- React Testing Library
- ESLint

## How to Run

Open a terminal in the project root and enter the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run the browser development version:

```bash
npm run dev
```

Open the application:

```text
http://localhost:5173
```

Run the Electron development version:

```bash
npm run dev:electron
```

## Verification

Run all automated tests:

```bash
npm test -- --run
```

Run linting:

```bash
npm run lint
```

Build the production browser bundle:

```bash
npm run build
```

Current verification status:

```text
Vitest: 61 test files passed, 564 tests passed
ESLint: passed
Production build: passed
```

The production build may show a Vite chunk-size warning. This warning does not fail the build.

## Electron Build

Build the Electron package:

```bash
npm run build:electron
```

Platform-specific builds:

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

Electron-specific documentation is available in:

```text
frontend/docs/electron/README.md
frontend/docs/electron/SETUP.md
frontend/docs/electron/DEVELOPER.md
```

## Project Structure

```text
revealjs-presentation-editor/
  README.md
  docs/
    sprint1_results.md
  frontend/
    README.md
    package.json
    package-lock.json
    index.html
    vite.config.js
    vitest.config.js
    eslint.config.js
    electron-builder.config.cjs
    public/
    electron/
    docs/
    src/
```

Important frontend areas:

- `frontend/src/components/` - React UI, editor canvas, dialogs, toolbars, panels, and views.
- `frontend/src/hooks/editor/` - editor controllers and composition logic.
- `frontend/src/core/events/` - editor events and event bus.
- `frontend/src/core/store/editorStore.js` - reducer, history, undo/redo updates.
- `frontend/src/core/operations/` - domain operations for slides, text, media, layouts, master slides, z-order, and fonts.
- `frontend/src/core/persistence/` - draft/project storage, autosave, serialization, and project-folder persistence.
- `frontend/src/core/render/` - rendering helpers used by the editor canvas and preview.
- `frontend/src/core/export/` - Reveal.js export and download logic.
- `frontend/electron/` - Electron main/preload process, native dialogs, filesystem IPC, logging, and configuration.

## Architecture Overview

The editor follows an event-driven local-first architecture.

Typical flow:

```text
UI interaction
  -> editor hook/controller
  -> editor event
  -> event bus
  -> reducer
  -> updated presentation state
  -> autosave / persistence / export
```

The presentation model is the source of truth for saving, autosave, undo/redo, preview, and export. React components render and edit that model but do not directly write project files.

## Persistence Model

The editor separates unsaved drafts from saved project folders.

Before the first explicit save:

```text
active source = draft
```

After saving to a project folder:

```text
active source = project folder
```

Project folders use a portable structure:

```text
Project Name/
  presentation.json
  media/
    image/
    video/
  fonts/
```

Media and fonts are stored separately from the JSON and referenced through relative project paths.

## Team Responsibilities

| Team member | Responsibility area | Main tasks |
|---|---|---|
| Altynai Munduzbaeva | Editor interaction and UI | Slide editing, placeholder content editing, slide add/delete/duplicate actions, text/media elements, drag-and-drop, resizing, positioning, slide list, context menus, dialogs, toolbar shell, canvas UI, UI tests, user guide. |
| Nargiza Alieva | Data model and core architecture | Presentation, slide, placeholder, and layout model; editor events; reducer/store; state operations; master layout inheritance; propagation of layout changes; persistence; serialization; validation; internal project structure; orchestration hooks; unit tests; architecture documentation and UML. |
| Zhanetta Tynymbekova | Rendering, behavior, export, and deployment | Reveal.js preview rendering, Reveal.js export pipeline, theme and master color palette system, transitions, animations, picture effects, visual rendering settings, global settings panel, Electron/web deployment integration, integration tests, setup and deployment documentation. |

## Submission Notes

- Main application code is in `frontend/`.
- Do not include `frontend/node_modules/` in a submitted archive; it is recreated with `npm install`.
- Do not include generated build output such as `frontend/dist/`; it is recreated with `npm run build`.
- `docs/sprint1_results.md` is a historical Sprint 1 report, not the current full feature list.
- The current feature list and verification commands are documented in this root README and in `frontend/README.md`.
