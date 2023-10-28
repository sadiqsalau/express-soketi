const { v4: uuidv4 } = require("uuid");
const { Job } = require("../job");

class SyncQueueDriver {
  /**
   * Initialize the Sync Queue Driver.
   */
  constructor(server) {
    this.server = server;
    /**
     * The list of queues with their code.
     */
    this.queues = new Map();
    //
  }
  /**
   * Add a new event with data to queue.
   */
  addToQueue(queueName, data) {
    return new Promise((resolve) => {
      let jobCallback = this.queues.get(queueName);
      if (!jobCallback) {
        return resolve();
      }
      let jobId = uuidv4();
      jobCallback(new Job(jobId, data), resolve);
    });
  }
  /**
   * Register the code to run when handing the queue.
   */
  processQueue(queueName, callback) {
    return new Promise((resolve) => {
      this.queues.set(queueName, callback);
      resolve();
    });
  }
  /**
   * Clear the queues for a graceful shutdown.
   */
  disconnect() {
    return Promise.resolve();
  }
}

module.exports = { SyncQueueDriver };
