const { RateLimiterClusterMasterPM2 } = require("rate-limiter-flexible");
const { LocalRateLimiter } = require("./local-rate-limiter");

const cluster = require("cluster");
const pm2 = require("pm2");

class ClusterRateLimiter extends LocalRateLimiter {
  /**
   * Initialize the local rate limiter driver.
   */
  constructor(server) {
    super(server);
    this.server = server;
    if (cluster.isPrimary || typeof cluster.isPrimary === "undefined") {
      if (server.pm2) {
        // With PM2, discovery is not needed.
        new RateLimiterClusterMasterPM2(pm2);
      } else {
        // When a new master is demoted, the rate limiters it has become the pivot points of the real, synced
        // rate limiter instances. Just trust this value.
        server.discover.join("rate_limiter:limiters", (rateLimiters) => {
          this.rateLimiters = Object.fromEntries(
            Object.entries(rateLimiters).map(([key, rateLimiterObject]) => {
              return [
                key,
                this.createNewRateLimiter(
                  key.split(":")[0],
                  rateLimiterObject._points
                ),
              ];
            })
          );
        });
        // All nodes need to know when other nodes consumed from the rate limiter.
        server.discover.join(
          "rate_limiter:consume",
          ({ app, eventKey, points, maxPoints }) => {
            super.consume(app, eventKey, points, maxPoints);
          }
        );
        server.discover.on("added", () => {
          if (server.nodes.get("self").isMaster) {
            // When a new node is added, just send the rate limiters this master instance has.
            // This value is the true value of the rate limiters.
            this.sendRateLimiters();
          }
        });
      }
    }
  }
  /**
   * Consume points for a given key, then
   * return a response object with headers and the success indicator.
   */
  consume(app, eventKey, points, maxPoints) {
    return super.consume(app, eventKey, points, maxPoints).then((response) => {
      if (response.canContinue) {
        this.server.discover.send("rate_limiter:consume", {
          app,
          eventKey,
          points,
          maxPoints,
        });
      }
      return response;
    });
  }
  /**
   * Clear the rate limiter or active connections.
   */
  disconnect() {
    return super.disconnect().then(() => {
      // If the current instance is the master and the server is closing,
      // demote and send the rate limiter of the current instance to the new master.
      if (this.server.nodes.get("self").isMaster) {
        this.server.discover.demote();
        this.server.discover.send("rate_limiter:limiters", this.rateLimiters);
      }
    });
  }
  /**
   * Send the stored rate limiters this instance currently have.
   */
  sendRateLimiters() {
    this.server.discover.send("rate_limiter:limiters", this.rateLimiters);
  }
}

module.exports = { ClusterRateLimiter };
