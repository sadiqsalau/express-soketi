const { Log } = require("../log");
const { RedisQueueDriver } = require("./redis-queue-driver");
const { SqsQueueDriver } = require("./sqs-queue-driver");
const { SyncQueueDriver } = require("./sync-queue-driver");

class Queue {
  /**
   * Initialize the queue.
   */
  constructor(server) {
    this.server = server;
    if (server.options.queue.driver === "sync") {
      this.driver = new SyncQueueDriver(server);
    } else if (server.options.queue.driver === "redis") {
      this.driver = new RedisQueueDriver(server);
    } else if (server.options.queue.driver === "sqs") {
      this.driver = new SqsQueueDriver(server);
    } else {
      Log.error("No valid queue driver specified.");
    }
  }
  /**
   * Add a new event with data to queue.
   */
  addToQueue(queueName, data) {
    return this.driver.addToQueue(queueName, data);
  }
  /**
   * Register the code to run when handing the queue.
   */
  processQueue(queueName, callback) {
    return this.driver.processQueue(queueName, callback);
  }
  /**
   * Clear the queues for a graceful shutdown.
   */
  disconnect() {
    return this.driver.disconnect();
  }
}

module.exports = { Queue };
