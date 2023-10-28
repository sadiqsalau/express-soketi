const async = require("async");
const { Log } = require("./log");
const { Utils } = require("./utils");

const v8 = require("v8");

class HttpHandler {
  /**
   * Initialize the HTTP handler.
   */
  constructor(server) {
    this.server = server;
    //
  }
  ready(res) {
    this.attachMiddleware(res, [this.corkMiddleware, this.corsMiddleware]).then(
      (res) => {
        if (this.server.closing) {
          this.serverErrorResponse(
            res,
            "The server is closing. Choose another server. :)"
          );
        } else {
          this.send(res, "OK");
        }
      }
    );
  }
  acceptTraffic(res) {
    this.attachMiddleware(res, [this.corsMiddleware]).then((res) => {
      if (this.server.closing) {
        return this.serverErrorResponse(
          res,
          "The server is closing. Choose another server. :)"
        );
      }

      let threshold = this.server.options.httpApi.acceptTraffic.memoryThreshold;
      let { rss, heapTotal, external, arrayBuffers } = process.memoryUsage();
      let totalSize = v8.getHeapStatistics().total_available_size;
      let usedSize = rss + heapTotal + external + arrayBuffers;
      let percentUsage = (usedSize / totalSize) * 100;
      if (threshold < percentUsage) {
        return this.serverErrorResponse(
          res,
          "Low on memory here. Choose another server. :)"
        );
      }
      this.sendJson(res, {
        memory: {
          usedSize,
          totalSize,
          percentUsage,
        },
      });
    });
  }
  healthCheck(res) {
    this.attachMiddleware(res, [this.corkMiddleware, this.corsMiddleware]).then(
      (res) => {
        this.send(res, "OK");
      }
    );
  }
  usage(res) {
    this.attachMiddleware(res, [this.corkMiddleware, this.corsMiddleware]).then(
      (res) => {
        let { rss, heapTotal, external, arrayBuffers } = process.memoryUsage();
        let totalSize = v8.getHeapStatistics().total_available_size;
        let usedSize = rss + heapTotal + external + arrayBuffers;
        let freeSize = totalSize - usedSize;
        let percentUsage = (usedSize / totalSize) * 100;
        return this.sendJson(res, {
          memory: {
            free: freeSize,
            used: usedSize,
            total: totalSize,
            percent: percentUsage,
          },
        });
      }
    );
  }
  metrics(res) {
    this.attachMiddleware(res, [this.corkMiddleware, this.corsMiddleware]).then(
      (res) => {
        let handleError = (err) => {
          this.serverErrorResponse(res, "A server error has occurred.");
        };
        if (res.locals.query.json) {
          this.server.metricsManager
            .getMetricsAsJson()
            .then((metrics) => {
              this.sendJson(res, metrics);
            })
            .catch(handleError);
        } else {
          this.server.metricsManager
            .getMetricsAsPlaintext()
            .then((metrics) => {
              this.send(res, metrics);
            })
            .catch(handleError);
        }
      }
    );
  }
  channels(res) {
    this.attachMiddleware(res, [
      this.corkMiddleware,
      this.corsMiddleware,
      this.appMiddleware,
      this.authMiddleware,
      this.readRateLimitingMiddleware,
    ]).then((res) => {
      this.server.adapter
        .getChannelsWithSocketsCount(res.locals.params.appId)
        .then((channels) => {
          let response = [...channels].reduce(
            (channels, [channel, connections]) => {
              if (connections === 0) {
                return channels;
              }
              // In case ?filter_by_prefix= is specified, the channel must start with that prefix.
              if (
                res.locals.query.filter_by_prefix &&
                !channel.startsWith(res.locals.query.filter_by_prefix)
              ) {
                return channels;
              }
              channels[channel] = {
                subscription_count: connections,
                occupied: true,
              };
              return channels;
            },
            {}
          );
          return response;
        })
        .catch((err) => {
          Log.error(err);
          return this.serverErrorResponse(res, "A server error has occurred.");
        })
        .then((channels) => {
          let broadcastMessage = { channels };
          this.server.metricsManager.markApiMessage(
            res.locals.params.appId,
            {},
            broadcastMessage
          );
          this.sendJson(res, broadcastMessage);
        });
    });
  }
  channel(res) {
    this.attachMiddleware(res, [
      this.corkMiddleware,
      this.corsMiddleware,
      this.appMiddleware,
      this.authMiddleware,
      this.readRateLimitingMiddleware,
    ]).then((res) => {
      let response;
      this.server.adapter
        .getChannelSocketsCount(
          res.locals.params.appId,
          res.locals.params.channel
        )
        .then((socketsCount) => {
          response = {
            subscription_count: socketsCount,
            occupied: socketsCount > 0,
          };
          // For presence channels, attach an user_count.
          // Avoid extra call to get channel members if there are no sockets.
          if (res.locals.params.channel.startsWith("presence-")) {
            response.user_count = 0;
            if (response.subscription_count > 0) {
              this.server.adapter
                .getChannelMembersCount(
                  res.locals.params.appId,
                  res.locals.params.channel
                )
                .then((membersCount) => {
                  let broadcastMessage = {
                    ...response,
                    ...{
                      user_count: membersCount,
                    },
                  };
                  this.server.metricsManager.markApiMessage(
                    res.locals.params.appId,
                    {},
                    broadcastMessage
                  );
                  this.sendJson(res, broadcastMessage);
                })
                .catch((err) => {
                  Log.error(err);
                  return this.serverErrorResponse(
                    res,
                    "A server error has occurred."
                  );
                });
              return;
            }
          }
          this.server.metricsManager.markApiMessage(
            res.locals.params.appId,
            {},
            response
          );
          return this.sendJson(res, response);
        })
        .catch((err) => {
          Log.error(err);
          return this.serverErrorResponse(res, "A server error has occurred.");
        });
    });
  }
  channelUsers(res) {
    this.attachMiddleware(res, [
      this.corkMiddleware,
      this.corsMiddleware,
      this.appMiddleware,
      this.authMiddleware,
      this.readRateLimitingMiddleware,
    ]).then((res) => {
      if (!res.locals.params.channel.startsWith("presence-")) {
        return this.badResponse(res, "The channel must be a presence channel.");
      }
      this.server.adapter
        .getChannelMembers(res.locals.params.appId, res.locals.params.channel)
        .then((members) => {
          let broadcastMessage = {
            users: [...members].map(([user_id, user_info]) => {
              return res.locals.query.with_user_info === "1"
                ? { id: user_id, user_info }
                : { id: user_id };
            }),
          };
          this.server.metricsManager.markApiMessage(
            res.locals.params.appId,
            {},
            broadcastMessage
          );
          this.sendJson(res, broadcastMessage);
        });
    });
  }
  events(res) {
    this.attachMiddleware(res, [
      this.corkMiddleware,
      this.jsonBodyMiddleware,
      this.corsMiddleware,
      this.appMiddleware,
      this.authMiddleware,
      this.broadcastEventRateLimitingMiddleware,
    ]).then((res) => {
      this.checkMessageToBroadcast(res.locals.body, res.locals.app)
        .then((message) => {
          this.broadcastMessage(message, res.locals.app.id);
          this.server.metricsManager.markApiMessage(
            res.locals.app.id,
            res.locals.body,
            {
              ok: true,
            }
          );
          this.sendJson(res, { ok: true });
        })
        .catch((error) => {
          if (error.code === 400) {
            this.badResponse(res, error.message);
          } else if (error.code === 413) {
            this.entityTooLargeResponse(res, error.message);
          }
        });
    });
  }
  batchEvents(res) {
    this.attachMiddleware(res, [
      this.jsonBodyMiddleware,
      this.corsMiddleware,
      this.appMiddleware,
      this.authMiddleware,
      this.broadcastBatchEventsRateLimitingMiddleware,
    ]).then((res) => {
      let batch = res.locals.body.batch;
      // Make sure the batch size is not too big.
      if (batch.length > res.locals.app.maxEventBatchSize) {
        return this.badResponse(
          res,
          `Cannot batch-send more than ${res.locals.app.maxEventBatchSize} messages at once`
        );
      }
      Promise.all(
        batch.map((message) =>
          this.checkMessageToBroadcast(message, res.locals.app)
        )
      )
        .then((messages) => {
          messages.forEach((message) =>
            this.broadcastMessage(message, res.locals.app.id)
          );
          this.server.metricsManager.markApiMessage(
            res.locals.app.id,
            res.locals.body,
            {
              ok: true,
            }
          );
          this.sendJson(res, { ok: true });
        })
        .catch((error) => {
          if (error.code === 400) {
            this.badResponse(res, error.message);
          } else if (error.code === 413) {
            this.entityTooLargeResponse(res, error.message);
          }
        });
    });
  }
  terminateUserConnections(res) {
    this.attachMiddleware(res, [
      this.jsonBodyMiddleware,
      this.corsMiddleware,
      this.appMiddleware,
      this.authMiddleware,
    ]).then((res) => {
      this.server.adapter.terminateUserConnections(
        res.locals.app.id,
        res.locals.params.userId
      );
      this.sendJson(res, { ok: true });
    });
  }
  checkMessageToBroadcast(message, app) {
    return new Promise((resolve, reject) => {
      if (
        (!message.channels && !message.channel) ||
        !message.name ||
        !message.data
      ) {
        return reject({
          message: "The received data is incorrect",
          code: 400,
        });
      }
      let channels = message.channels || [message.channel];
      message.channels = channels;
      // Make sure the channels length is not too big.
      if (channels.length > app.maxEventChannelsAtOnce) {
        return reject({
          message: `Cannot broadcast to more than ${app.maxEventChannelsAtOnce} channels at once`,
          code: 400,
        });
      }
      // Make sure the event name length is not too big.
      if (message.name.length > app.maxEventNameLength) {
        return reject({
          message: `Event name is too long. Maximum allowed size is ${app.maxEventNameLength}.`,
          code: 400,
        });
      }
      let payloadSizeInKb = Utils.dataToKilobytes(message.data);
      // Make sure the total payload of the message body is not too big.
      if (payloadSizeInKb > parseFloat(app.maxEventPayloadInKb)) {
        return reject({
          message: `The event data should be less than ${app.maxEventPayloadInKb} KB.`,
          code: 413,
        });
      }
      resolve(message);
    });
  }
  broadcastMessage(message, appId) {
    message.channels.forEach((channel) => {
      let msg = {
        event: message.name,
        channel,
        data: message.data,
      };
      this.server.adapter.send(
        appId,
        channel,
        JSON.stringify(msg),
        message.socket_id
      );
      if (Utils.isCachingChannel(channel)) {
        this.server.cacheManager.set(
          `app:${appId}:channel:${channel}:cache_miss`,
          JSON.stringify({ event: msg.event, data: msg.data }),
          this.server.options.channelLimits.cacheTtl
        );
      }
    });
  }
  notFound(res) {
    try {
      this.attachMiddleware(res, [
        this.corkMiddleware,
        this.corsMiddleware,
      ]).then((res) => {
        this.send(res, "", 404);
      });
    } catch (e) {
      Log.warningTitle("Response could not be sent");
      Log.warning(e);
    }
  }
  badResponse(res, error) {
    return this.sendJson(res, { error, code: 400 }, 400);
  }
  notFoundResponse(res, error) {
    return this.sendJson(res, { error, code: 404 }, 404);
  }
  unauthorizedResponse(res, error) {
    return this.sendJson(res, { error, code: 401 }, 401);
  }
  entityTooLargeResponse(res, error) {
    return this.sendJson(res, { error, code: 413 }, 413);
  }
  tooManyRequestsResponse(res) {
    return this.sendJson(res, { error: "Too many requests.", code: 429 }, 429);
  }
  serverErrorResponse(res, error) {
    return this.sendJson(res, { error, code: 500 }, 500);
  }
  jsonBodyMiddleware(res, next) {
    /** Handled in express */
    next(null, res);
  }
  corkMiddleware(res, next) {
    next(null, res);
  }
  corsMiddleware(res, next) {
    res.set(
      "Access-Control-Allow-Origin",
      this.server.options.cors.origin.join(", ")
    );
    res.set(
      "Access-Control-Allow-Methods",
      this.server.options.cors.methods.join(", ")
    );
    res.set(
      "Access-Control-Allow-Headers",
      this.server.options.cors.allowedHeaders.join(", ")
    );
    next(null, res);
  }
  appMiddleware(res, next) {
    return this.server.appManager
      .findById(res.locals.params.appId)
      .then((validApp) => {
        if (!validApp) {
          return this.notFoundResponse(
            res,
            `The app ${res.locals.params.appId} could not be found.`
          );
        }
        res.locals.app = validApp;
        next(null, res);
      });
  }
  authMiddleware(res, next) {
    this.signatureIsValid(res).then((valid) => {
      if (valid) {
        return next(null, res);
      }
      return this.unauthorizedResponse(res, "The secret authentication failed");
    });
  }
  readRateLimitingMiddleware(res, next) {
    this.server.rateLimiter
      .consumeReadRequestsPoints(1, res.locals.app)
      .then((response) => {
        if (response.canContinue) {
          for (let header in response.headers) {
            res.set(header, "" + response.headers[header]);
          }
          return next(null, res);
        }
        this.tooManyRequestsResponse(res);
      });
  }
  broadcastEventRateLimitingMiddleware(res, next) {
    let channels = res.locals.body.channels || [res.locals.body.channel];
    this.server.rateLimiter
      .consumeBackendEventPoints(Math.max(channels.length, 1), res.locals.app)
      .then((response) => {
        if (response.canContinue) {
          for (let header in response.headers) {
            res.set(header, "" + response.headers[header]);
          }
          return next(null, res);
        }
        this.tooManyRequestsResponse(res);
      });
  }
  broadcastBatchEventsRateLimitingMiddleware(res, next) {
    let rateLimiterPoints = res.locals.body.batch.reduce(
      (rateLimiterPoints, event) => {
        let channels = event.channels || [event.channel];
        return (rateLimiterPoints += channels.length);
      },
      0
    );
    this.server.rateLimiter
      .consumeBackendEventPoints(rateLimiterPoints, res.locals.app)
      .then((response) => {
        if (response.canContinue) {
          for (let header in response.headers) {
            res.set(header, "" + response.headers[header]);
          }
          return next(null, res);
        }
        this.tooManyRequestsResponse(res);
      });
  }
  attachMiddleware(res, functions) {
    return new Promise((resolve, reject) => {
      let waterfallInit = (callback) => callback(null, res);
      let abortHandlerMiddleware = (res, callback) => {
        res.on("close", () => {
          if (!res.writableFinished) {
            Log.warning({ message: "Aborted request.", res });
            // this.serverErrorResponse(res, 'Aborted request.');
          }
        });
        callback(null, res);
      };
      async.waterfall(
        [
          waterfallInit.bind(this),
          abortHandlerMiddleware.bind(this),
          ...functions.map((fn) => fn.bind(this)),
        ],
        (err, res) => {
          if (err) {
            this.serverErrorResponse(res, "A server error has occurred.");
            Log.error(err);
            return reject({ res, err });
          }
          resolve(res);
        }
      );
    });
  }

  /**
   * Check is an incoming request can access the api.
   */
  signatureIsValid(res) {
    return this.getSignedToken(res).then((token) => {
      return token === res.locals.query.auth_signature;
    });
  }
  sendJson(res, data, status = 200) {
    try {
      return res.status(status).json(data);
    } catch (e) {
      Log.warningTitle("Response could not be sent");
      Log.warning(e);
    }
  }
  send(res, data, status = 200) {
    try {
      return res.status(status).send(data);
    } catch (e) {
      Log.warningTitle("Response could not be sent");
      Log.warning(e);
    }
  }
  /**
   * Get the signed token from the given request.
   */
  getSignedToken(res) {
    return Promise.resolve(res.locals.app.signingTokenFromRequest(res));
  }
}

module.exports = { HttpHandler };
