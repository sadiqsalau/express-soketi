const { SqlAppManager } = require("./sql-app-manager");
class MysqlAppManager extends SqlAppManager {
  /**
   * Get the client name to be used by Knex.
   */
  knexClientName() {
    return this.server.options.appManager.mysql.useMysql2 ? "mysql2" : "mysql";
  }
  /**
   * Get the object connection details for Knex.
   */
  knexConnectionDetails() {
    return {
      ...this.server.options.database.mysql,
    };
  }
  /**
   * Get the connection version for Knex.
   * For MySQL can be 5.7 or 8.0, etc.
   */
  knexVersion() {
    return this.server.options.appManager.mysql.version;
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
    return this.server.options.appManager.mysql.table;
  }
}

module.exports = { MysqlAppManager };
