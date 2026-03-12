/**
 * 로깅 모듈
 * core/logger.py 이식
 */
const fs = require('fs');
const path = require('path');

class Logger {
  constructor(config) {
    this.config = config;
    this.logDir = null;
    this.logFile = null;

    const logDir = config.getLogDir();
    if (logDir) {
      try {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        this.logDir = logDir;
        const today = new Date().toISOString().slice(0, 10);
        this.logFile = path.join(logDir, `scs3_${today}.log`);
      } catch (e) {
        // 파일 로깅 비활성화, 콘솔만
      }
    }
  }

  _formatMessage(level, message) {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return `${now} - ${level} - ${message}`;
  }

  _write(level, message) {
    const formatted = this._formatMessage(level, message);
    console.log(formatted);
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, formatted + '\n');
      } catch (e) { /* ignore */ }
    }
  }

  info(msg) { this._write('INFO', msg); }
  debug(msg) { this._write('DEBUG', msg); }
  warning(msg) { this._write('WARNING', msg); }
  error(msg) { this._write('ERROR', msg); }
  critical(msg) { this._write('CRITICAL', msg); }
}

module.exports = { Logger };
