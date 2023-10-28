const { HorizontalAdapter } = require("./horizontal-adapter");

class ClusterAdapter extends HorizontalAdapter {
  /**
   * Initialize the adapter.
   */
  constructor(server) {
    super(server);
    /**
     * The channel to broadcast the information.
     */
    this.channel = "cluster-adapter";
    this.channel = server.clusterPrefix(this.channel);
    this.requestChannel = `${this.channel}#comms#req`;
    this.responseChannel = `${this.channel}#comms#res`;
    this.requestsTimeout = server.options.adapter.cluster.requestsTimeout;
  }
  /**
   * Initialize the adapter.
   */
  async init() {
    this.server.discover.join(this.requestChannel, this.onRequest.bind(this));
    this.server.discover.join(this.responseChannel, this.onResponse.bind(this));
    this.server.discover.join(this.channel, this.onMessage.bind(this));
    return this;
  }
  /**
   * Listen for requests coming from other nodes.
   */
  onRequest(msg) {
    if (typeof msg === "object") {
      msg = JSON.stringify(msg);
    }
    super.onRequest(this.requestChannel, msg);
  }
  /**
   * Handle a response from another node.
   */
  onResponse(msg) {
    if (typeof msg === "object") {
      msg = JSON.stringify(msg);
    }
    super.onResponse(this.responseChannel, msg);
  }
  /**
   * Listen for message coming from other nodes to broadcast
   * a specific message to the local sockets.
   */
  onMessage(msg) {
    if (typeof msg === "string") {
      msg = JSON.parse(msg);
    }
    let message = msg;
    const { uuid, appId, channel, data, exceptingId } = message;
    if (uuid === this.uuid || !appId || !channel || !data) {
      return;
    }
    super.sendLocally(appId, channel, data, exceptingId);
  }
  /**
   * Broadcast data to a given channel.
   */
  broadcastToChannel(channel, data) {
    this.server.discover.send(channel, data);
  }
  /**
   * Get the number of Discover nodes.
   */
  getNumSub() {
    return Promise.resolve(this.server.nodes.size);
  }
}

module.exports = { ClusterAdapter };
