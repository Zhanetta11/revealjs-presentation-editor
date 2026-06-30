const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const logsDir = path.join(app.getPath('userData'), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const getLogFile = () => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `app-${date}.log`);
};

const formatLog = (level, message, data) => {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
};

const writeLog = (level, message, data) => {
  const logEntry = formatLog(level, message, data);
  const logFile = getLogFile();

  try {
    fs.appendFileSync(logFile, logEntry, 'utf-8');
  } catch (err) {
    console.error('Failed to write log:', err);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(logEntry.trim());
  }
};

module.exports = {
  info: (message, data) => {
    console.log(`[INFO] ${message}`, data || '');
    writeLog('INFO', message, data);
  },

  warn: (message, data) => {
    console.warn(`[WARN] ${message}`, data || '');
    writeLog('WARN', message, data);
  },

  error: (message, data) => {
    console.error(`[ERROR] ${message}`, data || '');
    writeLog('ERROR', message, data);
  },

  debug: (message, data) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, data || '');
      writeLog('DEBUG', message, data);
    }
  },

  getLogsDir: () => logsDir,
};