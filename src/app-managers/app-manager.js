const { App } = require("./../app");
const { ArrayAppManager } = require("./array-app-manager");
const { DynamoDbAppManager } = require("./dynamodb-app-manager");
const { Log } = require("../log");
const { MysqlAppManager } = require("./mysql-app-manager");
const { PostgresAppManager } = require("./postgres-app-manager");
/**
 * Class that controls the key/value data store.
 */
class AppManager {
  /**
   * Create a new database instance.
   */
  constructor(server) {
    this.server = server;
    if (server.options.appManager.driver === "array") {
      this.driver = new ArrayAppManager(server);
    } else if (server.options.appManager.driver === "mysql") {
      this.driver = new MysqlAppManager(server);
    } else if (server.options.appManager.driver === "postgres") {
      this.driver = new PostgresAppManager(server);
    } else if (server.options.appManager.driver === "dynamodb") {
      this.driver = new DynamoDbAppManager(server);
    } else {
      Log.error("Clients driver not set.");
    }
  }
  /**
   * Find an app by given ID.
   */
  findById(id) {
    if (!this.server.options.appManager.cache.enabled) {
      return this.driver.findById(id);
    }
    return this.server.cacheManager.get(`app:${id}`).then((appFromCache) => {
      if (appFromCache) {
        return new App(JSON.parse(appFromCache), this.server);
      }
      return this.driver.findById(id).then((app) => {
        this.server.cacheManager.set(
          `app:${id}`,
          app ? app.toJson() : app,
          this.server.options.appManager.cache.ttl
        );
        return app;
      });
    });
  }
  /**
   * Find an app by given key.
   */
  findByKey(key) {
    if (!this.server.options.appManager.cache.enabled) {
      return this.driver.findByKey(key);
    }
    return this.server.cacheManager.get(`app:${key}`).then((appFromCache) => {
      if (appFromCache) {
        return new App(JSON.parse(appFromCache), this.server);
      }
      return this.driver.findByKey(key).then((app) => {
        this.server.cacheManager.set(
          `app:${key}`,
          app ? app.toJson() : app,
          this.server.options.appManager.cache.ttl
        );
        return app;
      });
    });
  }
  /**
   * Get the app secret by ID.
   */
  getAppSecret(id) {
    return this.driver.getAppSecret(id);
  }
}

module.exports = { AppManager };
