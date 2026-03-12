/**
 * 설정 관리 (DB app_settings 테이블)
 * core/settings_manager.py 이식
 */

class SettingsManager {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  get(key, defaultValue = null) {
    try {
      const row = this.db._queryOne(`SELECT value FROM app_settings WHERE key = ?`, [key]);
      if (!row) return defaultValue;
      return this._convertType(row.value);
    } catch (e) {
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      const strValue = String(value);
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      this.db._run(`UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?`, [strValue, now, key]);
      // 레코드가 없으면 INSERT
      const check = this.db._queryOne(`SELECT id FROM app_settings WHERE key = ?`, [key]);
      if (!check) {
        this.db._run(`INSERT INTO app_settings (key, value, category, description) VALUES (?, ?, 'custom', '사용자 설정')`, [key, strValue]);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  getAll() {
    try {
      const rows = this.db._queryAll(`SELECT key, value FROM app_settings`);
      const result = {};
      for (const row of rows) {
        result[row.key] = this._convertType(row.value);
      }
      return result;
    } catch (e) {
      return {};
    }
  }

  getBool(key, defaultValue = false) {
    const val = this.get(key, defaultValue);
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') return ['1', 'true', 'yes', 'on'].includes(val.toLowerCase());
    return defaultValue;
  }

  getInt(key, defaultValue = 0) {
    const val = this.get(key, defaultValue);
    const num = parseInt(val);
    return isNaN(num) ? defaultValue : num;
  }

  getFloat(key, defaultValue = 0.0) {
    const val = this.get(key, defaultValue);
    const num = parseFloat(val);
    return isNaN(num) ? defaultValue : num;
  }

  _convertType(value) {
    if (value === null || value === undefined) return null;
    const lower = String(value).toLowerCase();
    if (['0', 'false', 'no', 'off'].includes(lower)) return false;
    if (['1', 'true', 'yes', 'on'].includes(lower)) return true;
    if (!String(value).includes('.')) {
      const intVal = parseInt(value);
      if (!isNaN(intVal) && String(intVal) === String(value)) return intVal;
    }
    const floatVal = parseFloat(value);
    if (!isNaN(floatVal) && String(floatVal) === String(value)) return floatVal;
    return value;
  }
}

module.exports = { SettingsManager };
