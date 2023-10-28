const Redis = require("ioredis");
const Cluster = Redis.Cluster;
const { RateLimiterRedis } = require("rate-limiter-flexible");
const { LocalRateLimiter } = require("./local-rate-limiter");

class RedisRateLimiter extends LocalRateLimiter {
  /**
   * Initialize the Redis rate limiter driver.
   */
  constructor(server) {
    super(server);
    this.server = server;
    let redisOptions = {
      ...server.options.database.redis,
      ...server.options.rateLimiter.redis.redisOptions,
    };
    this.redisConnection = server.options.rateLimiter.redis.clusterMode
      ? new Cluster(server.options.database.redis.clusterNodes, {
          scaleReads: "slave",
          ...redisOptions,
        })
      : new Redis(redisOptions);
  }
  /**
   * Initialize a new rate limiter for the given app and event key.
   */
  initializeRateLimiter(appId, eventKey, maxPoints) {
    return Promise.resolve(
      new RateLimiterRedis({
        points: maxPoints,
        duration: 1,
        storeClient: this.redisConnection,
        keyPrefix: `app:${appId}`,
        // TODO: Insurance limiter?
        // insuranceLimiter: super.createNewRateLimiter(appId, maxPoints),
      })
    );
  }
  /**
   * Clear the rate limiter or active connections.
   */
  disconnect() {
    return this.redisConnection.quit().then(() => {
      //
    });
  }
}

module.exports = { RedisRateLimiter };
