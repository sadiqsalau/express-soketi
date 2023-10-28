const { JSONCodec, StringCodec, connect } = require("nats");
const { timeout } = require("nats/lib/nats-base-client/util");
const { HorizontalAdapter } = require("./horizontal-adapter");

class NatsAdapter extends HorizontalAdapter {
  /**
   * Initialize the adapter.
   */
  constructor(server) {
    super(server);
    /**
     * The channel to broadcast the information.
     */
    this.channel = "nats-adapter";
    if (server.options.adapter.nats.prefix) {
      this.channel = server.options.adapter.nats.prefix + "#" + this.channel;
    }
    this.requestChannel = `${this.channel}#comms#req`;
    this.responseChannel = `${this.channel}#comms#res`;
    this.jc = JSONCodec();
    this.sc = StringCodec();
    this.requestsTimeout = server.options.adapter.nats.requestsTimeout;
  }
  /**
   * Initialize the adapter.
   */
  async init() {
    return new Promise((resolve) => {
      connect({
        servers: this.server.options.adapter.nats.servers,
        user: this.server.options.adapter.nats.user,
        pass: this.server.options.adapter.nats.pass,
        token: this.server.options.adapter.nats.token,
        pingInterval: 30000,
        timeout: this.server.options.adapter.nats.timeout,
        reconnect: false,
      }).then((connection) => {
        this.connection = connection;
        this.connection.subscribe(this.requestChannel, {
          callback: (_err, msg) => this.onRequest(msg),
        });
        this.connection.subscribe(this.responseChannel, {
          callback: (_err, msg) => this.onResponse(msg),
        });
        this.connection.subscribe(this.channel, {
          callback: (_err, msg) => this.onMessage(msg),
        });
        resolve(this);
      });
    });
  }
  /**
   * Listen for requests coming from other nodes.
   */
  onRequest(msg) {
    super.onRequest(
      this.requestChannel,
      JSON.stringify(this.jc.decode(msg.data))
    );
  }
  /**
   * Handle a response from another node.
   */
  onResponse(msg) {
    super.onResponse(
      this.responseChannel,
      JSON.stringify(this.jc.decode(msg.data))
    );
  }
  /**
   * Listen for message coming from other nodes to broadcast
   * a specific message to the local sockets.
   */
  onMessage(msg) {
    let message = this.jc.decode(msg.data);
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
    this.connection.publish(channel, this.jc.encode(JSON.parse(data)));
  }
  /**
   * Get the number of Discover nodes.
   */
  async getNumSub() {
    let nodesNumber = this.server.options.adapter.nats.nodesNumber;
    if (nodesNumber && nodesNumber > 0) {
      return Promise.resolve(nodesNumber);
    }
    return new Promise((resolve) => {
      let responses = [];
      let calculateResponses = () =>
        responses.reduce((total, response) => {
          let { data } = JSON.parse(this.sc.decode(response.data));
          return (total += data.total);
        }, 0);
      let waiter = timeout(1000);
      waiter.finally(() => resolve(calculateResponses()));
      this.connection.request("$SYS.REQ.SERVER.PING.CONNZ").then((response) => {
        responses.push(response);
        waiter.cancel();
        waiter = timeout(200);
        waiter.catch(() => resolve(calculateResponses()));
      });
    });
  }
  /**
   * Clear the connections.
   */
  disconnect() {
    return this.connection.close();
  }
}

module.exports = { NatsAdapter };
