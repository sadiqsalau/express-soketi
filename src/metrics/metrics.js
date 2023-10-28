const { Log } = require("./../log");
const { PrometheusMetricsDriver } = require("./prometheus-metrics-driver");

class Metrics {
  /**
   * Initialize the Prometheus exporter.
   */
  constructor(server) {
    this.server = server;
    if (server.options.metrics.driver === "prometheus") {
      this.driver = new PrometheusMetricsDriver(server);
    } else {
      Log.error("No metrics driver specified.");
    }
  }
  /**
   * Handle a new connection.
   */
  markNewConnection(ws) {
    if (this.server.options.metrics.enabled) {
      this.driver.markNewConnection(ws);
    }
  }
  /**
   * Handle a disconnection.
   */
  markDisconnection(ws) {
    if (this.server.options.metrics.enabled) {
      this.driver.markDisconnection(ws);
    }
  }
  /**
   * Handle a new API message event being received and sent out.
   */
  markApiMessage(appId, incomingMessage, sentMessage) {
    if (this.server.options.metrics.enabled) {
      this.driver.markApiMessage(appId, incomingMessage, sentMessage);
    }
  }
  /**
   * Handle a new WS client message event being sent.
   */
  markWsMessageSent(appId, sentMessage) {
    if (this.server.options.metrics.enabled) {
      this.driver.markWsMessageSent(appId, sentMessage);
    }
  }
  /**
   * Handle a new WS client message being received.
   */
  markWsMessageReceived(appId, message) {
    if (this.server.options.metrics.enabled) {
      this.driver.markWsMessageReceived(appId, message);
    }
  }
  /**
   * Track the time in which horizontal adapter resolves requests from other nodes.
   */
  trackHorizontalAdapterResolveTime(appId, time) {
    this.driver.trackHorizontalAdapterResolveTime(appId, time);
  }
  /**
   * Track the fulfillings in which horizontal adapter resolves requests from other nodes.
   */
  trackHorizontalAdapterResolvedPromises(appId, resolved = true) {
    this.driver.trackHorizontalAdapterResolvedPromises(appId, resolved);
  }
  /**
   * Handle a new horizontal adapter request sent.
   */
  markHorizontalAdapterRequestSent(appId) {
    this.driver.markHorizontalAdapterRequestSent(appId);
  }
  /**
   * Handle a new horizontal adapter request that was marked as received.
   */
  markHorizontalAdapterRequestReceived(appId) {
    this.driver.markHorizontalAdapterRequestReceived(appId);
  }
  /**
   * Handle a new horizontal adapter response from other node.
   */
  markHorizontalAdapterResponseReceived(appId) {
    this.driver.markHorizontalAdapterResponseReceived(appId);
  }
  /**
   * Get the stored metrics as plain text, if possible.
   */
  getMetricsAsPlaintext() {
    if (!this.server.options.metrics.enabled) {
      return Promise.resolve("");
    }
    return this.driver.getMetricsAsPlaintext();
  }
  /**
   * Get the stored metrics as JSON.
   */
  getMetricsAsJson() {
    if (!this.server.options.metrics.enabled) {
      return Promise.resolve();
    }
    return this.driver.getMetricsAsJson();
  }
  /**
   * Reset the metrics at the server level.
   */
  clear() {
    return this.driver.clear();
  }
}

module.exports = { Metrics };
