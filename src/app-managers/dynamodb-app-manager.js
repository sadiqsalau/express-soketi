const { DynamoDB } = require("aws-sdk");
const { boolean } = require("boolean");
const { App } = require("../app");
const { BaseAppManager } = require("./base-app-manager");
const { Log } = require("../log");

class DynamoDbAppManager extends BaseAppManager {
  /**
   * Create a new app manager instance.
   */
  constructor(server) {
    super();
    this.server = server;
    this.dynamodb = new DynamoDB({
      apiVersion: "2012-08-10",
      region: server.options.appManager.dynamodb.region,
      endpoint: server.options.appManager.dynamodb.endpoint,
    });
  }
  /**
   * Find an app by given ID.
   */
  findById(id) {
    return this.dynamodb
      .getItem({
        TableName: this.server.options.appManager.dynamodb.table,
        Key: {
          AppId: { S: id },
        },
      })
      .promise()
      .then((response) => {
        let item = response.Item;
        if (!item) {
          if (this.server.options.debug) {
            Log.error(`App ID not found: ${id}`);
          }
          return null;
        }
        return new App(this.unmarshallItem(item), this.server);
      })
      .catch((err) => {
        if (this.server.options.debug) {
          Log.error("Error loading app config from dynamodb");
          Log.error(err);
        }
        return null;
      });
  }
  /**
   * Find an app by given key.
   */
  findByKey(key) {
    return this.dynamodb
      .query({
        TableName: this.server.options.appManager.dynamodb.table,
        IndexName: "AppKeyIndex",
        ScanIndexForward: false,
        Limit: 1,
        KeyConditionExpression: "AppKey = :app_key",
        ExpressionAttributeValues: {
          ":app_key": { S: key },
        },
      })
      .promise()
      .then((response) => {
        let item = response.Items[0] || null;
        if (!item) {
          if (this.server.options.debug) {
            Log.error(`App key not found: ${key}`);
          }
          return null;
        }
        return new App(this.unmarshallItem(item), this.server);
      })
      .catch((err) => {
        if (this.server.options.debug) {
          Log.error("Error loading app config from dynamodb");
          Log.error(err);
        }
        return null;
      });
  }
  /**
   * Transform the marshalled item to a key-value pair.
   */
  unmarshallItem(item) {
    let appObject = DynamoDB.Converter.unmarshall(item);
    // Making sure EnableClientMessages is boolean.
    if (appObject.EnableClientMessages instanceof Buffer) {
      appObject.EnableClientMessages = boolean(
        appObject.EnableClientMessages.toString()
      );
    }
    // JSON-decoding the Webhooks field.
    if (typeof appObject.Webhooks === "string") {
      try {
        appObject.Webhooks = JSON.parse(appObject.Webhooks);
      } catch (e) {
        appObject.Webhooks = [];
      }
    }
    return appObject;
  }
}

module.exports = { DynamoDbAppManager };
