# Sprint 1 Implementation Results
## Web-based Editor for reveal.js Slides

# Sprint Goal

Sprint 1 focused on implementing the Minimum Viable Product (MVP) of the web-based reveal.js presentation editor. The primary goal of this sprint was to establish the core editor workflow and demonstrate the main system behavior required for creating and editing presentations inside a browser-based environment.

After the specification review, the project architecture was adjusted based on professor feedback. Initially, the system included a backend-oriented architecture using Spring Boot services. However, since the project was classified as a browser-based application, the application logic was moved to the frontend. As a result, Sprint 1 focused on browser-side state management, presentation manipulation, preview synchronization, and local persistence behavior inside the React application.

The sprint concentrated on implementing the editor environment, the structured slideset data model, slide manipulation workflow, placeholder-based editing, live presentation preview using reveal.js, reveal.js-compatible HTML export generation, and local saving and restoring of presentation data inside the browser.

---

# Project Initialization and Architecture

During Sprint 1, the frontend project was initialized using React and Vite. The project structure was organized into editor components, presentation models, utilities, preview logic, export logic, and browser-side core state management.

The system follows a browser-based event-driven architecture in which user interactions update the internal presentation state directly inside the frontend application. Editor actions such as slide creation, text updates, drag-and-drop movement, resizing, and formatting changes automatically update the synchronized slideset structure.

Even though backend structures were initially prepared during the early phase of the project, the final Sprint 1 implementation relies mainly on frontend-side application logic and browser storage.

---

# Initial Editor Workflow

At the current stage, the application opens directly inside the editor page when the project starts. The system immediately provides a working presentation editing environment without requiring additional navigation or authentication steps.

The editor already allows users to manipulate slides directly after startup. Users can create new slides, delete slides, duplicate slides, reorder slides, select slides, preview the presentation, export the presentation, reset the editor state, and modify slide content interactively.

The implemented workflow already demonstrates the core MVP interaction cycle:

```text
User Interaction → State Update → Editor Synchronization → Preview Update → Export
```

---

# Structured Slideset Data Model

A major part of Sprint 1 was the migration from a simple editor structure toward a structured JSON-based slideset model.

The system now uses a hierarchical presentation structure consisting of:

- presentation/slideset data
- slides
- layouts
- placeholders
- text content structures

This structure acts as the central internal application contract and allows the editor, preview, persistence system, and export functionality to work with the same synchronized presentation data.

Several parts of the sprint focused on refactoring the editor state and slide operations to use the new presentation JSON structure consistently.

---

# Slide Management Functionality

Sprint 1 successfully implemented the core slide management workflow required for the MVP.

The editor currently supports:

- creating slides
- deleting slides
- duplicating slides
- selecting slides
- changing slide order dynamically

The selected slide is synchronized with the editor workspace, and changes are reflected directly in the current presentation state.

The system also includes controls for changing the order of the currently selected slide. This allows users to manipulate presentation structure interactively inside the editor without manually editing JSON data.

Slide thumbnails were implemented and improved during the sprint so that users can visually navigate between slides more easily.

---

# Placeholder-Based Editing and Interaction

The editor uses placeholder-based editing, where users interact directly with editable slide elements inside the canvas.

Placeholders can currently be:

- selected
- moved
- resized
- visually manipulated inside the editor

The editor supports drag-and-drop interaction and resizing behavior for text elements. When the user manipulates a placeholder, the element coordinates and dimensions are updated inside the presentation state.

Selection behavior was also implemented so that active elements can be visually highlighted and modified independently.

This functionality establishes the core interaction model for the future editor system.

---

# Text Editing and Formatting

Sprint 1 implemented direct text editing inside slide placeholders.

Users can modify text content interactively, and the updates are synchronized with the presentation state, thumbnails, preview, and export structures.

Basic text formatting support was also implemented. At the current stage, the editor supports:

- normal text
- bold text
- predefined font sizes of 24px and 32px

The formatting system is intentionally limited in Sprint 1 because the focus of the MVP was establishing the editing workflow rather than implementing complete typography customization.

Advanced formatting features such as arbitrary font sizes, font family selection, text alignment, spacing controls, italic formatting, and color customization are planned for later development stages.

---

# Preview and Export Integration

One of the main technical tasks during Sprint 1 was the implementation of the reveal.js-based preview and export workflow. The goal of this functionality was to connect the internal slideset state of the editor with a dynamically rendered presentation preview and downloadable HTML presentation output.

The project includes reveal.js integration, preview modal implementation, synchronized preview rendering, export functionality, and generation of an HTML presentation structure compatible with reveal.js.

The preview system uses the current slideset state and dynamically renders the presentation using reveal.js. When the user edits text, changes slide order, or modifies placeholder positions, the preview updates according to the current editor state.

Sprint 1 also included the implementation of reveal.js-compatible HTML export functionality. The system transforms the internal presentation structure into executable HTML presentation output that can be downloaded and opened directly in the browser.

Several stabilization improvements were required during implementation. Most of the work focused on improving synchronization between the editor canvas, slide thumbnails, reveal.js preview, and exported presentation. The text content is synchronized correctly across all views, but minor differences in text positioning still exist due to scaling and rendering differences between the editor and reveal.js environment.

---

# Browser-Side Persistence

Sprint 1 implemented local browser-side persistence using browser storage and JSON-based presentation data.

At the current stage, presentations can be saved locally and loaded again inside the editor. The saving process is currently manual and allows users to repeatedly save updated versions of the presentation during editing.

The persistence system supports structured JSON serialization, loading of saved presentation data, and validation of the presentation structure. Autosave functionality has not yet been implemented and remains part of future development work.

---

# Current Technical Limitations

Although Sprint 1 successfully established the MVP foundation, several limitations still exist in the current implementation.

The largest remaining issue is visual consistency between:

- the editor canvas
- slide thumbnails
- reveal.js preview
- exported presentation rendering

The text content itself is synchronized correctly across all views. However, the exact positioning of text elements is not yet pixel-perfect between the editor, thumbnails, and preview/export output. The positioning differences are relatively small, but they are visible during rendering.

At the current stage, this issue is most likely caused by differences in:

- screen scaling
- container dimensions
- reveal.js rendering behavior
- coordinate scaling between views

Another limitation is that image functionality is not yet fully operational. The current MVP mainly supports text-based slide editing.

Text formatting is also intentionally limited. Only predefined font sizes (24px and 32px) and normal/bold styles are currently supported.

Autosave functionality is also not yet implemented.

These limitations are known and documented, and they define the main priorities for the next sprint.

---

# Sprint 1 Result

By the end of Sprint 1, the project provides a functional browser-based MVP for editing reveal.js presentations.

Users can:

- create and manipulate slides
- reorder slides
- duplicate and delete slides
- edit placeholder-based text content
- move and resize text elements
- apply basic formatting
- preview the presentation using reveal.js
- export the presentation
- save and restore presentation data locally

Sprint 1 successfully establishes the core editor architecture, synchronized presentation state, reveal.js integration, and browser-based editing workflow that will serve as the foundation for future system extensions.