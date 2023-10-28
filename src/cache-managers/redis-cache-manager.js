const Redis = require("ioredis");
const Cluster = Redis.Cluster;

class RedisCacheManager {
  /**
   * Create a new Redis cache instance.
   */
  constructor(server) {
    this.server = server;
    let redisOptions = {
      ...server.options.database.redis,
      ...server.options.cache.redis.redisOptions,
    };
    this.redisConnection = server.options.cache.redis.clusterMode
      ? new Cluster(server.options.database.redis.clusterNodes, {
          scaleReads: "slave",
          ...redisOptions,
        })
      : new Redis(redisOptions);
  }
  /**
   * Check if the given key exists in cache.
   */
  has(key) {
    return this.get(key).then((result) => {
      return result ? true : false;
    });
  }
  /**
   * Get a key from the cache.
   * Returns false-returning value if cache does not exist.
   */
  get(key) {
    return this.redisConnection.get(key);
  }
  /**
   * Set or overwrite the value in the cache.
   */
  set(key, value, ttlSeconds = -1) {
    return ttlSeconds > 0
      ? this.redisConnection.set(key, value, "EX", ttlSeconds)
      : this.redisConnection.set(key, value);
  }
  /**
   * Disconnect the manager's made connections.
   */
  disconnect() {
    return this.redisConnection.quit().then(() => {
      //
    });
  }
}

module.exports = { RedisCacheManager };
