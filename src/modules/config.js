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
    this.logger = null;
  }

  setLogger(logger) {
    this.logger = logger;
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
        if (this.logger) this.logger.debug(`[Config:load] 설정 파일 없음: ${this.configFile}`);
        this._cache = null;
        return null;
      }
      const data = fs.readFileSync(this.configFile, 'utf-8');
      this._cache = JSON.parse(data);
      if (this.logger) this.logger.debug(`[Config:load] 설정 로드 완료: ${this.configFile}`);
      return this._cache;
    } catch (e) {
      if (this.logger) this.logger.error(`[Config:load] 실패: ${e.message}`);
      this._cache = null;
      return null;
    }
  }

  save(configData) {
    try {
      this._ensureDir();
      fs.writeFileSync(this.configFile, JSON.stringify(configData, null, 2), 'utf-8');
      this._cache = configData;
      if (this.logger) this.logger.debug(`[Config:save] 설정 저장 완료: ${this.configFile}`);
      return true;
    } catch (e) {
      if (this.logger) this.logger.error(`[Config:save] 실패: ${e.message}`);
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
    if (this.logger) this.logger.debug(`[Config:saveBasePath] basePath=${basePath}`);
    const config = this.load() || {};
    config.base_path = basePath;
    return this.save(config);
  }

  getSkippedVersion() {
    const config = this.load();
    return config ? (config.skipped_update_version || null) : null;
  }

  setSkippedVersion(version) {
    if (this.logger) this.logger.debug(`[Config:setSkippedVersion] version=${version}`);
    const config = this.load() || {};
    config.skipped_update_version = version;
    return this.save(config);
  }

  getLogDir() {
    const basePath = this.getBasePath();
    if (!basePath) return null;
    return path.join(basePath, 'logs');
  }
}

module.exports = { ConfigManager };
