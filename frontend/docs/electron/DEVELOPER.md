# Developer Guide

## Setup

```bash
npm install
npm run dev:electron
```

## Architecture Overview

### Process Architecture
- **Main Process** (Node.js) — `electron/main.cjs`
  - Window management
  - File system access
  - Native dialogs
  - IPC message handlers

- **Renderer Process** (React/Chromium) — `src/`
  - User interface
  - Application logic
  - Calls Main Process via IPC

### Security Model
- **Context Isolation** — Renderer cannot access Node.js directly
- **Preload Script** — `electron/preload.cjs` bridges Main ↔ Renderer safely
- **IPC Only** — All communication via explicitly defined IPC handlers

## Development Workflow

### Hot Reload
- **React changes** → Auto reload via Vite
- **Electron changes** → Manual reload with `Cmd/Ctrl + R`
- **For code changes to main.cjs** → Restart app

### Debugging

**Frontend (React):**
- DevTools auto-opens in dev mode
- Toggle with `Cmd/Ctrl + Shift + I`
- Set breakpoints and inspect elements

**Backend (Electron):**
- Check logs in `userData/logs/app-YYYY-MM-DD.log`
- Enable debug messages with `logger.debug()`
- Use `logger.info()` for important events

### View Logs

**In Development:**
- Console output appears in terminal
- Files saved to: `~/AppData/Roaming/Presentation App/logs/` (Windows)
- Or: `~/Library/Application Support/Presentation App/logs/` (macOS)
- Or: `~/.config/Presentation App/logs/` (Linux)

**In React:**
```javascript
const logsDir = await window.electronAPI.getLogsDir()
console.log('Logs at:', logsDir)
```

## File Structure

```
electron/
├── main.cjs              # Main process entry point
├── preload.cjs           # IPC bridge (security)
├── config.cjs            # Configuration management
├── logger.cjs            # Logging system
├── devtools.cjs          # Development utilities
├── performance.cjs       # Performance monitoring
└── entitlements.plist    # macOS signing

src/
├── components/           # React components
├── App.jsx              # Root component
└── main.jsx             # React entry point

public/
├── icons/               # App icons
│   ├── icon.svg        # Source
│   ├── icon.png        # Linux
│   ├── icon.ico        # Windows
│   └── icon.icns       # macOS
└── favicon.svg
```

## Adding Features

### File Operation (Open/Save)

**In React Component:**
```javascript
// Open file
const [filePath] = await window.electronAPI.openFile()
if (filePath) {
  const content = await window.electronAPI.readFile(filePath)
  // Process file...
}

// Save file
const path = await window.electronAPI.saveFile('document.json')
if (path) {
  await window.electronAPI.writeFile(path, jsonContent)
}
```

### Listen to Menu Events

**In React Component:**
```javascript
useEffect(() => {
  window.electronAPI.onMenuNew(() => {
    // Handle New
  })
  
  window.electronAPI.onMenuOpen(async () => {
    // Handle Open
  })
  
  window.electronAPI.onMenuSave(() => {
    // Handle Save
  })
}, [])
```

### Handle File Drop

```javascript
useEffect(() => {
  window.electronAPI.onFileDrop((filePath) => {
    console.log('File dropped:', filePath)
    // Handle dropped file
  })
}, [])
```

### Add Configuration Setting

**In React:**
```javascript
// Get setting
const theme = await window.electronAPI.getConfig('theme')

// Update setting (persisted to disk)
await window.electronAPI.setConfig('theme', 'dark')
```

**Default Settings** in `electron/config.cjs`:
```javascript
{
  theme: 'light',
  language: 'en',
  autoSave: true,
  autoSaveInterval: 60000,
  recentFiles: []
}
```

## Performance Optimization

### Monitoring

**Check Performance:**
```javascript
const devtools = require('./electron/devtools.cjs')
devtools.markStart('operation-name')
// ... do work ...
devtools.markEnd('operation-name')
```

**Memory Usage:**
```javascript
const { memoryMonitor } = require('./electron/performance.cjs')
memoryMonitor.snapshot('checkpoint-label')
const report = memoryMonitor.getReport()
console.log(report)
```

### Best Practices

1. **Use React.memo** for expensive renders
2. **Lazy load components** with React.lazy()
3. **Code split** at route boundaries
4. **Minimize IPC calls** — batch operations
5. **Cache file reads** — don't re-read same file
6. **Monitor memory** — watch for leaks in dev mode

## Testing

```bash
npm run test              # Run tests
npm run lint             # Lint code
npm run build            # Build app
npm run dev:electron     # Run with dev tools
```

## Building & Distribution

### Development Build
```bash
npm run build:electron
# Creates installers in dist/app/
```

### Production Build
```bash
# Windows
npm run build:win

# macOS (requires code signing)
export CSC_LINK="cert.p12"
export CSC_KEY_PASSWORD="password"
npm run build:mac

# Linux
npm run build:linux
```

## Troubleshooting

### "Module not found" errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install`
- Restart dev server

### Changes not reflecting
- React changes → auto-reload (Vite)
- Electron changes → manual reload (`Cmd/Ctrl + R`)
- Config changes → restart app

### Performance issues
1. Check logs: `userData/logs/app-YYYY-MM-DD.log`
2. Enable debug logging in code
3. Use DevTools React profiler
4. Check memory growth with `memoryMonitor`

### File operations failing
- Use absolute file paths
- Files must come from dialog or drop
- Check file permissions
- Log the error: `logger.error('operation', { error: err.message })`

## Common Tasks

### Log something
```javascript
const logger = require('./electron/logger.cjs')

logger.info('Operation successful', { data: value })
logger.warn('Unexpected condition', { value })
logger.error('Operation failed', { error: message })
logger.debug('Detailed info')  // dev mode only
```

### Read/Write JSON
```javascript
const filePath = await window.electronAPI.saveFile('data.json')
const content = JSON.stringify(data, null, 2)
await window.electronAPI.writeFile(filePath, content)
```

### Handle errors
```javascript
try {
  const content = await window.electronAPI.readFile(path)
  return JSON.parse(content)
} catch (error) {
  await window.electronAPI.showError('Error', `Failed to read: ${error.message}`)
  logger.error('Read failed', { path, error: error.message })
}
```

## Environment Variables

- `NODE_ENV=development` — Auto-set in dev mode
- `WIN_CSC_LINK` — Windows code signing certificate
- `CSC_LINK` — macOS code signing certificate

## Resources

- [Electron Docs](https://www.electronjs.org/docs)
- [electron-builder](https://www.electron.build/)
- [IPC Communication](https://www.electronjs.org/docs/latest/api/ipc-main)
- [Context Isolation](https://www.electronjs.org/docs/tutorial/context-isolation)

---