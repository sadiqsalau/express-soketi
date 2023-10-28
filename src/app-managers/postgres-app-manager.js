const { SqlAppManager } = require("./sql-app-manager");

class PostgresAppManager extends SqlAppManager {
  /**
   * Get the client name to be used by Knex.
   */
  knexClientName() {
    return "pg";
  }
  /**
   * Get the object connection details for Knex.
   */
  knexConnectionDetails() {
    return {
      ...this.server.options.database.postgres,
    };
  }
  /**
   * Get the connection version for Knex.
   * For MySQL can be 5.7 or 8.0, etc.
   */
  knexVersion() {
    return this.server.options.appManager.postgres.version;
  }
  /**
   * Wether the manager supports pooling. This introduces
   * additional settings for connection pooling.
   */
  supportsPooling() {
    return true;
  }
  /**
   * Get the table name where the apps are stored.
   */
  appsTableName() {
    return this.server.options.appManager.postgres.table;
  }
}

module.exports = { PostgresAppManager };
