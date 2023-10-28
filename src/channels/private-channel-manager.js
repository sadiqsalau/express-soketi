const { PublicChannelManager } = require("./public-channel-manager");

const Pusher = require("pusher");
class PrivateChannelManager extends PublicChannelManager {
  /**
   * Join the connection to the channel.
   */
  join(ws, channel, message) {
    var _a;
    let passedSignature =
      (_a = message === null || message === void 0 ? void 0 : message.data) ===
        null || _a === void 0
        ? void 0
        : _a.auth;
    return this.signatureIsValid(ws.app, ws.id, message, passedSignature).then(
      (isValid) => {
        if (!isValid) {
          return {
            ws,
            success: false,
            errorCode: 4009,
            errorMessage: "The connection is unauthorized.",
            authError: true,
            type: "AuthError",
          };
        }
        return super.join(ws, channel, message).then((joinResponse) => {
          // If the users joined to a private channel with authentication,
          // proceed clearing the authentication timeout.
          if (joinResponse.success && ws.userAuthenticationTimeout) {
            clearTimeout(ws.userAuthenticationTimeout);
          }
          return joinResponse;
        });
      }
    );
  }
  /**
   * Check is an incoming connection can subscribe.
   */
  signatureIsValid(app, socketId, message, signatureToCheck) {
    return this.getExpectedSignature(app, socketId, message).then(
      (expectedSignature) => {
        return signatureToCheck === expectedSignature;
      }
    );
  }
  /**
   * Get the signed token from the given message, by the Socket.
   */
  getExpectedSignature(app, socketId, message) {
    return new Promise((resolve) => {
      let token = new Pusher.Token(app.key, app.secret);
      resolve(
        app.key +
          ":" +
          token.sign(this.getDataToSignForSignature(socketId, message))
      );
    });
  }
  /**
   * Get the data to sign for the token for specific channel.
   */
  getDataToSignForSignature(socketId, message) {
    return `${socketId}:${message.data.channel}`;
  }
}

module.exports = { PrivateChannelManager };
