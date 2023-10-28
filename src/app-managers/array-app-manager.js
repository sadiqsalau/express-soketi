const { App } = require("../app");
const { BaseAppManager } = require("./base-app-manager");
const { Log } = require("../log");

class ArrayAppManager extends BaseAppManager {
  /**
   * Create a new app manager instance.
   */
  constructor(server) {
    super();
    this.server = server;
  }
  /**
   * Find an app by given ID.
   */
  findById(id) {
    return new Promise((resolve) => {
      let app = this.server.options.appManager.array.apps.find(
        (app) => app.id == id
      );
      if (typeof app !== "undefined") {
        resolve(new App(app, this.server));
      } else {
        if (this.server.options.debug) {
          Log.error(`App ID not found: ${id}`);
        }
        resolve(null);
      }
    });
  }
  /**
   * Find an app by given key.
   */
  findByKey(key) {
    return new Promise((resolve) => {
      let app = this.server.options.appManager.array.apps.find(
        (app) => app.key == key
      );
      if (typeof app !== "undefined") {
        resolve(new App(app, this.server));
      } else {
        if (this.server.options.debug) {
          Log.error(`App key not found: ${key}`);
        }
        resolve(null);
      }
    });
  }
}

module.exports = { ArrayAppManager };
