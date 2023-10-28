const { ClusterAdapter } = require("./cluster-adapter");
const { LocalAdapter } = require("./local-adapter");
const { Log } = require("../log");
const { NatsAdapter } = require("./nats-adapter");
const { RedisAdapter } = require("./redis-adapter");

class Adapter {
  /**
   * Initialize adapter scaling.
   */
  constructor(server) {
    if (server.options.adapter.driver === "local") {
      this.driver = new LocalAdapter(server);
    } else if (server.options.adapter.driver === "redis") {
      this.driver = new RedisAdapter(server);
    } else if (server.options.adapter.driver === "nats") {
      this.driver = new NatsAdapter(server);
    } else if (server.options.adapter.driver === "cluster") {
      this.driver = new ClusterAdapter(server);
    } else {
      Log.error("Adapter driver not set.");
    }
  }
  /**
   * Initialize the adapter.
   */
  async init() {
    return await this.driver.init();
  }
  /**
   * Get the app namespace.
   */
  getNamespace(appId) {
    return this.driver.getNamespace(appId);
  }
  /**
   * Get all namespaces.
   */
  getNamespaces() {
    return this.driver.getNamespaces();
  }
  /**
   * Add a new socket to the namespace.
   */
  async addSocket(appId, ws) {
    return this.driver.addSocket(appId, ws);
  }
  /**
   * Remove a socket from the namespace.
   */
  async removeSocket(appId, wsId) {
    return this.driver.removeSocket(appId, wsId);
  }
  /**
   * Add a socket ID to the channel identifier.
   * Return the total number of connections after the connection.
   */
  async addToChannel(appId, channel, ws) {
    return this.driver.addToChannel(appId, channel, ws);
  }
  /**
   * Remove a socket ID from the channel identifier.
   * Return the total number of connections remaining to the channel.
   */
  async removeFromChannel(appId, channel, wsId) {
    return this.driver.removeFromChannel(appId, channel, wsId);
  }
  /**
   * Get all sockets from the namespace.
   */
  async getSockets(appId, onlyLocal = false) {
    return this.driver.getSockets(appId, onlyLocal);
  }
  /**
   * Get total sockets count.
   */
  async getSocketsCount(appId, onlyLocal) {
    return this.driver.getSocketsCount(appId, onlyLocal);
  }
  /**
   * Get the list of channels with the websocket IDs.
   */
  async getChannels(appId, onlyLocal = false) {
    return this.driver.getChannels(appId, onlyLocal);
  }
  /**
   * Get the list of channels with the websockets count.
   */
  async getChannelsWithSocketsCount(appId, onlyLocal = false) {
    return this.driver.getChannelsWithSocketsCount(appId, onlyLocal);
  }
  /**
   * Get all the channel sockets associated with a namespace.
   */
  async getChannelSockets(appId, channel, onlyLocal = false) {
    return this.driver.getChannelSockets(appId, channel, onlyLocal);
  }
  /**
   * Get a given channel's total sockets count.
   */
  async getChannelSocketsCount(appId, channel, onlyLocal) {
    return this.driver.getChannelSocketsCount(appId, channel, onlyLocal);
  }
  /**
   * Get a given presence channel's members.
   */
  async getChannelMembers(appId, channel, onlyLocal = false) {
    return this.driver.getChannelMembers(appId, channel, onlyLocal);
  }
  /**
   * Get a given presence channel's members count
   */
  async getChannelMembersCount(appId, channel, onlyLocal) {
    return this.driver.getChannelMembersCount(appId, channel, onlyLocal);
  }
  /**
   * Check if a given connection ID exists in a channel.
   */
  async isInChannel(appId, channel, wsId, onlyLocal) {
    return this.driver.isInChannel(appId, channel, wsId, onlyLocal);
  }
  /**
   * Send a message to a namespace and channel.
   */
  send(appId, channel, data, exceptingId = null) {
    return this.driver.send(appId, channel, data, exceptingId);
  }
  /**
   * Terminate an User ID's connections.
   */
  terminateUserConnections(appId, userId) {
    return this.driver.terminateUserConnections(appId, userId);
  }
  /**
   * Add to the users list the associated socket connection ID.
   */
  addUser(ws) {
    return this.driver.addUser(ws);
  }
  /**
   * Remove the user associated with the connection ID.
   */
  removeUser(ws) {
    return this.driver.removeUser(ws);
  }
  /**
   * Get the sockets associated with an user.
   */
  getUserSockets(appId, userId) {
    return this.driver.getUserSockets(appId, userId);
  }
  /**
   * Clear the namespace from the local adapter.
   */
  clearNamespace(namespaceId) {
    return this.driver.clearNamespace(namespaceId);
  }
  /**
   * Clear all namespaces from the local adapter.
   */
  clearNamespaces() {
    return this.driver.clearNamespaces();
  }
  /**
   * Clear the connections.
   */
  disconnect() {
    return this.driver.disconnect();
  }
}

module.exports = { Adapter };
