class Utils {
  /**
   * Get the amount of bytes from given parameters.
   */
  static dataToBytes(...data) {
    return data.reduce((totalBytes, element) => {
      element = typeof element === "string" ? element : JSON.stringify(element);
      try {
        return (totalBytes += Buffer.byteLength(element, "utf8"));
      } catch (e) {
        return totalBytes;
      }
    }, 0);
  }
  /**
   * Get the amount of kilobytes from given parameters.
   */
  static dataToKilobytes(...data) {
    return this.dataToBytes(...data) / 1024;
  }
  /**
   * Get the amount of megabytes from given parameters.
   */
  static dataToMegabytes(...data) {
    return this.dataToKilobytes(...data) / 1024;
  }
  /**
   * Check if the given channel name is private.
   */
  static isPrivateChannel(channel) {
    let isPrivate = false;
    this._privateChannelPatterns.forEach((pattern) => {
      let regex = new RegExp(pattern.replace("*", ".*"));
      if (regex.test(channel)) {
        isPrivate = true;
      }
    });
    return isPrivate;
  }
  /**
   * Check if the given channel name is a presence channel.
   */
  static isPresenceChannel(channel) {
    return channel.lastIndexOf("presence-", 0) === 0;
  }
  /**
   * Check if the given channel name is a encrypted private channel.
   */
  static isEncryptedPrivateChannel(channel) {
    return channel.lastIndexOf("private-encrypted-", 0) === 0;
  }
  /**
   * Check if the given channel accepts caching.
   */
  static isCachingChannel(channel) {
    let isCachingChannel = false;
    this._cachingChannelPatterns.forEach((pattern) => {
      let regex = new RegExp(pattern.replace("*", ".*"));
      if (regex.test(channel)) {
        isCachingChannel = true;
      }
    });
    return isCachingChannel;
  }
  /**
   * Check if client is a client event.
   */
  static isClientEvent(event) {
    let isClientEvent = false;
    this._clientEventPatterns.forEach((pattern) => {
      let regex = new RegExp(pattern.replace("*", ".*"));
      if (regex.test(event)) {
        isClientEvent = true;
      }
    });
    return isClientEvent;
  }
  /**
   * Check if the channel name is restricted for connections from the client.
   * Read: https://pusher.com/docs/channels/using_channels/channels/#channel-naming-conventions
   */
  static restrictedChannelName(name) {
    return /^#?[-a-zA-Z0-9_=@,.;]+$/.test(name) === false;
  }
}
/**
 * Allowed client events patterns.
 *
 * @type {string[]}
 */
Utils._clientEventPatterns = ["client-*"];
/**
 * Channels and patters for private channels.
 *
 * @type {string[]}
 */
Utils._privateChannelPatterns = [
  "private-*",
  "private-encrypted-*",
  "presence-*",
];
/**
 * Channels with patters for caching channels.
 *
 * @type {string[]}
 */
Utils._cachingChannelPatterns = [
  "cache-*",
  "private-cache-*",
  "private-encrypted-cache-*",
  "presence-cache-*",
];

module.exports = { Utils };
