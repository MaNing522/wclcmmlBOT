const fs = require('fs');
const path = require('path');
const config = require('./config');

const LOG_DIR = config.logging.directory || 'logs';
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function getLogFile() {
  const d = new Date();
  const f = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.log`;
  return path.join(LOG_DIR, f);
}

function write(level, msg) {
  if (!config.logging.enabled) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  fs.appendFileSync(getLogFile(), line, 'utf8');
}

const logger = {
  log: (msg) => { console.log(msg); write('info', msg); },
  errorLog: (msg) => { console.error(msg); write('error', msg); },
  warn: (msg) => { console.warn(msg); write('warn', msg); }
};
module.exports = logger;