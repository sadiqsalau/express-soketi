const { ClusterRateLimiter } = require("./cluster-rate-limiter");
const { LocalRateLimiter } = require("./local-rate-limiter");
const { Log } = require("./../log");
const { RedisRateLimiter } = require("./redis-rate-limiter");

class RateLimiter {
  /**
   * Initialize the rate limiter driver.
   */
  constructor(server) {
    if (server.options.rateLimiter.driver === "local") {
      this.driver = new LocalRateLimiter(server);
    } else if (server.options.rateLimiter.driver === "redis") {
      this.driver = new RedisRateLimiter(server);
    } else if (server.options.rateLimiter.driver === "cluster") {
      this.driver = new ClusterRateLimiter(server);
    } else {
      Log.error("No stats driver specified.");
    }
  }
  /**
   * Consume the points for backend-received events.
   */
  consumeBackendEventPoints(points, app, ws) {
    return this.driver.consumeBackendEventPoints(points, app, ws);
  }
  /**
   * Consume the points for frontend-received events.
   */
  consumeFrontendEventPoints(points, app, ws) {
    return this.driver.consumeFrontendEventPoints(points, app, ws);
  }
  /**
   * Consume the points for HTTP read requests.
   */
  consumeReadRequestsPoints(points, app, ws) {
    return this.driver.consumeReadRequestsPoints(points, app, ws);
  }
  /**
   * Create a new rate limiter instance.
   */
  createNewRateLimiter(appId, maxPoints) {
    return this.driver.createNewRateLimiter(appId, maxPoints);
  }
  /**
   * Clear the rate limiter or active connections.
   */
  disconnect() {
    return this.driver.disconnect();
  }
}

module.exports = { RateLimiter };
