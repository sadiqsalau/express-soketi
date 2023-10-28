const async = require("async");
const { Consumer } = require("sqs-consumer");
const { SQS } = require("aws-sdk");
const { createHash } = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { Job } = require("../job");
const { Log } = require("../log");

class SqsQueueDriver {
  /**
   * Initialize the Prometheus exporter.
   */
  constructor(server) {
    this.server = server;
    /**
     * The list of consumers with their instance.
     */
    this.queueWithConsumer = new Map();
    //
  }
  /**
   * Add a new event with data to queue.
   */
  addToQueue(queueName, data) {
    return new Promise((resolve) => {
      let message = JSON.stringify(data);
      let params = {
        MessageBody: message,
        MessageDeduplicationId: createHash("sha256")
          .update(message)
          .digest("hex"),
        MessageGroupId: `${data.appId}_${queueName}`,
        QueueUrl: this.server.options.queue.sqs.queueUrl,
      };
      this.sqsClient().sendMessage(params, (err, data) => {
        if (err) {
          Log.errorTitle("❎ SQS client could not publish to the queue.");
          Log.error({ data, err, params, queueName });
        }
        if (this.server.options.debug && !err) {
          Log.successTitle("✅ SQS client publsihed message to the queue.");
          Log.success({ data, err, params, queueName });
        }
        resolve();
      });
    });
  }
  /**
   * Register the code to run when handing the queue.
   */
  processQueue(queueName, callback) {
    return new Promise((resolve) => {
      let handleMessage = ({ Body }) => {
        return new Promise((resolve) => {
          callback(new Job(uuidv4(), JSON.parse(Body)), () => {
            if (this.server.options.debug) {
              Log.successTitle("✅ SQS message processed.");
              Log.success({ Body, queueName });
            }
            resolve();
          });
        });
      };
      let consumerOptions = {
        queueUrl: this.server.options.queue.sqs.queueUrl,
        sqs: this.sqsClient(),
        batchSize: this.server.options.queue.sqs.batchSize,
        pollingWaitTimeMs: this.server.options.queue.sqs.pollingWaitTimeMs,
        ...this.server.options.queue.sqs.consumerOptions,
      };
      if (this.server.options.queue.sqs.processBatch) {
        consumerOptions.handleMessageBatch = (messages) => {
          return Promise.all(
            messages.map(({ Body }) => handleMessage({ Body }))
          ).then(() => {
            //
          });
        };
      } else {
        consumerOptions.handleMessage = handleMessage;
      }
      let consumer = Consumer.create(consumerOptions);
      consumer.start();
      this.queueWithConsumer.set(queueName, consumer);
      resolve();
    });
  }
  /**
   * Clear the queues for a graceful shutdown.
   */
  disconnect() {
    return async.each(
      [...this.queueWithConsumer],
      ([queueName, consumer], callback) => {
        if (consumer.isRunning) {
          consumer.stop();
          callback();
        }
      }
    );
  }
  /**
   * Get the SQS client.
   */
  sqsClient() {
    let sqsOptions = this.server.options.queue.sqs;
    return new SQS({
      apiVersion: "2012-11-05",
      region: sqsOptions.region || "us-east-1",
      endpoint: sqsOptions.endpoint,
      ...sqsOptions.clientOptions,
    });
  }
}

module.exports = { SqsQueueDriver };
