module.exports = {
  appId: 'com.presentationapp.frontend',
  productName: 'Presentation App',
  copyright: 'Copyright © 2026 Presentation App',

  directories: {
    buildResources: 'public/icons',
    output: 'dist/app',
  },

  files: [
    'dist/**/*',
    'electron/**/*',
    'node_modules/**/*',
    'package.json',
  ],

  extraMetadata: {
    main: 'electron/main.cjs',
  },

  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'ia32'],
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
      {
        target: 'msi',
        arch: ['x64'],
      },
    ],
    icon: 'public/icons/icon.ico',
    ...(process.env.WIN_CSC_LINK ? { certificateFile: process.env.WIN_CSC_LINK } : {}),
    ...(process.env.WIN_CSC_KEY_PASSWORD
      ? { certificatePassword: process.env.WIN_CSC_KEY_PASSWORD }
      : {}),
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Presentation App',
    installerIcon: 'public/icons/icon.ico',
    uninstallerIcon: 'public/icons/icon.ico',
    installerHeaderIcon: 'public/icons/icon.ico',
  },

  mac: {
    target: [
      'dmg',
      'zip',
      'tar.gz',
    ],
    icon: 'public/icons/icon.icns',
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'electron/entitlements.plist',
    entitlementsInherit: 'electron/entitlements.plist',
  },

  dmg: {
    sign: false,
    background: null,
    window: {
      x: 120,
      y: 120,
      width: 500,
      height: 350,
    },
    contents: [
      {
        x: 130,
        y: 170,
        type: 'file',
      },
      {
        x: 370,
        y: 170,
        type: 'link',
        path: '/Applications',
      },
    ],
  },

  linux: {
    target: [
      'AppImage',
      'deb',
      'rpm',
      'tar.gz',
    ],
    icon: 'public/icons/icon.png',
    category: 'Office',
  },

  appImage: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },

  deb: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
    depends: [
      'gconf2',
      'gconf-service',
      'libnotify4',
      'libappindicator1',
      'libindicator7',
      'xdg-utils',
      'desktop-file-utils',
    ],
  },

  rpm: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },

  ...(process.env.BUILD_VERSION ? { buildVersion: process.env.BUILD_VERSION } : {}),
};
