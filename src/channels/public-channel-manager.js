const { Utils } = require("../utils");

class PublicChannelManager {
  constructor(server) {
    this.server = server;
    //
  }
  /**
   * Join the connection to the channel.
   */
  join(ws, channel, message) {
    if (Utils.restrictedChannelName(channel)) {
      return Promise.resolve({
        ws,
        success: false,
        errorCode: 4009,
        errorMessage:
          "The channel name is not allowed. Read channel conventions: https://pusher.com/docs/channels/using_channels/channels/#channel-naming-conventions",
      });
    }
    if (!ws.app) {
      return Promise.resolve({
        ws,
        success: false,
        errorCode: 4009,
        errorMessage:
          "Subscriptions messages should be sent after the pusher:connection_established event is received.",
      });
    }
    return this.server.adapter
      .addToChannel(ws.app.id, channel, ws)
      .then((connections) => {
        return {
          ws,
          success: true,
          channelConnections: connections,
        };
      });
  }
  /**
   * Mark the connection as closed and unsubscribe it.
   */
  leave(ws, channel) {
    return this.server.adapter
      .removeFromChannel(ws.app.id, channel, ws.id)
      .then((remainingConnections) => {
        return {
          left: true,
          remainingConnections: remainingConnections,
        };
      });
  }
}

module.exports = { PublicChannelManager };
