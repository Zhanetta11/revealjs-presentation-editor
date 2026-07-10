# Web-Based Reveal.js Presentation Editor

Local-first presentation editor built with React, Vite, Reveal.js, and Electron.

The editor lets users create and edit slide decks with text, media, layouts, Slide Master placeholders, formatting, links, undo/redo, autosave, project-folder saving, and Reveal.js preview/export.

## What this project is

The application is local-first: the active presentation is edited in the browser/Electron renderer, stored locally, and saved/exported from the client side.

The same React editor runs in two environments:

- Browser mode, using IndexedDB and, where available, the File System Access API.
- Electron mode, using native dialogs and filesystem access through Electron IPC.

Reveal.js is used as the presentation runtime for preview/export. The editing canvas itself is custom React UI, not Reveal.js.

## Main features

- Slide editing with text, shapes, media, tables, layouts, and Slide Master support.
- Text formatting, paragraph/list formatting, links, placeholders, and formatting inheritance.
- PowerPoint-like draft/project saving model.
- Browser draft storage through IndexedDB.
- Browser project-folder saving through the File System Access API in Chromium-based browsers.
- Electron project-folder saving through native dialogs and filesystem IPC.
- Autosave that writes to the active source: draft cache before first Save, project folder after Save.
- Save / Save As with project-folder structure:

  ```text
  Project Name/
    presentation.json
    media/
      image/
      video/
    fonts/
  ```

- Portable media/font export: internal runtime links are resolved into `media/...` and `fonts/...` project paths.
- Undo/redo through immutable presentation-state history.
- Reveal.js preview and export, including ZIP/single-file export paths.
- Unit, integration, UI/component, and manual test coverage.

## Tech stack

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

## Development setup

Install dependencies:

```bash
npm install
```

Run browser development mode:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Run Electron development mode:

```bash
npm run dev:electron
```

Build browser production bundle:

```bash
npm run build
```

Build Electron package:

```bash
npm run build:electron
```

Platform-specific Electron builds:

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

## Verification commands

Run all tests:

```bash
npm test -- --run
```

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

Current verification status:

```text
Vitest: 61 files passed, 564 tests passed
ESLint: passed
Production build: passed
```

The production build may show a Vite chunk-size warning. That warning does not fail the build.

## Architecture overview

The editor uses an event-driven local-first architecture.

User actions start in React components and hooks. The UI does not directly mutate the presentation JSON as the final source of truth. Instead, user actions are converted into editor events, dispatched through the event bus, handled by the reducer, and committed into the presentation model.

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

The DOM is only the rendering of the model. The presentation model is the source of truth for save, autosave, undo/redo, preview, and export.

Important areas:

- `src/components/` - React UI, editor canvas, dialogs, toolbars, panels, views.
- `src/hooks/editor/` - editor controllers and composition logic.
- `src/core/events/` - editor event definitions and event bus.
- `src/core/store/editorStore.js` - reducer, history, undo/redo state updates.
- `src/core/operations/` - domain operations for slides, text, media, layouts, master, z-order, fonts.
- `src/core/persistence/` - draft/project storage, autosave, project-folder serialization.
- `src/core/render/` - render helpers used by canvas/preview.
- `src/core/export/` - Reveal.js export and download logic.
- `electron/` - Electron main/preload process code, native dialogs, filesystem IPC.

## Persistence model

The editor separates draft storage from saved project folders.

Before the first explicit Save:

```text
active source = draft
```

After successful Save:

```text
active source = project folder
```

Draft storage is used for unsaved work and recovery. Project-folder storage is the authoritative saved source after Save.

The source metadata model tracks whether a presentation is draft-backed or project-backed. Autosave reads this metadata and writes to the correct sink.

## Browser storage

Browser mode uses IndexedDB as the reliable baseline.

Draft presentations are stored through the IndexedDB adapter. In Chromium browsers, the File System Access API can additionally link a presentation to a real project folder selected by the user.

Browser project folder handles are stored in IndexedDB because the browser does not expose raw local paths for security reasons. If folder permission expires, the project should still be treated as a project source rather than silently becoming a draft.

## Electron storage

Electron mode uses the same React editor, but with desktop filesystem access through IPC.

The renderer process does not write files directly. It calls safe functions exposed from `electron/preload.cjs`, which send IPC messages to `electron/main.cjs`. The main process performs native dialog and filesystem operations.

Electron draft cache is stored in the app's user data area. Saved project folders are stored wherever the user chooses.

Electron also stores local metadata mapping:

```text
presentationId -> absolute project folder path
```

This mapping is local application metadata, not part of `presentation.json`, because absolute paths are machine-specific.

## Save and Save As

First Save from a draft:

1. Flush/commit the current presentation state.
2. Ask the user for a project folder.
3. Write assets and fonts.
4. Write `presentation.json` after assets are ready.
5. Store the source mapping.
6. Switch active source from draft to project.
7. Clean up the draft only after the project commit is safe.

Save on a project-backed presentation writes to the existing project folder without asking again.

Save As asks for a new project folder, writes the full snapshot there, and switches the active source only after the new folder commit succeeds. The old project is not overwritten during a failed or cancelled Save As.

## Media and fonts

Media and fonts are stored separately from the JSON.

In draft mode, media can live in app storage/cache. During project-folder save, internal runtime references are resolved and copied into portable project paths:

```text
media/image/...
media/video/...
fonts/...
```

The saved `presentation.json` references those relative paths instead of embedding large base64 data.

## Slide Master and inheritance

The editor follows a PowerPoint-like hierarchy:

```text
Master Slide -> Layouts -> Normal Slides
```

The Master Slide stores global design/defaults. Layouts define reusable slide structures and placeholders. Normal slides reference layouts and can inherit placeholder geometry and formatting.

Formatting is resolved through a cascade:

```text
master formatting
  -> placeholder/layout formatting
  -> paragraph formatting
  -> run formatting
```

Explicit local formatting wins over inherited formatting. For lists, explicit `list-type: "none"` blocks inherited bullet/list formatting.

## Undo and redo

Undo/redo is implemented in the editor store with immutable presentation-state history.

The history stores previous presentation states for content changes, not UI-only state like selection, dialogs, save status, or autosave status.

Because operations return new immutable state instead of mutating old state in place, undo can keep references to previous states without deep-cloning the entire presentation after every small edit.

## Testing

The project has automated coverage across:

- Unit tests for reducer, operations, serialization, persistence model, media geometry, text formatting.
- Integration tests for event bus -> reducer -> state -> persistence/export flows.
- UI/component tests with React Testing Library.
- Manual checks for native Electron dialogs, real browser permission prompts, and visual/user workflows.

Verified status:

```text
61 test files
564 tests
full suite passing
lint passing
production build passing
```

## Notes for contributors

- Do not write directly to files from React UI components.
- Keep persistence logic inside `src/core/persistence/` or Electron IPC modules.
- Keep professor/shared JSON schema compatibility: do not rename or remove existing schema fields.
- Prefer optional backward-compatible fields if extension is needed.
- Keep browser mode working when changing Electron persistence.
- Keep Electron filesystem access behind preload/main IPC.
- Do not treat project-folder save as a simple JSON download; media and fonts must stay portable.
- Add regression tests for confirmed bugs before or together with the fix.


