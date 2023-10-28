class Namespace {
  /**
   * Initialize the namespace for an app.
   */
  constructor(appId) {
    this.appId = appId;
    /**
     * The list of channel connections for the current app.
     */
    this.channels = new Map();
    /**
     * The list of sockets connected to the namespace.
     */
    this.sockets = new Map();
    /**
     * The list of user IDs and their associated socket ids.
     */
    this.users = new Map();
    //
  }
  /**
   * Get all sockets from this namespace.
   */
  getSockets() {
    return Promise.resolve(this.sockets);
  }
  /**
   * Add a new socket to the namespace.
   */
  addSocket(ws) {
    return new Promise((resolve) => {
      this.sockets.set(ws.id, ws);
      resolve(true);
    });
  }
  /**
   * Remove a socket from the namespace.
   */
  async removeSocket(wsId) {
    this.removeFromChannel(wsId, [...this.channels.keys()]);
    return this.sockets.delete(wsId);
  }
  /**
   * Add a socket ID to the channel identifier.
   * Return the total number of connections after the connection.
   */
  addToChannel(ws, channel) {
    return new Promise((resolve) => {
      if (!this.channels.has(channel)) {
        this.channels.set(channel, new Set());
      }
      this.channels.get(channel).add(ws.id);
      resolve(this.channels.get(channel).size);
    });
  }
  /**
   * Remove a socket ID from the channel identifier.
   * Return the total number of connections remaining to the channel.
   */
  async removeFromChannel(wsId, channel) {
    let remove = (channel) => {
      if (this.channels.has(channel)) {
        this.channels.get(channel).delete(wsId);
        if (this.channels.get(channel).size === 0) {
          this.channels.delete(channel);
        }
      }
    };
    return new Promise((resolve) => {
      if (Array.isArray(channel)) {
        channel.forEach((ch) => remove(ch));
        return resolve();
      }
      remove(channel);
      resolve(this.channels.has(channel) ? this.channels.get(channel).size : 0);
    });
  }
  /**
   * Check if a socket ID is joined to the channel.
   */
  isInChannel(wsId, channel) {
    return new Promise((resolve) => {
      if (!this.channels.has(channel)) {
        return resolve(false);
      }
      resolve(this.channels.get(channel).has(wsId));
    });
  }
  /**
   * Get the list of channels with the websocket IDs.
   */
  getChannels() {
    return Promise.resolve(this.channels);
  }
  /**
   * Get the list of channels with the websocket IDs.
   */
  getChannelsWithSocketsCount() {
    return this.getChannels().then((channels) => {
      let list = new Map();
      for (let [channel, connections] of [...channels]) {
        list.set(channel, connections.size);
      }
      return list;
    });
  }
  /**
   * Get all the channel sockets associated with this namespace.
   */
  getChannelSockets(channel) {
    return new Promise((resolve) => {
      if (!this.channels.has(channel)) {
        return resolve(new Map());
      }
      let wsIds = this.channels.get(channel);
      resolve(
        Array.from(wsIds).reduce((sockets, wsId) => {
          if (!this.sockets.has(wsId)) {
            return sockets;
          }
          return sockets.set(wsId, this.sockets.get(wsId));
        }, new Map())
      );
    });
  }
  /**
   * Get a given presence channel's members.
   */
  getChannelMembers(channel) {
    return this.getChannelSockets(channel).then((sockets) => {
      return Array.from(sockets).reduce((members, [wsId, ws]) => {
        let member = ws.presence ? ws.presence.get(channel) : null;
        if (member) {
          members.set(member.user_id, member.user_info);
        }
        return members;
      }, new Map());
    });
  }
  /**
   * Terminate the user's connections.
   */
  terminateUserConnections(userId) {
    this.getSockets().then((sockets) => {
      [...sockets].forEach(([wsId, ws]) => {
        if (ws.user && ws.user.id == userId) {
          ws.sendJson({
            event: "pusher:error",
            data: {
              code: 4009,
              message: "You got disconnected by the app.",
            },
          });
          try {
            ws.terminate();
          } catch (e) {
            //
          }
        }
      });
    });
  }
  /**
   * Add to the users list the associated socket connection ID.
   */
  addUser(ws) {
    if (!ws.user) {
      return Promise.resolve();
    }
    if (!this.users.has(ws.user.id)) {
      this.users.set(ws.user.id, new Set());
    }
    if (!this.users.get(ws.user.id).has(ws.id)) {
      this.users.get(ws.user.id).add(ws.id);
    }
    return Promise.resolve();
  }
  /**
   * Remove the user associated with the connection ID.
   */
  removeUser(ws) {
    if (!ws.user) {
      return Promise.resolve();
    }
    if (this.users.has(ws.user.id)) {
      this.users.get(ws.user.id).delete(ws.id);
    }
    if (this.users.get(ws.user.id) && this.users.get(ws.user.id).size === 0) {
      this.users.delete(ws.user.id);
    }
    return Promise.resolve();
  }
  /**
   * Get the sockets associated with an user.
   */
  getUserSockets(userId) {
    let wsIds = this.users.get(userId);
    if (!wsIds || wsIds.size === 0) {
      return Promise.resolve(new Set());
    }
    return Promise.resolve(
      [...wsIds].reduce((sockets, wsId) => {
        sockets.add(this.sockets.get(wsId));
        return sockets;
      }, new Set())
    );
  }
}

module.exports = { Namespace };
