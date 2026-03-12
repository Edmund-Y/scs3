/**
 * AppData 설정 관리 (config.json)
 * utils/config_utils.py 이식
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ConfigManager {
  constructor() {
    this.appDataDir = path.join(app.getPath('appData'), '경로식당');
    this.configFile = path.join(this.appDataDir, 'config.json');
    this._cache = null;
  }

  _ensureDir() {
    if (!fs.existsSync(this.appDataDir)) {
      fs.mkdirSync(this.appDataDir, { recursive: true });
    }
  }

  load(forceReload = false) {
    if (this._cache && !forceReload) return this._cache;
    try {
      if (!fs.existsSync(this.configFile)) {
        this._cache = null;
        return null;
      }
      const data = fs.readFileSync(this.configFile, 'utf-8');
      this._cache = JSON.parse(data);
      return this._cache;
    } catch (e) {
      this._cache = null;
      return null;
    }
  }

  save(configData) {
    try {
      this._ensureDir();
      fs.writeFileSync(this.configFile, JSON.stringify(configData, null, 2), 'utf-8');
      this._cache = configData;
      return true;
    } catch (e) {
      return false;
    }
  }

  isFirstRun() {
    return !fs.existsSync(this.configFile);
  }

  getBasePath() {
    const config = this.load();
    return config ? config.base_path : null;
  }

  saveBasePath(basePath) {
    const config = this.load() || {};
    config.base_path = basePath;
    return this.save(config);
  }

  getLogDir() {
    const basePath = this.getBasePath();
    if (!basePath) return null;
    return path.join(basePath, 'logs');
  }
}

module.exports = { ConfigManager };
