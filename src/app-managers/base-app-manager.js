class BaseAppManager {
  /**
   * Find an app by given ID.
   */
  findById(id) {
    return Promise.resolve(null);
  }
  /**
   * Find an app by given key.
   */
  findByKey(key) {
    return Promise.resolve(null);
  }
  /**
   * Get the app secret by ID.
   */
  getAppSecret(id) {
    return this.findById(id).then((app) => {
      return app ? app.secret : null;
    });
  }
}

module.exports = { BaseAppManager };
