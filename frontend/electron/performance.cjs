const isDev = require('electron-is-dev');
const logger = require('./logger.cjs');

class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = [];
  }

  measure(name, fn) {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.recordMeasure(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`Performance measure failed [${name}]`, {
        duration: `${duration.toFixed(2)}ms`,
        error: error.message,
      });
      throw error;
    }
  }

  async measureAsync(name, fn) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMeasure(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`Async performance measure failed [${name}]`, {
        duration: `${duration.toFixed(2)}ms`,
        error: error.message,
      });
      throw error;
    }
  }

  recordMeasure(name, duration) {
    this.measures.push({ name, duration: `${duration.toFixed(2)}ms`, timestamp: Date.now() });

    if (isDev && duration > 100) {
      logger.warn(`Slow operation [${name}]: ${duration.toFixed(2)}ms`);
    }
  }

  getReport() {
    const report = {
      totalMeasures: this.measures.length,
      slowOperations: this.measures.filter(m => parseFloat(m.duration) > 100),
      averageTime: this.getAverageTime(),
      lastMeasures: this.measures.slice(-10),
    };

    return report;
  }

  getAverageTime() {
    if (this.measures.length === 0) return 0;
    const sum = this.measures.reduce((acc, m) => acc + parseFloat(m.duration), 0);
    return `${(sum / this.measures.length).toFixed(2)}ms`;
  }

  clear() {
    this.measures = [];
  }
}

class MemoryMonitor {
  constructor() {
    this.snapshots = [];
    this.threshold = 50; // MB
  }

  snapshot(label) {
    if (!isDev) return;

    const mem = process.memoryUsage();
    const heapUsed = mem.heapUsed / 1024 / 1024;

    this.snapshots.push({
      label,
      heapUsed,
      timestamp: Date.now(),
    });

    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }

    if (this.snapshots.length > 2) {
      const lastTwo = this.snapshots.slice(-2);
      const growth = lastTwo[1].heapUsed - lastTwo[0].heapUsed;

      if (growth > this.threshold) {
        logger.warn('Memory growth detected', {
          growth: `${growth.toFixed(2)}MB`,
          before: `${lastTwo[0].heapUsed.toFixed(2)}MB`,
          after: `${lastTwo[1].heapUsed.toFixed(2)}MB`,
        });
      }
    }
  }

  getReport() {
    if (!isDev) return null;

    const current = process.memoryUsage();
    return {
      heapUsed: `${(current.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(current.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      rss: `${(current.rss / 1024 / 1024).toFixed(2)}MB`,
      external: `${(current.external / 1024 / 1024).toFixed(2)}MB`,
      snapshots: this.snapshots.slice(-5),
    };
  }
}

module.exports = {
  performanceMonitor: new PerformanceMonitor(),
  memoryMonitor: new MemoryMonitor(),
};