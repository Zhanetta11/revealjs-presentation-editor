# Electron Setup & Build Guide

## Quick Start

### Development
```bash
npm run dev:electron
```
Runs Vite dev server + Electron with hot reload.

### Build
```bash
npm run build:electron      # All platforms
npm run build:win           # Windows only
npm run build:mac           # macOS only
npm run build:linux         # Linux only
```

Installers will be created in `dist/app/`.

## Icons

Icons are already generated in `public/icons/`:
- `icon.png` — Linux (1024x1024)
- `icon.ico` — Windows (16-256px multi-size)
- `icon.icns` — macOS (placeholder, replace before production)

**For production ICNS:**
1. Upload `icon.png` to https://cloudconvert.com/png-to-icns
2. Download ICNS file
3. Replace `public/icons/icon.icns`

## Project Structure

```
frontend/
├── electron/
│   ├── main.cjs              # Main process (Node.js)
│   ├── preload.cjs           # Security bridge
│   └── entitlements.plist    # macOS code signing
├── public/icons/
│   ├── icon.png              # Linux AppImage
│   ├── icon.ico              # Windows NSIS/MSI/Portable
│   ├── icon.icns             # macOS DMG
│   └── icon.svg              # Source vector
├── src/                       # React application
├── electron-builder.config.js # Build configuration
├── package.json              # Scripts and dependencies
└── ELECTRON_SETUP.md         # This file
```

## Configuration Files

### electron-builder.config.js
- **Windows**: NSIS installer, Portable exe, MSI
- **macOS**: DMG with hardened runtime and code signing
- **Linux**: AppImage, DEB, RPM, TAR.GZ packages

### electron/main.cjs
- Window state persistence (position, size, maximized)
- Native OS file dialogs (open/save)
- Application menu with keyboard shortcuts
- Drag & drop file handling
- IPC message handlers for React communication
- Error handling and crash recovery

### electron/preload.cjs
- Security isolation (contextIsolation: true)
- Exposes safe IPC API to React via `window.electronAPI`
- No direct Node.js access from renderer

### electron/entitlements.plist
- macOS code signing entitlements
- JIT and unsigned executable memory allowed (required for Chromium)
- User-selected file read/write access
- Microphone and camera disabled

## Available IPC APIs

From React, use `window.electronAPI`:

```javascript
const filePaths = await electronAPI.openFile()
const savePath = await electronAPI.saveFile('filename.json')
const content = await electronAPI.readFile(filePath)
await electronAPI.writeFile(filePath, jsonContent)

await electronAPI.showError('Error Title', 'Error message')
await electronAPI.showMessage('Info Title', 'Info message')

electronAPI.onMenuNew(callback)
electronAPI.onMenuOpen(callback)
electronAPI.onMenuSave(callback)
electronAPI.onMenuSaveAs(callback)

electronAPI.onFileDrop((filePath) => {
  
})

const appPath = await electronAPI.getAppPath()
const version = await electronAPI.getVersion()

const theme = await electronAPI.getConfig('theme')
await electronAPI.setConfig('theme', 'dark')
await electronAPI.setConfig('autoSave', true)

const logsDir = await electronAPI.getLogsDir()
```

## Configuration System

Application settings are automatically persisted to `userData/config.json`:

```javascript
// Available settings
{
  theme: 'light',              // 'light' or 'dark'
  language: 'en',
  autoSave: true,
  autoSaveInterval: 60000,     // milliseconds
  recentFiles: []              // array of file paths
}
```

## Logging System

All application events are logged to `userData/logs/app-YYYY-MM-DD.log`:

**Log Levels:**
- `INFO` — Important events (file operations, app lifecycle)
- `WARN` — Warning conditions
- `ERROR` — Error conditions with stack traces
- `DEBUG` — Detailed information (dev mode only)

**Example Log Entry:**
```
[2026-06-30T10:15:32.123Z] [INFO] File read successfully | {"path":"/path/to/file.json","size":1024}
```

Access logs from React:
```javascript
const logsDir = await window.electronAPI.getLogsDir()
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + N | New presentation |
| Cmd/Ctrl + O | Open file |
| Cmd/Ctrl + S | Save |
| Cmd/Ctrl + Shift + S | Save As |
| Cmd/Ctrl + Q | Quit application |
| Cmd/Ctrl + R | Reload app |
| Cmd/Ctrl + Shift + I | Toggle DevTools |
| F11 | Toggle fullscreen |

## Development Workflow

### Hot Reload
- **React**: Automatic via Vite
- **Electron**: Manual reload with Cmd/Ctrl + R

### DevTools
- Automatically opens in development mode
- Toggle with Cmd/Ctrl + Shift + I

### Testing Build
```bash
npm run build
npm run dev:electron
```

## Building for Production

### Windows
```bash
# Without code signing
npm run build:win

# With code signing (optional)
export WIN_CSC_LINK="path/to/certificate.pfx"
export WIN_CSC_KEY_PASSWORD="password"
npm run build:win
```

### macOS
```bash
# Without code signing
npm run build:mac

# With code signing
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="password"
npm run build:mac
```

### Linux
```bash
npm run build:linux
```

## Troubleshooting

**Error: Cannot find module 'electron'**
- Solution: Run `npm install`

**Error: icon.ico not found**
- Check all icon files exist in `public/icons/`
- Run `npm run build` first to generate dist folder

**App won't start on macOS**
- May require code signing for distribution
- Try building with signing certificate
- Check System Preferences > Security & Privacy

**Cannot read files from disk**
- Use absolute file paths
- Files must be selected via native dialog or dropped
- Check permissions in entitlements.plist

**Build fails with dependency error**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

## Integration with React

The React app can use `window.electronAPI` in any component:

```javascript
import { useEffect, useState } from 'react'

export function FileOpener() {
  const [content, setContent] = useState(null)

  const handleOpen = async () => {
    const [filePath] = await window.electronAPI.openFile()
    if (filePath) {
      const data = await window.electronAPI.readFile(filePath)
      setContent(data)
    }
  }

  return <button onClick={handleOpen}>Open File</button>
}
```

## References

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder](https://www.electron.build/)
- [IPC Main Process](https://www.electronjs.org/docs/latest/api/ipc-main)
- [Preload Scripts](https://www.electronjs.org/docs/latest/tutorial/tutorial-preload)

---

**Production Ready**: This setup follows Electron security best practices and is ready for distribution.