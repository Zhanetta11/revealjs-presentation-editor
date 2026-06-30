# Electron Documentation

This directory contains documentation for the Electron desktop application integration.

## Contents

- **[SETUP.md](SETUP.md)** — Installation, configuration, and build instructions
- **[DEVELOPER.md](DEVELOPER.md)** — Development guide, architecture, and common tasks

## Quick Links

### For Users
- [Building installers](SETUP.md#building-for-production)
- [Troubleshooting](SETUP.md#troubleshooting)
- [Configuration](SETUP.md#configuration-system)

### For Developers
- [Development workflow](DEVELOPER.md#development-workflow)
- [Architecture overview](DEVELOPER.md#architecture-overview)
- [Adding features](DEVELOPER.md#adding-features)
- [Performance tips](DEVELOPER.md#performance-optimization)
- [Debugging guide](DEVELOPER.md#debugging)

## Quick Start

**Development:**
```bash
npm run dev:electron
```

**Build:**
```bash
npm run build:electron      # All platforms
npm run build:win           # Windows
npm run build:mac           # macOS
npm run build:linux         # Linux
```

## File Structure

```
frontend/
├── doc/
│   └── electron/           # This directory
│       ├── README.md       # Index
│       ├── SETUP.md        # Setup & build guide
│       └── DEVELOPER.md    # Developer guide
├── electron/
│   ├── main.cjs            # Main process
│   ├── preload.cjs         # Security bridge
│   ├── config.cjs          # Configuration
│   ├── logger.cjs          # Logging
│   ├── devtools.cjs        # Dev utilities
│   ├── performance.cjs     # Performance monitoring
│   └── entitlements.plist  # macOS signing
├── src/                    # React application
└── package.json
```

## API Reference

See [SETUP.md](SETUP.md#available-ipc-apis) for full IPC API documentation.

## Support

For issues or questions:
1. Check [Troubleshooting](SETUP.md#troubleshooting) section
2. Review logs in `userData/logs/`
3. Check [DEVELOPER.md](DEVELOPER.md) for debugging tips