const { v4: uuidv4 } = require("uuid");
const { LocalAdapter } = require("./local-adapter");
const { Log } = require("../log");

/**
 *                                          |-----> NODE1 ----> SEEKS DATA (ONREQUEST) ----> SEND TO THE NODE0 ---> NODE0 (ONRESPONSE) APPENDS DATA TO REQUEST OBJECT
 *                                          |
 * NODE0 ---> PUBLISH TO PUBLISHER  ------> |-----> NODE2 ----> SEEKS DATA (ONREQUEST) ----> SEND TO THE NODE0 ---> NODE0 (ONRESPONSE) APPENDS DATA TO REQUEST OBJECT
 *            (IN ADAPTER METHOD)           |
 *                                          |-----> NODE3 ----> SEEKS DATA (ONREQUEST) ----> SEND TO THE NODE0 ---> NODE0 (ONRESPONSE) APPENDS DATA TO REQUEST OBJECT
 */
var RequestType;
(function (RequestType) {
  RequestType[(RequestType["SOCKETS"] = 0)] = "SOCKETS";
  RequestType[(RequestType["CHANNELS"] = 1)] = "CHANNELS";
  RequestType[(RequestType["CHANNEL_SOCKETS"] = 2)] = "CHANNEL_SOCKETS";
  RequestType[(RequestType["CHANNEL_MEMBERS"] = 3)] = "CHANNEL_MEMBERS";
  RequestType[(RequestType["SOCKETS_COUNT"] = 4)] = "SOCKETS_COUNT";
  RequestType[(RequestType["CHANNEL_MEMBERS_COUNT"] = 5)] =
    "CHANNEL_MEMBERS_COUNT";
  RequestType[(RequestType["CHANNEL_SOCKETS_COUNT"] = 6)] =
    "CHANNEL_SOCKETS_COUNT";
  RequestType[(RequestType["SOCKET_EXISTS_IN_CHANNEL"] = 7)] =
    "SOCKET_EXISTS_IN_CHANNEL";
  RequestType[(RequestType["CHANNELS_WITH_SOCKETS_COUNT"] = 8)] =
    "CHANNELS_WITH_SOCKETS_COUNT";
  RequestType[(RequestType["TERMINATE_USER_CONNECTIONS"] = 9)] =
    "TERMINATE_USER_CONNECTIONS";
})(RequestType || (RequestType = {}));
class HorizontalAdapter extends LocalAdapter {
  constructor() {
    super(...arguments);
    /**
     * The time (in ms) for the request to be fulfilled.
     */
    this.requestsTimeout = 5000;
    /**
     * The list of current request made by this instance.
     */
    this.requests = new Map();
    /**
     * The channel to broadcast the information.
     */
    this.channel = "horizontal-adapter";
    /**
     * The UUID assigned for the current instance.
     */
    this.uuid = uuidv4();
    /**
     * The list of resolvers for each response type.
     */
    this.resolvers = {
      [RequestType.SOCKETS]: {
        computeResponse: (request, response) => {
          if (response.sockets) {
            response.sockets.forEach((ws) => request.sockets.set(ws.id, ws));
          }
        },
        resolveValue: (request, response) => {
          return request.sockets;
        },
      },
      [RequestType.CHANNEL_SOCKETS]: {
        computeResponse: (request, response) => {
          if (response.sockets) {
            response.sockets.forEach((ws) => request.sockets.set(ws.id, ws));
          }
        },
        resolveValue: (request, response) => {
          return request.sockets;
        },
      },
      [RequestType.CHANNELS]: {
        computeResponse: (request, response) => {
          if (response.channels) {
            response.channels.forEach(([channel, connections]) => {
              if (request.channels.has(channel)) {
                connections.forEach((connection) => {
                  request.channels.set(
                    channel,
                    request.channels.get(channel).add(connection)
                  );
                });
              } else {
                request.channels.set(channel, new Set(connections));
              }
            });
          }
        },
        resolveValue: (request, response) => {
          return request.channels;
        },
      },
      [RequestType.CHANNELS_WITH_SOCKETS_COUNT]: {
        computeResponse: (request, response) => {
          if (response.channelsWithSocketsCount) {
            response.channelsWithSocketsCount.forEach(
              ([channel, connectionsCount]) => {
                if (request.channelsWithSocketsCount.has(channel)) {
                  request.channelsWithSocketsCount.set(
                    channel,
                    request.channelsWithSocketsCount.get(channel) +
                      connectionsCount
                  );
                } else {
                  request.channelsWithSocketsCount.set(
                    channel,
                    connectionsCount
                  );
                }
              }
            );
          }
        },
        resolveValue: (request, response) => {
          return request.channelsWithSocketsCount;
        },
      },
      [RequestType.CHANNEL_MEMBERS]: {
        computeResponse: (request, response) => {
          if (response.members) {
            response.members.forEach(([id, member]) =>
              request.members.set(id, member)
            );
          }
        },
        resolveValue: (request, response) => {
          return request.members;
        },
      },
      [RequestType.SOCKETS_COUNT]: {
        computeResponse: (request, response) => {
          if (typeof response.totalCount !== "undefined") {
            request.totalCount += response.totalCount;
          }
        },
        resolveValue: (request, response) => {
          return request.totalCount;
        },
      },
      [RequestType.CHANNEL_MEMBERS_COUNT]: {
        computeResponse: (request, response) => {
          if (typeof response.totalCount !== "undefined") {
            request.totalCount += response.totalCount;
          }
        },
        resolveValue: (request, response) => {
          return request.totalCount;
        },
      },
      [RequestType.CHANNEL_SOCKETS_COUNT]: {
        computeResponse: (request, response) => {
          if (typeof response.totalCount !== "undefined") {
            request.totalCount += response.totalCount;
          }
        },
        resolveValue: (request, response) => {
          return request.totalCount;
        },
      },
      [RequestType.SOCKET_EXISTS_IN_CHANNEL]: {
        computeResponse: (request, response) => {
          if (
            typeof response.exists !== "undefined" &&
            response.exists === true
          ) {
            request.exists = true;
          }
        },
        resolveValue: (request, response) => {
          return request.exists || false;
        },
      },
      [RequestType.TERMINATE_USER_CONNECTIONS]: {
        computeResponse: (request, response) => {
          // Don't need to compute any response as we won't be sending one.
        },
        resolveValue: (request, response) => {
          return true;
        },
      },
    };
  }
  /**
   * Send a response through the response channel.
   */
  sendToResponseChannel(data) {
    this.broadcastToChannel(this.responseChannel, data);
  }
  /**
   * Send a request through the request channel.
   */
  sendToRequestChannel(data) {
    this.broadcastToChannel(this.requestChannel, data);
  }
  /**
   * Send a message to a namespace and channel.
   */
  send(appId, channel, data, exceptingId = null) {
    this.broadcastToChannel(
      this.channel,
      JSON.stringify({
        uuid: this.uuid,
        appId,
        channel,
        data,
        exceptingId,
      })
    );
    this.sendLocally(appId, channel, data, exceptingId);
  }
  /**
   * Force local sending only for the Horizontal adapter.
   */
  sendLocally(appId, channel, data, exceptingId = null) {
    super.send(appId, channel, data, exceptingId);
  }
  /**
   * Terminate an User ID's connections.
   */
  terminateUserConnections(appId, userId) {
    new Promise((resolve, reject) => {
      this.getNumSub().then((numSub) => {
        if (numSub <= 1) {
          this.terminateLocalUserConnections(appId, userId);
          return;
        }
        this.sendRequest(
          appId,
          RequestType.TERMINATE_USER_CONNECTIONS,
          resolve,
          reject,
          { numSub },
          { opts: { userId } }
        );
      });
    });
    this.terminateLocalUserConnections(appId, userId);
  }
  /**
   * Terminate an User ID's local connections.
   */
  terminateLocalUserConnections(appId, userId) {
    super.terminateUserConnections(appId, userId);
  }
  /**
   * Get all sockets from the namespace.
   */
  async getSockets(appId, onlyLocal = false) {
    return new Promise((resolve, reject) => {
      super.getSockets(appId, true).then((localSockets) => {
        if (onlyLocal) {
          return resolve(localSockets);
        }
        this.getNumSub().then((numSub) => {
          if (numSub <= 1) {
            return resolve(localSockets);
          }
          this.sendRequest(appId, RequestType.SOCKETS, resolve, reject, {
            numSub,
            sockets: localSockets,
          });
        });
      });
    });
  }
  /**
   * Get total sockets count.
   */
  async getSocketsCount(appId, onlyLocal) {
    return new Promise((resolve, reject) => {
      super.getSocketsCount(appId).then((wsCount) => {
        if (onlyLocal) {
          return resolve(wsCount);
        }
        this.getNumSub().then((numSub) => {
          if (numSub <= 1) {
            return resolve(wsCount);
          }
          this.sendRequest(appId, RequestType.SOCKETS_COUNT, resolve, reject, {
            numSub,
            totalCount: wsCount,
          });
        });
      });
    });
  }
  /**
   * Get all sockets from the namespace.
   */
  async getChannels(appId, onlyLocal = false) {
    return new Promise((resolve, reject) => {
      super.getChannels(appId).then((localChannels) => {
        if (onlyLocal) {
          resolve(localChannels);
        }
        this.getNumSub().then((numSub) => {
          if (numSub <= 1) {
            return resolve(localChannels);
          }
          this.sendRequest(appId, RequestType.CHANNELS, resolve, reject, {
            numSub,
            channels: localChannels,
          });
        });
      });
    });
  }
  /**
   * Get total sockets count.
   */
  async getChannelsWithSocketsCount(appId, onlyLocal) {
    return new Promise((resolve, reject) => {
      super.getChannelsWithSocketsCount(appId).then((list) => {
        if (onlyLocal) {
          return resolve(list);
        }
        this.getNumSub().then((numSub) => {
          if (numSub <= 1) {
            return resolve(list);
          }
          this.sendRequest(
            appId,
            RequestType.CHANNELS_WITH_SOCKETS_COUNT,
            resolve,
            reject,
            { numSub, channelsWithSocketsCount: list }
          );
        });
      });
    });
  }
  /**
   * Get all the channel sockets associated with a namespace.
   */
  async getChannelSockets(appId, channel, onlyLocal = false) {
    return new Promise((resolve, reject) => {
      super.getChannelSockets(appId, channel).then((localSockets) => {
        if (onlyLocal) {
          return resolve(localSockets);
        }
        this.getNumSub().then((numSub) => {
          if (numSub <= 1) {
            return resolve(localSockets);
          }
          this.sendRequest(
            appId,
            RequestType.CHANNEL_SOCKETS,
            resolve,
            reject,
            { numSub, sockets: localSockets },
            { opts: { channel } }
          );
        });
      });
    });
  }
  /**
   * Get a given channel's total sockets count.
   */
  async getChannelSocketsCount(appId, channel, onlyLocal) {
    return new Promise((resolve, reject) => {
      super.getChannelSocketsCount(appId, channel).then((wsCount) => {
        if (onlyLocal) {
          return resolve(wsCount);
        }
        this.getNumSub().then((numSub) => {
          if (numSub <= 1) {
            return resolve(wsCount);
          }
          this.sendRequest(
            appId,
            RequestType.CHANNEL_SOCKETS_COUNT,
            resolve,
            reject,
            { numSub, totalCount: wsCount },
            { opts: { channel } }
          );
        });
      });
    });
  }
  /**
   * Get all the channel sockets associated with a namespace.
   */
  async getChannelMembers(appId, channel, onlyLocal = false) {
    return new Promise((resolve, reject) => {
      super.getChannelMembers(appId, channel).then((localMembers) => {
        if (onlyLocal) {
          return resolve(localMembers);
        }
        this.getNumSub().then((numSub) => {
          if (numSub <= 1) {
            return resolve(localMembers);
          }
          return this.sendRequest(
            appId,
            RequestType.CHANNEL_MEMBERS,
            resolve,
            reject,
            { numSub, members: localMembers },
            { opts: { channel } }
          );
        });
      });
    });
  }
  /**
   * Get a given presence channel's members count
   */
  async getChannelMembersCount(appId, channel, onlyLocal) {
    return new Promise((resolve, reject) => {
      super.getChannelMembersCount(appId, channel).then((localMembersCount) => {
        if (onlyLocal) {
          return resolve(localMembersCount);
        }
        this.getNumSub().then((numSub) => {
          if (numSub <= 1) {
            return resolve(localMembersCount);
          }
          this.sendRequest(
            appId,
            RequestType.CHANNEL_MEMBERS_COUNT,
            resolve,
            reject,
            { numSub, totalCount: localMembersCount },
            { opts: { channel } }
          );
        });
      });
    });
  }
  /**
   * Check if a given connection ID exists in a channel.
   */
  async isInChannel(appId, channel, wsId, onlyLocal) {
    return new Promise((resolve, reject) => {
      super.isInChannel(appId, channel, wsId).then((existsLocally) => {
        if (onlyLocal || existsLocally) {
          return resolve(existsLocally);
        }
        this.getNumSub().then((numSub) => {
          if (numSub <= 1) {
            return resolve(existsLocally);
          }
          return this.sendRequest(
            appId,
            RequestType.SOCKET_EXISTS_IN_CHANNEL,
            resolve,
            reject,
            { numSub },
            { opts: { channel, wsId } }
          );
        });
      });
    });
  }
  /**
   * Listen for requests coming from other nodes.
   */
  onRequest(channel, msg) {
    let request;
    try {
      request = JSON.parse(msg);
    } catch (err) {
      //
    }
    let { appId } = request;
    if (this.server.options.debug) {
      Log.clusterTitle("🧠 Received request from another node");
      Log.cluster({ request, channel });
    }
    switch (request.type) {
      case RequestType.SOCKETS:
        this.processRequestFromAnotherInstance(request, () =>
          super.getSockets(appId, true).then((sockets) => {
            let localSockets = Array.from(sockets.values());
            return {
              sockets: localSockets.map((ws) => ({
                id: ws.id,
                subscribedChannels: ws.subscribedChannels,
                presence: ws.presence,
                ip: ws.ip,
                ip2: ws.ip2,
              })),
            };
          })
        );
        break;
      case RequestType.CHANNEL_SOCKETS:
        this.processRequestFromAnotherInstance(request, () =>
          super
            .getChannelSockets(appId, request.opts.channel)
            .then((sockets) => {
              let localSockets = Array.from(sockets.values());
              return {
                sockets: localSockets.map((ws) => ({
                  id: ws.id,
                  subscribedChannels: ws.subscribedChannels,
                  presence: ws.presence,
                })),
              };
            })
        );
        break;
      case RequestType.CHANNELS:
        this.processRequestFromAnotherInstance(request, () => {
          return super.getChannels(appId).then((localChannels) => {
            return {
              channels: [...localChannels].map(([channel, connections]) => [
                channel,
                [...connections],
              ]),
            };
          });
        });
        break;
      case RequestType.CHANNELS_WITH_SOCKETS_COUNT:
        this.processRequestFromAnotherInstance(request, () => {
          return super
            .getChannelsWithSocketsCount(appId)
            .then((channelsWithSocketsCount) => {
              return {
                channelsWithSocketsCount: [...channelsWithSocketsCount],
              };
            });
        });
        break;
      case RequestType.CHANNEL_MEMBERS:
        this.processRequestFromAnotherInstance(request, () => {
          return super
            .getChannelMembers(appId, request.opts.channel)
            .then((localMembers) => {
              return { members: [...localMembers] };
            });
        });
        break;
      case RequestType.SOCKETS_COUNT:
        this.processRequestFromAnotherInstance(request, () => {
          return super.getSocketsCount(appId).then((localCount) => {
            return { totalCount: localCount };
          });
        });
        break;
      case RequestType.CHANNEL_MEMBERS_COUNT:
        this.processRequestFromAnotherInstance(request, () => {
          return super
            .getChannelMembersCount(appId, request.opts.channel)
            .then((localCount) => {
              return { totalCount: localCount };
            });
        });
        break;
      case RequestType.CHANNEL_SOCKETS_COUNT:
        this.processRequestFromAnotherInstance(request, () => {
          return super
            .getChannelSocketsCount(appId, request.opts.channel)
            .then((localCount) => {
              return { totalCount: localCount };
            });
        });
        break;
      case RequestType.SOCKET_EXISTS_IN_CHANNEL:
        this.processRequestFromAnotherInstance(request, () => {
          return super
            .isInChannel(appId, request.opts.channel, request.opts.wsId)
            .then((existsLocally) => {
              return { exists: existsLocally };
            });
        });
        break;
      case RequestType.TERMINATE_USER_CONNECTIONS:
        this.processRequestFromAnotherInstance(request, () => {
          this.terminateLocalUserConnections(appId, request.opts.userId);
          return Promise.resolve();
        });
        break;
    }
  }
  /**
   * Handle a response from another node.
   */
  onResponse(channel, msg) {
    let response;
    try {
      response = JSON.parse(msg);
    } catch (err) {
      //
    }
    const requestId = response.requestId;
    if (!requestId || !this.requests.has(requestId)) {
      return;
    }
    const request = this.requests.get(requestId);
    if (this.server.options.debug) {
      Log.clusterTitle("🧠 Received response from another node to our request");
      Log.cluster(msg);
    }
    this.processReceivedResponse(
      response,
      this.resolvers[request.type].computeResponse.bind(this),
      this.resolvers[request.type].resolveValue.bind(this)
    );
  }
  /**
   * Send a request to find more about what other subscribers
   * are storing in their memory.
   */
  sendRequest(
    appId,
    type,
    resolve,
    reject,
    requestExtra = {},
    requestOptions = {}
  ) {
    const requestId = uuidv4();
    const timeout = setTimeout(() => {
      if (this.requests.has(requestId)) {
        if (this.server.options.debug) {
          Log.error(
            `Timeout reached while waiting for response in type ${type}. Forcing resolve with the current values.`
          );
        }
        this.processReceivedResponse(
          { requestId },
          this.resolvers[type].computeResponse.bind(this),
          this.resolvers[type].resolveValue.bind(this),
          true
        );
      }
    }, this.requestsTimeout);
    // Add the request to the local memory.
    this.requests.set(requestId, {
      appId,
      type,
      time: Date.now(),
      timeout,
      msgCount: 1,
      resolve,
      reject,
      ...requestExtra,
    });
    // The message to send to other nodes.
    const requestToSend = JSON.stringify({
      requestId,
      appId,
      type,
      ...requestOptions,
    });
    this.sendToRequestChannel(requestToSend);
    if (this.server.options.debug) {
      Log.clusterTitle("✈ Sent message to other instances");
      Log.cluster({ request: this.requests.get(requestId) });
    }
    this.server.metricsManager.markHorizontalAdapterRequestSent(appId);
  }
  /**
   * Process the incoming request from other subscriber.
   */
  processRequestFromAnotherInstance(request, callbackResolver) {
    let { requestId, appId } = request;
    // Do not process requests for the same node that created the request.
    if (this.requests.has(requestId)) {
      return;
    }
    callbackResolver().then((extra) => {
      let response = JSON.stringify({ requestId, ...extra });
      this.sendToResponseChannel(response);
      if (this.server.options.debug) {
        Log.clusterTitle("✈ Sent response to the instance");
        Log.cluster({ response });
      }
      this.server.metricsManager.markHorizontalAdapterRequestReceived(appId);
    });
  }
  /**
   * Process the incoming response to a request we made.
   */
  processReceivedResponse(
    response,
    responseComputer,
    promiseResolver,
    forceResolve = false
  ) {
    const request = this.requests.get(response.requestId);
    request.msgCount++;
    responseComputer(request, response);
    this.server.metricsManager.markHorizontalAdapterResponseReceived(
      request.appId
    );
    if (forceResolve || request.msgCount === request.numSub) {
      clearTimeout(request.timeout);
      if (request.resolve) {
        request.resolve(promiseResolver(request, response));
        this.requests.delete(response.requestId);
        // If the resolve was forced, it means not all nodes fulfilled the request, thus leading to timeout.
        this.server.metricsManager.trackHorizontalAdapterResolvedPromises(
          request.appId,
          !forceResolve
        );
        this.server.metricsManager.trackHorizontalAdapterResolveTime(
          request.appId,
          Date.now() - request.time
        );
      }
    }
  }
}

module.exports = {
  RequestType,
  HorizontalAdapter,
};
