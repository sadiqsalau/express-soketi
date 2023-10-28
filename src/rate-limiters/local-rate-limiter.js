const { RateLimiterMemory } = require("rate-limiter-flexible");

class LocalRateLimiter {
  /**
   * Initialize the local rate limiter driver.
   */
  constructor(server) {
    this.server = server;
    /**
     * The list of rate limiters bound to each apps that interacts.
     */
    this.rateLimiters = {
      //
    };
    //
  }
  /**
   * Consume the points for backend-received events.
   */
  consumeBackendEventPoints(points, app, ws) {
    return this.consume(
      app,
      `${app.id}:backend:events`,
      points,
      app.maxBackendEventsPerSecond
    );
  }
  /**
   * Consume the points for frontend-received events.
   */
  consumeFrontendEventPoints(points, app, ws) {
    return this.consume(
      app,
      `${app.id}:frontend:events:${ws.id}`,
      points,
      app.maxClientEventsPerSecond
    );
  }
  /**
   * Consume the points for HTTP read requests.
   */
  consumeReadRequestsPoints(points, app, ws) {
    return this.consume(
      app,
      `${app.id}:backend:request_read`,
      points,
      app.maxReadRequestsPerSecond
    );
  }
  /**
   * Create a new rate limiter instance.
   */
  createNewRateLimiter(appId, maxPoints) {
    return new RateLimiterMemory({
      points: maxPoints,
      duration: 1,
      keyPrefix: `app:${appId}`,
    });
  }
  /**
   * Clear the rate limiter or active connections.
   */
  disconnect() {
    return Promise.resolve();
  }
  /**
   * Initialize a new rate limiter for the given app and event key.
   */
  initializeRateLimiter(appId, eventKey, maxPoints) {
    if (this.rateLimiters[`${appId}:${eventKey}`]) {
      return new Promise((resolve) => {
        this.rateLimiters[`${appId}:${eventKey}`].points = maxPoints;
        resolve(this.rateLimiters[`${appId}:${eventKey}`]);
      });
    }
    this.rateLimiters[`${appId}:${eventKey}`] = this.createNewRateLimiter(
      appId,
      maxPoints
    );
    return Promise.resolve(this.rateLimiters[`${appId}:${eventKey}`]);
  }
  /**
   * Consume points for a given key, then
   * return a response object with headers and the success indicator.
   */
  consume(app, eventKey, points, maxPoints) {
    if (maxPoints < 0) {
      return Promise.resolve({
        canContinue: true,
        rateLimiterRes: null,
        headers: {
          //
        },
      });
    }
    let calculateHeaders = (rateLimiterRes) => ({
      "Retry-After": rateLimiterRes.msBeforeNext / 1000,
      "X-RateLimit-Limit": maxPoints,
      "X-RateLimit-Remaining": rateLimiterRes.remainingPoints,
    });
    return this.initializeRateLimiter(app.id, eventKey, maxPoints).then(
      (rateLimiter) => {
        return rateLimiter
          .consume(eventKey, points)
          .then((rateLimiterRes) => {
            return {
              canContinue: true,
              rateLimiterRes,
              headers: calculateHeaders(rateLimiterRes),
            };
          })
          .catch((rateLimiterRes) => {
            return {
              canContinue: false,
              rateLimiterRes,
              headers: calculateHeaders(rateLimiterRes),
            };
          });
      }
    );
  }
}

module.exports = { LocalRateLimiter };
