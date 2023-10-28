const { Namespace } = require("../namespace");

class LocalAdapter {
  /**
   * Initialize the adapter.
   */
  constructor(server) {
    this.server = server;
    // TODO: Force disconnect a specific socket
    // TODO: Force disconnect all sockets from an app.
    /**
     * The app connections storage class to manage connections.
     */
    this.namespaces = new Map();
    //
  }
  /**
   * Initialize the adapter.
   */
  async init() {
    return Promise.resolve(this);
  }
  /**
   * Get the app namespace.
   */
  getNamespace(appId) {
    if (!this.namespaces.has(appId)) {
      this.namespaces.set(appId, new Namespace(appId));
    }
    return this.namespaces.get(appId);
  }
  /**
   * Get all namespaces.
   */
  getNamespaces() {
    return this.namespaces;
  }
  /**
   * Add a new socket to the namespace.
   */
  async addSocket(appId, ws) {
    return this.getNamespace(appId).addSocket(ws);
  }
  /**
   * Remove a socket from the namespace.
   */
  async removeSocket(appId, wsId) {
    return this.getNamespace(appId).removeSocket(wsId);
  }
  /**
   * Add a socket ID to the channel identifier.
   * Return the total number of connections after the connection.
   */
  async addToChannel(appId, channel, ws) {
    return this.getNamespace(appId)
      .addToChannel(ws, channel)
      .then(() => {
        return this.getChannelSocketsCount(appId, channel);
      });
  }
  /**
   * Remove a socket ID from the channel identifier.
   * Return the total number of connections remaining to the channel.
   */
  async removeFromChannel(appId, channel, wsId) {
    return this.getNamespace(appId)
      .removeFromChannel(wsId, channel)
      .then((remainingConnections) => {
        if (!Array.isArray(channel)) {
          return this.getChannelSocketsCount(appId, channel);
        }
        return;
      });
  }
  /**
   * Get all sockets from the namespace.
   */
  async getSockets(appId, onlyLocal = false) {
    return this.getNamespace(appId).getSockets();
  }
  /**
   * Get total sockets count.
   */
  async getSocketsCount(appId, onlyLocal) {
    return this.getNamespace(appId)
      .getSockets()
      .then((sockets) => {
        return sockets.size;
      });
  }
  /**
   * Get all sockets from the namespace.
   */
  async getChannels(appId, onlyLocal = false) {
    return this.getNamespace(appId).getChannels();
  }
  /**
   * Get channels with total sockets count.
   */
  async getChannelsWithSocketsCount(appId, onlyLocal) {
    return this.getNamespace(appId).getChannelsWithSocketsCount();
  }
  /**
   * Get all the channel sockets associated with a namespace.
   */
  async getChannelSockets(appId, channel, onlyLocal = false) {
    return this.getNamespace(appId).getChannelSockets(channel);
  }
  /**
   * Get a given channel's total sockets count.
   */
  async getChannelSocketsCount(appId, channel, onlyLocal) {
    return this.getNamespace(appId)
      .getChannelSockets(channel)
      .then((sockets) => {
        return sockets.size;
      });
  }
  /**
   * Get a given presence channel's members.
   */
  async getChannelMembers(appId, channel, onlyLocal = false) {
    return this.getNamespace(appId).getChannelMembers(channel);
  }
  /**
   * Get a given presence channel's members count
   */
  async getChannelMembersCount(appId, channel, onlyLocal) {
    return this.getNamespace(appId)
      .getChannelMembers(channel)
      .then((members) => {
        return members.size;
      });
  }
  /**
   * Check if a given connection ID exists in a channel.
   */
  async isInChannel(appId, channel, wsId, onlyLocal) {
    return this.getNamespace(appId).isInChannel(wsId, channel);
  }
  /**
   * Send a message to a namespace and channel.
   */
  send(appId, channel, data, exceptingId = null) {
    // For user-dedicated channels, intercept the .send() call and use custom logic.
    if (channel.indexOf("#server-to-user-") === 0) {
      let userId = channel.split("#server-to-user-").pop();
      this.getUserSockets(appId, userId).then((sockets) => {
        sockets.forEach((ws) => {
          if (ws.sendJson) {
            ws.sendJson(JSON.parse(data));
          }
        });
      });
      return;
    }
    this.getNamespace(appId)
      .getChannelSockets(channel)
      .then((sockets) => {
        sockets.forEach((ws) => {
          if (exceptingId && exceptingId === ws.id) {
            return;
          }
          // Fix race conditions.
          if (ws.sendJson) {
            ws.sendJson(JSON.parse(data));
          }
        });
      });
  }
  /**
   * Terminate an User ID's connections.
   */
  terminateUserConnections(appId, userId) {
    this.getNamespace(appId).terminateUserConnections(userId);
  }
  /**
   * Add to the users list the associated socket connection ID.
   */
  addUser(ws) {
    return this.getNamespace(ws.app.id).addUser(ws);
  }
  /**
   * Remove the user associated with the connection ID.
   */
  removeUser(ws) {
    return this.getNamespace(ws.app.id).removeUser(ws);
  }
  /**
   * Get the sockets associated with an user.
   */
  getUserSockets(appId, userId) {
    return this.getNamespace(appId).getUserSockets(userId);
  }
  /**
   * Clear the connections.
   */
  disconnect() {
    return Promise.resolve();
  }
  /**
   * Clear the namespace from the local adapter.
   */
  clearNamespace(namespaceId) {
    this.namespaces.set(namespaceId, new Namespace(namespaceId));
    return Promise.resolve();
  }
  /**
   * Clear all namespaces from the local adapter.
   */
  clearNamespaces() {
    this.namespaces = new Map();
    return Promise.resolve();
  }
}

module.exports = { LocalAdapter };
