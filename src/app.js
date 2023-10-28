const Pusher = require("pusher");
const pusherUtil = require("pusher/lib/util");

class App {
  /**
   * Create a new app from object.
   */
  constructor(initialApp, server) {
    this.initialApp = initialApp;
    this.server = server;
    /**
     * @type {boolean}
     */
    this.enableUserAuthentication = false;
    /**
     * @type {boolean}
     */
    this.hasClientEventWebhooks = false;
    /**
     * @type {boolean}
     */
    this.hasChannelOccupiedWebhooks = false;
    /**
     * @type {boolean}
     */
    this.hasChannelVacatedWebhooks = false;
    /**
     * @type {boolean}
     */
    this.hasMemberAddedWebhooks = false;
    /**
     * @type {boolean}
     */
    this.hasMemberRemovedWebhooks = false;
    /**
     * @type {boolean}
     */
    this.hasCacheMissedWebhooks = false;
    this.id = this.extractFromPassedKeys(initialApp, ["id", "AppId"], "app-id");
    this.key = this.extractFromPassedKeys(
      initialApp,
      ["key", "AppKey"],
      "app-key"
    );
    this.secret = this.extractFromPassedKeys(
      initialApp,
      ["secret", "AppSecret"],
      "app-secret"
    );
    this.maxConnections = this.extractFromPassedKeys(
      initialApp,
      ["maxConnections", "MaxConnections", "max_connections"],
      -1
    );
    this.enableClientMessages = this.extractFromPassedKeys(
      initialApp,
      [
        "enableClientMessages",
        "EnableClientMessages",
        "enable_client_messages",
      ],
      false
    );
    this.enabled = this.extractFromPassedKeys(
      initialApp,
      ["enabled", "Enabled"],
      true
    );
    this.maxBackendEventsPerSecond = parseInt(
      this.extractFromPassedKeys(
        initialApp,
        [
          "maxBackendEventsPerSecond",
          "MaxBackendEventsPerSecond",
          "max_backend_events_per_sec",
        ],
        -1
      )
    );
    this.maxClientEventsPerSecond = parseInt(
      this.extractFromPassedKeys(
        initialApp,
        [
          "maxClientEventsPerSecond",
          "MaxClientEventsPerSecond",
          "max_client_events_per_sec",
        ],
        -1
      )
    );
    this.maxReadRequestsPerSecond = parseInt(
      this.extractFromPassedKeys(
        initialApp,
        [
          "maxReadRequestsPerSecond",
          "MaxReadRequestsPerSecond",
          "max_read_req_per_sec",
        ],
        -1
      )
    );
    this.webhooks = this.transformPotentialJsonToArray(
      this.extractFromPassedKeys(initialApp, ["webhooks", "Webhooks"], "[]")
    );
    this.maxPresenceMembersPerChannel = parseInt(
      this.extractFromPassedKeys(
        initialApp,
        [
          "maxPresenceMembersPerChannel",
          "MaxPresenceMembersPerChannel",
          "max_presence_members_per_channel",
        ],
        server.options.presence.maxMembersPerChannel
      )
    );
    this.maxPresenceMemberSizeInKb = parseFloat(
      this.extractFromPassedKeys(
        initialApp,
        [
          "maxPresenceMemberSizeInKb",
          "MaxPresenceMemberSizeInKb",
          "max_presence_member_size_in_kb",
        ],
        server.options.presence.maxMemberSizeInKb
      )
    );
    this.maxChannelNameLength = parseInt(
      this.extractFromPassedKeys(
        initialApp,
        [
          "maxChannelNameLength",
          "MaxChannelNameLength",
          "max_channel_name_length",
        ],
        server.options.channelLimits.maxNameLength
      )
    );
    this.maxEventChannelsAtOnce = parseInt(
      this.extractFromPassedKeys(
        initialApp,
        [
          "maxEventChannelsAtOnce",
          "MaxEventChannelsAtOnce",
          "max_event_channels_at_once",
        ],
        server.options.eventLimits.maxChannelsAtOnce
      )
    );
    this.maxEventNameLength = parseInt(
      this.extractFromPassedKeys(
        initialApp,
        ["maxEventNameLength", "MaxEventNameLength", "max_event_name_length"],
        server.options.eventLimits.maxNameLength
      )
    );
    this.maxEventPayloadInKb = parseFloat(
      this.extractFromPassedKeys(
        initialApp,
        [
          "maxEventPayloadInKb",
          "MaxEventPayloadInKb",
          "max_event_payload_in_kb",
        ],
        server.options.eventLimits.maxPayloadInKb
      )
    );
    this.maxEventBatchSize = parseInt(
      this.extractFromPassedKeys(
        initialApp,
        ["maxEventBatchSize", "MaxEventBatchSize", "max_event_batch_size"],
        server.options.eventLimits.maxBatchSize
      )
    );
    this.enableUserAuthentication = this.extractFromPassedKeys(
      initialApp,
      [
        "enableUserAuthentication",
        "EnableUserAuthentication",
        "enable_user_authentication",
      ],
      false
    );
    this.hasClientEventWebhooks =
      this.webhooks.filter((webhook) =>
        webhook.event_types.includes(App.CLIENT_EVENT_WEBHOOK)
      ).length > 0;
    this.hasChannelOccupiedWebhooks =
      this.webhooks.filter((webhook) =>
        webhook.event_types.includes(App.CHANNEL_OCCUPIED_WEBHOOK)
      ).length > 0;
    this.hasChannelVacatedWebhooks =
      this.webhooks.filter((webhook) =>
        webhook.event_types.includes(App.CHANNEL_VACATED_WEBHOOK)
      ).length > 0;
    this.hasMemberAddedWebhooks =
      this.webhooks.filter((webhook) =>
        webhook.event_types.includes(App.MEMBER_ADDED_WEBHOOK)
      ).length > 0;
    this.hasMemberRemovedWebhooks =
      this.webhooks.filter((webhook) =>
        webhook.event_types.includes(App.MEMBER_REMOVED_WEBHOOK)
      ).length > 0;
    this.hasCacheMissedWebhooks =
      this.webhooks.filter((webhook) =>
        webhook.event_types.includes(App.CACHE_MISSED_WEBHOOK)
      ).length > 0;
  }
  /**
   * Get the app represented as object.
   */
  toObject() {
    return {
      id: this.id,
      key: this.key,
      secret: this.secret,
      maxConnections: this.maxConnections,
      enableClientMessages: this.enableClientMessages,
      enabled: this.enabled,
      maxBackendEventsPerSecond: this.maxBackendEventsPerSecond,
      maxClientEventsPerSecond: this.maxClientEventsPerSecond,
      maxReadRequestsPerSecond: this.maxReadRequestsPerSecond,
      webhooks: this.webhooks,
      maxPresenceMembersPerChannel: this.maxPresenceMembersPerChannel,
      maxPresenceMemberSizeInKb: this.maxPresenceMemberSizeInKb,
      maxChannelNameLength: this.maxChannelNameLength,
      maxEventChannelsAtOnce: this.maxEventChannelsAtOnce,
      maxEventNameLength: this.maxEventNameLength,
      maxEventPayloadInKb: this.maxEventPayloadInKb,
      maxEventBatchSize: this.maxEventBatchSize,
      enableUserAuthentication: this.enableUserAuthentication,
    };
  }
  /**
   * Get the app represented as JSON.
   */
  toJson() {
    return JSON.stringify(this.toObject());
  }
  /**
   * Strip data off the app, usually the one that's not needed from the WS's perspective.
   * Usually used when attached to WS connections, as they don't need these details.
   */
  forWebSocket() {
    let app = new App(this.initialApp, this.server);
    // delete app.secret;
    delete app.maxBackendEventsPerSecond;
    delete app.maxReadRequestsPerSecond;
    delete app.webhooks;
    return app;
  }
  /**
   * Get the signing token from the request.
   */
  signingTokenFromRequest(res) {
    const params = {
      auth_key: this.key,
      auth_timestamp: res.locals.query.auth_timestamp,
      auth_version: res.locals.query.auth_version,
      ...res.locals.query,
    };
    delete params["auth_signature"];
    delete params["body_md5"];
    delete params["appId"];
    delete params["appKey"];
    delete params["channelName"];
    if (res.locals.rawBody || res.locals.query["body_md5"]) {
      params["body_md5"] = pusherUtil.getMD5(res.locals.rawBody || "");
    }

    return this.signingToken(
      res.locals.method,
      res.locals.path,
      pusherUtil.toOrderedArray(params).join("&")
    );
  }
  /**
   * Get the signing token for the given parameters.
   */
  signingToken(method, path, params) {
    let token = new Pusher.Token(this.key, this.secret);
    return token.sign([method, path, params].join("\n"));
  }
  /**
   * Due to cross-database schema, it's worth to search multiple fields in the app in order to assign it
   * to the local App object. For example, the local `enableClientMessages` attribute can exist as
   * enableClientMessages, enable_client_messages, or EnableClientMessages. With this function, we pass
   * the app, the list of all field posibilities, and a default value.
   * This check is done with a typeof check over undefined, to make sure that false booleans or 0 values
   * are being parsed properly and are not being ignored.
   */
  extractFromPassedKeys(app, parameters, defaultValue) {
    let extractedValue = defaultValue;
    parameters.forEach((param) => {
      if (
        typeof app[param] !== "undefined" &&
        !["", null].includes(app[param])
      ) {
        extractedValue = app[param];
      }
    });
    return extractedValue;
  }
  /**
   * If it's already an array, it returns the array. For an invalid JSON, it returns an empty array.
   * If it's a JSON-formatted string, it parses it and returns the value.
   */
  transformPotentialJsonToArray(potentialJson) {
    if (potentialJson instanceof Array) {
      return potentialJson;
    }
    try {
      let potentialArray = JSON.parse(potentialJson);
      if (potentialArray instanceof Array) {
        return potentialArray;
      }
    } catch (e) {
      //
    }
    return [];
  }
}
App.CLIENT_EVENT_WEBHOOK = "client_event";
App.CHANNEL_OCCUPIED_WEBHOOK = "channel_occupied";
App.CHANNEL_VACATED_WEBHOOK = "channel_vacated";
App.MEMBER_ADDED_WEBHOOK = "member_added";
App.MEMBER_REMOVED_WEBHOOK = "member_removed";
App.CACHE_MISSED_WEBHOOK = "cache_miss";

module.exports = { App };
