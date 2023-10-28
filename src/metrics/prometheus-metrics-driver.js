const prom = require("prom-client");
const { Utils } = require("../utils");

class PrometheusMetricsDriver {
  /**
   * Initialize the Prometheus exporter.
   */
  constructor(server) {
    this.server = server;
    /**
     * The list of metrics that will register.
     *
     * @type {PrometheusMetrics}
     */
    this.metrics = {
      // TODO: Metrics for subscribes/unsubscribes/client events?
    };
    /**
     * The infra-related metadata.
     *
     * @type {InfraMetadata}
     */
    this.infraMetadata = {
      //
    };
    this.register = new prom.Registry();
    this.registerMetrics();
    this.infraMetadata = {
      port: server.options.port,
    };
    prom.collectDefaultMetrics({
      prefix: server.options.metrics.prometheus.prefix,
      register: this.register,
      labels: this.infraMetadata,
    });
  }
  /**
   * Handle a new connection.
   */
  markNewConnection(ws) {
    this.metrics.connectedSockets.inc(this.getTags(ws.app.id));
    this.metrics.newConnectionsTotal.inc(this.getTags(ws.app.id));
  }
  /**
   * Handle a disconnection.
   */
  markDisconnection(ws) {
    this.metrics.connectedSockets.dec(this.getTags(ws.app.id));
    this.metrics.newDisconnectionsTotal.inc(this.getTags(ws.app.id));
  }
  /**
   * Handle a new API message event being received and sent out.
   */
  markApiMessage(appId, incomingMessage, sentMessage) {
    this.metrics.httpBytesReceived.inc(
      this.getTags(appId),
      Utils.dataToBytes(incomingMessage)
    );
    this.metrics.httpBytesTransmitted.inc(
      this.getTags(appId),
      Utils.dataToBytes(sentMessage)
    );
    this.metrics.httpCallsReceived.inc(this.getTags(appId));
  }
  /**
   * Handle a new WS client message event being sent.
   */
  markWsMessageSent(appId, sentMessage) {
    this.metrics.socketBytesTransmitted.inc(
      this.getTags(appId),
      Utils.dataToBytes(sentMessage)
    );
    this.metrics.wsMessagesSent.inc(this.getTags(appId), 1);
  }
  /**
   * Handle a new WS client message being received.
   */
  markWsMessageReceived(appId, message) {
    this.metrics.socketBytesReceived.inc(
      this.getTags(appId),
      Utils.dataToBytes(message)
    );
    this.metrics.wsMessagesReceived.inc(this.getTags(appId), 1);
  }
  /**
   * Track the time in which horizontal adapter resolves requests from other nodes.
   */
  trackHorizontalAdapterResolveTime(appId, time) {
    this.metrics.horizontalAdapterResolveTime.observe(
      this.getTags(appId),
      time
    );
  }
  /**
   * Track the fulfillings in which horizontal adapter resolves requests from other nodes.
   */
  trackHorizontalAdapterResolvedPromises(appId, resolved = true) {
    if (resolved) {
      this.metrics.horizontalAdapterResolvedPromises.inc(this.getTags(appId));
    } else {
      this.metrics.horizontalAdapterUncompletePromises.inc(this.getTags(appId));
    }
  }
  /**
   * Handle a new horizontal adapter request sent.
   */
  markHorizontalAdapterRequestSent(appId) {
    this.metrics.horizontalAdapterSentRequests.inc(this.getTags(appId));
  }
  /**
   * Handle a new horizontal adapter request that was marked as received.
   */
  markHorizontalAdapterRequestReceived(appId) {
    this.metrics.horizontalAdapterReceivedRequests.inc(this.getTags(appId));
  }
  /**
   * Handle a new horizontal adapter response from other node.
   */
  markHorizontalAdapterResponseReceived(appId) {
    this.metrics.horizontalAdapterReceivedResponses.inc(this.getTags(appId));
  }
  /**
   * Get the stored metrics as plain text, if possible.
   */
  getMetricsAsPlaintext() {
    return this.register.metrics();
  }
  /**
   * Get the stored metrics as JSON.
   */
  getMetricsAsJson() {
    return this.register.getMetricsAsJSON();
  }
  /**
   * Reset the metrics at the server level.
   */
  clear() {
    return Promise.resolve(this.register.clear());
  }
  /**
   * Get the tags for Prometheus.
   */
  getTags(appId) {
    return {
      app_id: appId,
      ...this.infraMetadata,
    };
  }
  registerMetrics() {
    let prefix = this.server.options.metrics.prometheus.prefix;
    this.metrics = {
      connectedSockets: new prom.Gauge({
        name: `${prefix}connected`,
        help: "The number of currently connected sockets.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      newConnectionsTotal: new prom.Counter({
        name: `${prefix}new_connections_total`,
        help: "Total amount of soketi connection requests.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      newDisconnectionsTotal: new prom.Counter({
        name: `${prefix}new_disconnections_total`,
        help: "Total amount of soketi disconnections.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      socketBytesReceived: new prom.Counter({
        name: `${prefix}socket_received_bytes`,
        help: "Total amount of bytes that soketi received.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      socketBytesTransmitted: new prom.Counter({
        name: `${prefix}socket_transmitted_bytes`,
        help: "Total amount of bytes that soketi transmitted.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      wsMessagesReceived: new prom.Counter({
        name: `${prefix}ws_messages_received_total`,
        help: "The total amount of WS messages received from connections by the server.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      wsMessagesSent: new prom.Counter({
        name: `${prefix}ws_messages_sent_total`,
        help: "The total amount of WS messages sent to the connections from the server.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      httpBytesReceived: new prom.Counter({
        name: `${prefix}http_received_bytes`,
        help: "Total amount of bytes that soketi's REST API received.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      httpBytesTransmitted: new prom.Counter({
        name: `${prefix}http_transmitted_bytes`,
        help: "Total amount of bytes that soketi's REST API sent back.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      httpCallsReceived: new prom.Counter({
        name: `${prefix}http_calls_received_total`,
        help: "Total amount of received REST API calls.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      horizontalAdapterResolveTime: new prom.Histogram({
        name: `${prefix}horizontal_adapter_resolve_time`,
        help: "The average resolve time for requests to other nodes.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      horizontalAdapterResolvedPromises: new prom.Counter({
        name: `${prefix}horizontal_adapter_resolved_promises`,
        help: "The total amount of promises that were fulfilled by other nodes.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      horizontalAdapterUncompletePromises: new prom.Counter({
        name: `${prefix}horizontal_adapter_uncomplete_promises`,
        help: "The total amount of promises that were not fulfilled entirely by other nodes.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      horizontalAdapterSentRequests: new prom.Counter({
        name: `${prefix}horizontal_adapter_sent_requests`,
        help: "The total amount of sent requests to other nodes.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      horizontalAdapterReceivedRequests: new prom.Counter({
        name: `${prefix}horizontal_adapter_received_requests`,
        help: "The total amount of received requests from other nodes.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
      horizontalAdapterReceivedResponses: new prom.Counter({
        name: `${prefix}horizontal_adapter_received_responses`,
        help: "The total amount of received responses from other nodes.",
        labelNames: ["app_id", "port"],
        registers: [this.register],
      }),
    };
  }
}

module.exports = { PrometheusMetricsDriver };
