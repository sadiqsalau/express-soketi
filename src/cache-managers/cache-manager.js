const { Log } = require("../log");
const { MemoryCacheManager } = require("./memory-cache-manager");
const { RedisCacheManager } = require("./redis-cache-manager");

class CacheManager {
  /**
   * Create a new cache instance.
   */
  constructor(server) {
    this.server = server;
    if (server.options.cache.driver === "memory") {
      this.driver = new MemoryCacheManager(server);
    } else if (server.options.cache.driver === "redis") {
      this.driver = new RedisCacheManager(server);
    } else {
      Log.error("Cache driver not set.");
    }
  }
  /**
   * Check if the given key exists in cache.
   */
  has(key) {
    return this.driver.has(key);
  }
  /**
   * Check if the given key exists in cache.
   * Returns false-returning value if cache does not exist.
   */
  get(key) {
    return this.driver.get(key);
  }
  /**
   * Set or overwrite the value in the cache.
   */
  set(key, value, ttlSeconds) {
    return this.driver.set(key, value, ttlSeconds);
  }
  /**
   * Disconnect the manager's made connections.
   */
  disconnect() {
    return this.driver.disconnect();
  }
}

module.exports = { CacheManager };
