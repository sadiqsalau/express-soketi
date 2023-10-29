const dot = require("dot-wild");
const { v4: uuidv4 } = require("uuid");
const { Adapter } = require("./adapters");
const { AppManager } = require("./app-managers");
const { CacheManager } = require("./cache-managers/cache-manager");
const { HttpHandler } = require("./http-handler");
const { Log } = require("./log");
const { Metrics } = require("./metrics");
const { Queue } = require("./queues/queue");
const { RateLimiter } = require("./rate-limiters/rate-limiter");
const { WebhookSender } = require("./webhook-sender");
const { WsHandler } = require("./ws-handler");

const express = require("express");
const expressWs = require("express-ws");
const Discover = require("node-discover");

const fs = require("fs");
const http = require("http");
const https = require("https");

class Server {
  /**
   * Initialize the server.
   */
  constructor(options = {}) {
    /**
     * The list of options for the server.
     */
    this.options = {
      adapter: {
        driver: "local",
        redis: {
          requestsTimeout: 5000,
          prefix: "",
          redisPubOptions: {
            //
          },
          redisSubOptions: {
            //
          },
          clusterMode: false,
        },
        cluster: {
          requestsTimeout: 5000,
        },
        nats: {
          requestsTimeout: 5000,
          prefix: "",
          servers: ["127.0.0.1:4222"],
          user: null,
          pass: null,
          token: null,
          timeout: 10000,
          nodesNumber: null,
        },
      },
      appManager: {
        driver: "array",
        cache: {
          enabled: false,
          ttl: -1,
        },
        array: {
          apps: [
            {
              id: "app-id",
              key: "app-key",
              secret: "app-secret",
              maxConnections: -1,
              enableClientMessages: false,
              enabled: true,
              maxBackendEventsPerSecond: -1,
              maxClientEventsPerSecond: -1,
              maxReadRequestsPerSecond: -1,
              webhooks: [],
            },
          ],
        },
        dynamodb: {
          table: "apps",
          region: "us-east-1",
          endpoint: null,
        },
        mysql: {
          table: "apps",
          version: "8.0",
          useMysql2: false,
        },
        postgres: {
          table: "apps",
          version: "13.3",
        },
      },
      cache: {
        driver: "memory",
        redis: {
          redisOptions: {
            //
          },
          clusterMode: false,
        },
      },
      channelLimits: {
        maxNameLength: 200,
        cacheTtl: 3600,
      },
      cluster: {
        hostname: "0.0.0.0",
        helloInterval: 500,
        checkInterval: 500,
        nodeTimeout: 2000,
        masterTimeout: 2000,
        port: 11002,
        prefix: "",
        ignoreProcess: true,
        broadcast: "255.255.255.255",
        unicast: null,
        multicast: null,
      },
      cors: {
        credentials: true,
        origin: ["*"],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Origin",
          "Content-Type",
          "X-Auth-Token",
          "X-Requested-With",
          "Accept",
          "Authorization",
          "X-CSRF-TOKEN",
          "XSRF-TOKEN",
          "X-Socket-Id",
        ],
      },
      database: {
        mysql: {
          host: "127.0.0.1",
          port: 3306,
          user: "root",
          password: "password",
          database: "main",
        },
        postgres: {
          host: "127.0.0.1",
          port: 5432,
          user: "postgres",
          password: "password",
          database: "main",
        },
        redis: {
          host: "127.0.0.1",
          port: 6379,
          db: 0,
          username: null,
          password: null,
          keyPrefix: "",
          sentinels: null,
          sentinelPassword: null,
          name: "mymaster",
          clusterNodes: [],
        },
      },
      databasePooling: {
        enabled: false,
        min: 0,
        max: 7,
      },
      debug: false,
      eventLimits: {
        maxChannelsAtOnce: 100,
        maxNameLength: 200,
        maxPayloadInKb: 100,
        maxBatchSize: 10,
      },
      host: "0.0.0.0",
      httpApi: {
        requestLimitInMb: 100,
        acceptTraffic: {
          memoryThreshold: 85,
        },
      },
      instance: {
        process_id: process.pid || uuidv4(),
      },
      metrics: {
        enabled: false,
        driver: "prometheus",
        host: "0.0.0.0",
        prometheus: {
          prefix: "soketi_",
        },
        port: 9601,
      },
      mode: "full",
      port: 6001,
      pathPrefix: "",
      presence: {
        maxMembersPerChannel: 100,
        maxMemberSizeInKb: 2,
      },
      queue: {
        driver: "sync",
        redis: {
          concurrency: 1,
          redisOptions: {
            //
          },
          clusterMode: false,
        },
        sqs: {
          region: "us-east-1",
          endpoint: null,
          clientOptions: {},
          consumerOptions: {},
          queueUrl: "",
          processBatch: false,
          batchSize: 1,
          pollingWaitTimeMs: 0,
        },
      },
      rateLimiter: {
        driver: "local",
        redis: {
          redisOptions: {
            //
          },
          clusterMode: false,
        },
      },
      shutdownGracePeriod: 3000,
      ssl: {
        certPath: "",
        keyPath: "",
        passphrase: "",
        caPath: "",
      },
      userAuthenticationTimeout: 30000,
      webhooks: {
        batching: {
          enabled: false,
          duration: 50,
        },
      },
    };
    /**
     * Wether the server is closing or not.
     */
    this.closing = false;
    /**
     * Wether the server is running under PM2.
     */
    this.pm2 = false;
    /**
     * The list of nodes in the current private network.
     */
    this.nodes = new Map();
    this.setOptions(options);
  }
  /**
   * Start the server statically.
   */
  static async start(options = {}, callback) {
    return new Server(options).start(callback);
  }
  /**
   * Start the server.
   */
  async start(callback) {
    Log.br();

    this.configureDiscovery().then(() => {
      this.initializeDrivers().then(() => {
        if (this.options.debug) {
          console.dir(this.options, { depth: 100 });
        }
        this.wsHandler = new WsHandler(this);
        this.httpHandler = new HttpHandler(this);

        if (this.options.debug) {
          Log.info("📡 soketi initialization....");
          Log.info("⚡ Initializing the HTTP API & Websockets Server...");
        }

        /** Initiate server */
        let serverApp = express();
        let serverRouter = express.Router();

        /** Create HTTP\HTTPS server instance  */
        this.serverInstance = this.createServerInstance(serverApp);

        /** Add websocket */
        let serverAppWs = expressWs(serverApp, this.serverInstance, {
          wsOptions: {
            maxPayload: 100 * 1024 * 1024,
          },
        });

        /** Apply Json Middleware */
        serverApp.use(
          express.json({
            limit: this.options.httpApi.requestLimitInMb * 1024 * 1024,
            verify: (req, res, buf) => {
              req.rawBody = buf;
            },
          })
        );

        /** Apply Websocket to server router */
        serverAppWs.applyTo(serverRouter);

        /** Mount server router */
        serverApp.use(this.options.pathPrefix, serverRouter);

        if (this.options.debug) {
          Log.info("⚡ Initializing the Websocket listeners and channels...");
        }

        /** Configure server router */
        this.configureWebsockets(serverRouter).then((serverRouter) => {
          this.configureHttp(serverRouter).then(() => {
            /** Configure metrics */
            if (this.options.metrics.enabled) {
              let metricsServerApp = express();
              let metricsServerRouter = express.Router();

              /** Mount metrics server router */
              metricsServerApp.use(
                this.options.pathPrefix,
                metricsServerRouter
              );

              /** Create metrics server instance */
              this.metricsServerInstance = http.createServer(metricsServerApp);

              this.configureMetricsServer(metricsServerRouter).then(() => {
                this.metricsServerInstance.listen(
                  this.options.metrics.port,
                  this.options.metrics.host,
                  () => this.listen(callback)
                );
              });
            } else {
              this.listen(callback);
            }
          });
        });
      });
    });
  }

  createServerInstance(serverApp) {
    return this.shouldConfigureSsl()
      ? https.createServer(
          {
            key: fs.readFileSync(this.options.ssl.keyPath),
            cert: fs.readFileSync(this.options.ssl.certPath),
            ca: fs.readFileSync(this.options.ssl.caPath),
            passphrase: this.options.ssl.passphrase,
          },
          serverApp
        )
      : http.createServer(serverApp);
  }

  listen(callback) {
    if (this.options.debug) {
      Log.info("⚡ Initializing the HTTP webserver...");
    }

    this.serverInstance.listen(this.options.port, this.options.host, () => {
      Log.successTitle("🎉 Server is up and running!");

      Log.successTitle(
        `📡 The Websockets server is available at 127.0.0.1:${this.options.port}`
      );

      Log.successTitle(
        `🔗 The HTTP API server is available at http://127.0.0.1:${this.options.port}`
      );

      if (this.options.metrics.enabled) {
        Log.successTitle(
          `🎊 The /usage endpoint is available on port ${this.options.metrics.port}.`
        );

        Log.successTitle(
          `🌠 Prometheus /metrics endpoint is available on port ${this.options.metrics.port}.`
        );
      }

      Log.br();

      if (callback) {
        callback(this);
      }
    });
  }

  /**
   * Stop the server.
   */
  stop() {
    this.closing = true;
    Log.br();
    Log.warning(
      "🚫 New users cannot connect to this instance anymore. Preparing for signaling..."
    );
    Log.warning(
      "⚡ The server is closing and signaling the existing connections to terminate."
    );
    Log.br();
    return this.wsHandler.closeAllLocalSockets().then(() => {
      return new Promise((resolve) => {
        if (this.options.debug) {
          Log.warningTitle(
            "⚡ All sockets were closed. Now closing the server."
          );
        }
        setTimeout(() => {
          Promise.all([
            this.metricsManager.clear(),
            this.queueManager.disconnect(),
            this.rateLimiter.disconnect(),
            this.cacheManager.disconnect(),
          ]).then(() => {
            this.adapter
              .disconnect()
              .then(() => {
                if (this.serverInstance) {
                  this.serverInstance.close();
                }
                if (this.metricsServerInstance) {
                  this.metricsServerInstance.close();
                }
              })
              .then(() => resolve());
          });
        }, this.options.shutdownGracePeriod);
      });
    });
  }
  /**
   * Set the options for the server. The key should be string.
   * For nested values, use the dot notation.
   */
  setOptions(options) {
    for (let optionKey in options) {
      // Make sure none of the id's are int.
      if (optionKey.match("^appManager.array.apps.\\d+.id")) {
        if (Number.isInteger(options[optionKey])) {
          options[optionKey] = options[optionKey].toString();
        }
      }
      this.options = dot.set(this.options, optionKey, options[optionKey]);
    }
  }
  /**
   * Initialize the drivers for the server.
   */
  initializeDrivers() {
    return Promise.all([
      this.setAppManager(new AppManager(this)),
      this.setAdapter(new Adapter(this)),
      this.setMetricsManager(new Metrics(this)),
      this.setRateLimiter(new RateLimiter(this)),
      this.setQueueManager(new Queue(this)),
      this.setCacheManager(new CacheManager(this)),
      this.setWebhookSender(),
    ]);
  }
  /**
   * Set the app manager.
   */
  setAppManager(instance) {
    this.appManager = instance;
  }
  /**
   * Set the adapter.
   */
  setAdapter(instance) {
    return new Promise((resolve) => {
      instance.init().then(() => {
        this.adapter = instance;
        resolve();
      });
    });
  }
  /**
   * Set the metrics manager.
   */
  setMetricsManager(instance) {
    return new Promise((resolve) => {
      this.metricsManager = instance;
      resolve();
    });
  }
  /**
   * Set the rate limiter.
   */
  setRateLimiter(instance) {
    return new Promise((resolve) => {
      this.rateLimiter = instance;
      resolve();
    });
  }
  /**
   * Set the queue manager.
   */
  setQueueManager(instance) {
    return new Promise((resolve) => {
      this.queueManager = instance;
      resolve();
    });
  }
  /**
   * Set the cache manager.
   */
  setCacheManager(instance) {
    return new Promise((resolve) => {
      this.cacheManager = instance;
      resolve();
    });
  }
  /**
   * Set the webhook sender.
   */
  setWebhookSender() {
    return new Promise((resolve) => {
      this.webhookSender = new WebhookSender(this);
      resolve();
    });
  }
  /**
   * Generates the URL with the set pathPrefix from options.
   */
  url(path) {
    return path;
  }
  /**
   * Get the cluster prefix name for discover.
   */
  clusterPrefix(channel) {
    if (this.options.cluster.prefix) {
      channel = this.options.cluster.prefix + "#" + channel;
    }
    return channel;
  }
  /**
   * Configure the private network discovery for this node.
   */
  configureDiscovery() {
    return new Promise((resolve) => {
      this.discover = Discover(this.options.cluster, () => {
        this.nodes.set("self", this.discover.me);
        this.discover.on("promotion", () => {
          this.nodes.set("self", this.discover.me);
          if (this.options.debug) {
            Log.discoverTitle("Promoted from node to master.");
            Log.discover(this.discover.me);
          }
        });
        this.discover.on("demotion", () => {
          this.nodes.set("self", this.discover.me);
          if (this.options.debug) {
            Log.discoverTitle("Demoted from master to node.");
            Log.discover(this.discover.me);
          }
        });
        this.discover.on("added", (node) => {
          this.nodes.set("self", this.discover.me);
          this.nodes.set(node.id, node);
          if (this.options.debug) {
            Log.discoverTitle("New node added.");
            Log.discover(node);
          }
        });
        this.discover.on("removed", (node) => {
          this.nodes.set("self", this.discover.me);
          this.nodes.delete(node.id);
          if (this.options.debug) {
            Log.discoverTitle("Node removed.");
            Log.discover(node);
          }
        });
        this.discover.on("master", (node) => {
          this.nodes.set("self", this.discover.me);
          this.nodes.set(node.id, node);
          if (this.options.debug) {
            Log.discoverTitle("New master.");
            Log.discover(node);
          }
        });
        resolve();
      });
    });
  }
  /**
   * Configure the WebSocket logic.
   */
  configureWebsockets(serverRouter) {
    return new Promise((resolve) => {
      if (this.canProcessRequests()) {
        serverRouter = serverRouter.ws(this.url("/app/:id"), (ws, req) => {
          /** Configure the websocket */
          this.wsHandler.configureWs(ws, req.params.id);

          ws.on("message", (message) => {
            this.wsHandler.onMessage(ws, message);
          });

          ws.on("close", () => {
            this.wsHandler.onClose(ws);
          });
        });
      }
      resolve(serverRouter);
    });
  }
  /**
   * Configure the HTTP REST API server.
   */
  configureHttp(serverRouter) {
    return new Promise((resolve) => {
      serverRouter.get(this.url("/"), (req, res) =>
        this.httpHandler.healthCheck(res)
      );
      serverRouter.get(this.url("/ready"), (req, res) =>
        this.httpHandler.ready(res)
      );

      if (this.canProcessRequests()) {
        serverRouter.get(this.url("/accept-traffic"), (req, res) =>
          this.httpHandler.acceptTraffic(res)
        );

        serverRouter.get(this.url("/apps/:appId/channels"), (req, res) => {
          res.locals.params = { appId: req.params.appId };
          res.locals.query = req.query;
          res.locals.method = req.method;
          res.locals.path = req.path;

          return this.httpHandler.channels(res);
        });

        serverRouter.get(
          this.url("/apps/:appId/channels/:channel"),
          (req, res) => {
            res.locals.params = {
              appId: req.params.appId,
              channel: req.params.channel,
            };
            res.locals.query = req.query;
            res.locals.method = req.method;
            res.locals.path = req.path;

            return this.httpHandler.channel(res);
          }
        );

        serverRouter.get(
          this.url("/apps/:appId/channels/:channel/users"),
          (req, res) => {
            res.locals.params = {
              appId: req.params.appId,
              channel: req.params.channel,
            };
            res.locals.query = req.query;
            res.locals.method = req.method;
            res.locals.path = req.path;

            return this.httpHandler.channelUsers(res);
          }
        );
        serverRouter.post(this.url("/apps/:appId/events"), (req, res) => {
          res.locals.params = { appId: req.params.appId };
          res.locals.query = req.query;
          res.locals.method = req.method;
          res.locals.path = req.path;
          res.locals.body = req.body;
          res.locals.rawBody = req.rawBody;

          return this.httpHandler.events(res);
        });

        serverRouter.post(this.url("/apps/:appId/batch_events"), (req, res) => {
          res.locals.params = { appId: req.params.appId };
          res.locals.query = req.query;
          res.locals.method = req.method;
          res.locals.path = req.path;
          res.locals.body = req.body;
          res.locals.rawBody = req.rawBody;

          return this.httpHandler.batchEvents(res);
        });

        serverRouter.post(
          this.url("/apps/:appId/users/:userId/terminate_connections"),
          (req, res) => {
            res.locals.params = {
              appId: req.params.appId,
              userId: req.params.userId,
            };
            res.locals.query = req.query;
            res.locals.method = req.method;
            res.locals.path = req.path;
            res.locals.body = req.body;
            res.locals.rawBody = req.rawBody;

            return this.httpHandler.terminateUserConnections(res);
          }
        );
      }
      serverRouter.all(this.url("/*"), (req, res) => {
        return this.httpHandler.notFound(res);
      });
      resolve(serverRouter);
    });
  }

  /**
   * Configure the metrics server at a separate port for under-the-firewall access.
   */
  configureMetricsServer(metricsServerRouter) {
    return new Promise((resolve) => {
      Log.info("🕵️‍♂️ Initiating metrics endpoints...");
      Log.br();

      metricsServerRouter.get(this.url("/"), (req, res) =>
        this.httpHandler.healthCheck(res)
      );
      metricsServerRouter.get(this.url("/ready"), (req, res) =>
        this.httpHandler.ready(res)
      );
      metricsServerRouter.get(this.url("/usage"), (req, res) =>
        this.httpHandler.usage(res)
      );

      metricsServerRouter.get(this.url("/metrics"), (req, res) => {
        res.locals.query = req.query;

        return this.httpHandler.metrics(res);
      });
      resolve(metricsServerRouter);
    });
  }
  /**
   * Wether the server should start in SSL mode.
   */
  shouldConfigureSsl() {
    return this.options.ssl.certPath !== "" || this.options.ssl.keyPath !== "";
  }
  /**
   * Check if the server instance can process queues.
   */
  canProcessQueues() {
    return ["worker", "full"].includes(this.options.mode);
  }
  /**
   * Check if the server instance can process requests
   * for the Pusher protocol API (both REST and WebSockets).
   */
  canProcessRequests() {
    return ["server", "full"].includes(this.options.mode);
  }
}

module.exports = { Server };
