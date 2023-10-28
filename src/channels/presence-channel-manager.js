const { Log } = require("../log");
const { PrivateChannelManager } = require("./private-channel-manager");
const { Utils } = require("../utils");
class PresenceChannelManager extends PrivateChannelManager {
  /**
   * Join the connection to the channel.
   */
  join(ws, channel, message) {
    return this.server.adapter
      .getChannelMembersCount(ws.app.id, channel)
      .then((membersCount) => {
        if (membersCount + 1 > ws.app.maxPresenceMembersPerChannel) {
          return {
            success: false,
            ws,
            errorCode: 4100,
            errorMessage:
              "The maximum members per presence channel limit was reached",
            type: "LimitReached",
          };
        }
        let member = JSON.parse(message.data.channel_data);
        let memberSizeInKb = Utils.dataToKilobytes(member.user_info);
        if (memberSizeInKb > ws.app.maxPresenceMemberSizeInKb) {
          return {
            success: false,
            ws,
            errorCode: 4301,
            errorMessage: `The maximum size for a channel member is ${ws.app.maxPresenceMemberSizeInKb} KB.`,
            type: "LimitReached",
          };
        }
        return super.join(ws, channel, message).then((response) => {
          // Make sure to forward the response in case an error occurs.
          if (!response.success) {
            return response;
          }
          return {
            ...response,
            ...{
              member,
            },
          };
        });
      })
      .catch((err) => {
        Log.error(err);
        return {
          success: false,
          ws,
          errorCode: 4302,
          errorMessage: "A server error has occured.",
          type: "ServerError",
        };
      });
  }
  /**
   * Mark the connection as closed and unsubscribe it.
   */
  leave(ws, channel) {
    return super.leave(ws, channel).then((response) => {
      return {
        ...response,
        ...{
          member: ws.presence.get(channel),
        },
      };
    });
  }
  /**
   * Get the data to sign for the token for specific channel.
   */
  getDataToSignForSignature(socketId, message) {
    return `${socketId}:${message.data.channel}:${message.data.channel_data}`;
  }
}

module.exports = { PresenceChannelManager };
