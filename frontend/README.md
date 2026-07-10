# Frontend Application

This directory contains the React, Vite, and Electron implementation of the Web-Based Reveal.js Presentation Editor.

For the main project overview, feature list, grading context, and high-level architecture, see [../README.md](../README.md).

## Purpose

The frontend application provides the actual presentation editor:

- React editor UI and canvas.
- Reveal.js preview and export.
- Browser persistence through IndexedDB and the File System Access API.
- Electron desktop integration through preload/main IPC.
- Autosave, project-folder persistence, undo/redo, media handling, and Slide Master workflows.

## Available Scripts

Install dependencies:

```bash
npm install
```

Run the browser development server:

```bash
npm run dev
```

Run the Electron development app:

```bash
npm run dev:electron
```

Run automated tests:

```bash
npm test -- --run
```

Run linting:

```bash
npm run lint
```

Build the browser production bundle:

```bash
npm run build
```

Build the Electron package:

```bash
npm run build:electron
```

Platform-specific Electron builds:

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

## Structure

- `src/components/` - React UI, editor canvas, dialogs, panels, toolbars, and views.
- `src/hooks/` - editor hooks and controller composition.
- `src/core/` - presentation model operations, events, store, persistence, rendering, and export.
- `src/core/events/` - editor event definitions and event bus.
- `src/core/store/` - reducer, state history, undo, and redo.
- `src/core/persistence/` - IndexedDB storage, project folders, autosave, serialization, and media rehydration.
- `src/core/export/` - Reveal.js export and download logic.
- `electron/` - Electron main process, preload bridge, native dialogs, filesystem IPC, logging, and configuration.
- `public/` - static assets, service worker, and application icons.
- `docs/electron/` - Electron-specific setup and developer documentation.

## Browser Mode

Browser mode stores drafts in IndexedDB. In supported Chromium-based browsers, the editor can also save full project folders through the File System Access API.

## Electron Mode

Electron mode runs the same React editor with native desktop dialogs and filesystem access through Electron IPC.

More details:

- [docs/electron/README.md](docs/electron/README.md)
- [docs/electron/SETUP.md](docs/electron/SETUP.md)
- [docs/electron/DEVELOPER.md](docs/electron/DEVELOPER.md)

## Verification

Recommended checks before submission:

```bash
npm test -- --run
npm run lint
npm run build
```

Current verification status:

```text
61 test files passed
564 tests passed
ESLint passed
Production build passed
```

The production build may show a Vite chunk-size warning. This warning does not fail the build.

## Generated Files

Do not commit or include these generated folders in the submitted archive:

- `node_modules/`
- `dist/`
- `dist/app/`
- `out/`
- `electron-builder/`
