const { knex } = require("knex");
const { App } = require("./../app");
const { BaseAppManager } = require("./base-app-manager");
const { Log } = require("../log");

class SqlAppManager extends BaseAppManager {
  /**
   * Create a new app manager instance.
   */
  constructor(server) {
    super();
    this.server = server;
    let knexConfig = {
      client: this.knexClientName(),
      connection: this.knexConnectionDetails(),
      version: this.knexVersion(),
    };
    if (this.supportsPooling() && server.options.databasePooling.enabled) {
      knexConfig = {
        ...knexConfig,
        ...{
          pool: {
            min: server.options.databasePooling.min,
            max: server.options.databasePooling.max,
          },
        },
      };
    }
    this.connection = knex(knexConfig);
  }
  /**
   * Find an app by given ID.
   */
  findById(id) {
    return this.selectById(id).then((apps) => {
      if (apps.length === 0) {
        if (this.server.options.debug) {
          Log.error(`App ID not found: ${id}`);
        }
        return null;
      }
      return new App(apps[0] || apps, this.server);
    });
  }
  /**
   * Find an app by given key.
   */
  findByKey(key) {
    return this.selectByKey(key).then((apps) => {
      if (apps.length === 0) {
        if (this.server.options.debug) {
          Log.error(`App key not found: ${key}`);
        }
        return null;
      }
      return new App(apps[0] || apps, this.server);
    });
  }
  /**
   * Make a Knex selection for the app ID.
   */
  selectById(id) {
    return this.connection(this.appsTableName()).where("id", id).select("*");
  }
  /**
   * Make a Knex selection for the app key.
   */
  selectByKey(key) {
    return this.connection(this.appsTableName()).where("key", key).select("*");
  }
}

module.exports = { SqlAppManager };
