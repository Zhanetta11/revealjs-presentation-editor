const isDev = require('electron-is-dev');
const logger = require('./logger.cjs');

let performanceMetrics = {
  appStartTime: Date.now(),
  events: [],
};

module.exports = {
  markStart: (label) => {
    if (!isDev) return;
    performanceMetrics[`${label}_start`] = performance.now();
  },

  markEnd: (label) => {
    if (!isDev) return;
    const startKey = `${label}_start`;
    if (performanceMetrics[startKey]) {
      const duration = performance.now() - performanceMetrics[startKey];
      performanceMetrics.events.push({ label, duration: `${duration.toFixed(2)}ms` });
      logger.debug(`Perf [${label}]: ${duration.toFixed(2)}ms`);
      delete performanceMetrics[startKey];
    }
  },

  getMetrics: () => {
    if (!isDev) return null;
    return {
      uptime: `${(Date.now() - performanceMetrics.appStartTime) / 1000}s`,
      events: performanceMetrics.events,
    };
  },

  getMemoryInfo: () => {
    if (!isDev) return null;
    const mem = process.memoryUsage();
    return {
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
    };
  },

  logEnvironmentInfo: () => {
    if (!isDev) return;
    logger.info('Environment Info', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      isDev: true,
    });
  },

  checkSetup: async (app) => {
    if (!isDev) return;
    logger.info('=== Development Setup Check ===');

    const checks = {
      nodeVersion: process.version,
      platform: process.platform,
      userDataPath: app.getPath('userData'),
      logsPath: `${app.getPath('userData')}/logs`,
    };

    Object.entries(checks).forEach(([key, value]) => {
      logger.info(`✓ ${key}:`, { value });
    });

    logger.info('=== Setup Check Complete ===');
  },
};