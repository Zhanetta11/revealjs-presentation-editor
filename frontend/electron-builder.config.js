module.exports = {
  appId: 'com.presentationapp.frontend',
  productName: 'Presentation App',

  directories: {
    buildResources: 'public/icons',
    output: 'dist',
  },

  files: [
    'dist/**/*',
    'electron/**/*',
    'node_modules/**/*',
    'package.json',
  ],

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
    ],
    icon: 'public/icons/icon.ico',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },

  mac: {
    target: [
      'dmg',
      'zip',
    ],
    icon: 'public/icons/icon.icns',
    category: 'public.app-category.productivity',
  },

  dmg: {
    sign: false,
  },

  linux: {
    target: [
      'AppImage',
      'deb',
    ],
    icon: 'public/icons/icon.png',
    category: 'Office',
  },
};