class MemoryCacheManager {
  /**
   * Create a new memory cache instance.
   */
  constructor(server) {
    this.server = server;
    /**
     * The cache storage as in-memory.
     */
    this.memory = {
      //
    };
    setInterval(() => {
      for (let [key, { ttlSeconds, setTime }] of Object.entries(this.memory)) {
        let currentTime = parseInt(new Date().getTime() / 1000);
        if (ttlSeconds > 0 && setTime + ttlSeconds <= currentTime) {
          delete this.memory[key];
        }
      }
    }, 1000);
  }
  /**
   * Check if the given key exists in cache.
   */
  has(key) {
    return Promise.resolve(
      typeof this.memory[key] !== "undefined"
        ? Boolean(this.memory[key])
        : false
    );
  }
  /**
   * Get a key from the cache.
   * Returns false-returning value if cache does not exist.
   */
  get(key) {
    return Promise.resolve(
      typeof this.memory[key] !== "undefined" ? this.memory[key].value : null
    );
  }
  /**
   * Set or overwrite the value in the cache.
   */
  set(key, value, ttlSeconds = -1) {
    this.memory[key] = {
      value,
      ttlSeconds,
      setTime: parseInt(new Date().getTime() / 1000),
    };
    return Promise.resolve(true);
  }
  /**
   * Disconnect the manager's made connections.
   */
  disconnect() {
    this.memory = {};
    return Promise.resolve();
  }
}

module.exports = { MemoryCacheManager };
