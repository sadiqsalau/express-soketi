const async = require("async");

const Redis = require("ioredis");
const Cluster = Redis.Cluster;

const { Queue, QueueScheduler, Worker } = require("bullmq");

class RedisQueueDriver {
  /**
   * Initialize the Redis Queue Driver.
   */
  constructor(server) {
    this.server = server;
    /**
     * The queues with workers list.
     */
    this.queueWithWorker = new Map();
    //
  }
  /**
   * Add a new event with data to queue.
   */
  addToQueue(queueName, data) {
    return new Promise((resolve) => {
      let queueWithWorker = this.queueWithWorker.get(queueName);
      if (!queueWithWorker) {
        return resolve();
      }
      queueWithWorker.queue.add("webhook", data).then(() => resolve());
    });
  }
  /**
   * Register the code to run when handing the queue.
   */
  processQueue(queueName, callback) {
    return new Promise((resolve) => {
      if (!this.queueWithWorker.has(queueName)) {
        let redisOptions = {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          ...this.server.options.database.redis,
          ...this.server.options.queue.redis.redisOptions,
          // We set the key prefix on the queue, worker and scheduler instead of on the connection itself
          keyPrefix: undefined,
        };
        const connection = this.server.options.queue.redis.clusterMode
          ? new Cluster(this.server.options.database.redis.clusterNodes, {
              scaleReads: "slave",
              ...redisOptions,
            })
          : new Redis(redisOptions);
        const queueSharedOptions = {
          // We remove a trailing `:` from the prefix because BullMQ adds that already
          prefix: this.server.options.database.redis.keyPrefix.replace(
            /:$/,
            ""
          ),
          connection,
        };
        this.queueWithWorker.set(queueName, {
          queue: new Queue(queueName, {
            ...queueSharedOptions,
            defaultJobOptions: {
              attempts: 6,
              backoff: {
                type: "exponential",
                delay: 1000,
              },
              removeOnComplete: true,
              removeOnFail: true,
            },
          }),
          // TODO: Sandbox the worker? https://docs.bullmq.io/guide/workers/sandboxed-processors
          worker: new Worker(queueName, callback, {
            ...queueSharedOptions,
            concurrency: this.server.options.queue.redis.concurrency,
          }),
          // TODO: Seperate this from the queue with worker when multipe workers are supported.
          //       A single scheduler per queue is needed: https://docs.bullmq.io/guide/queuescheduler
          scheduler: new QueueScheduler(queueName, queueSharedOptions),
        });
      }
      resolve();
    });
  }
  /**
   * Clear the queues for a graceful shutdown.
   */
  disconnect() {
    return async.each(
      [...this.queueWithWorker],
      ([queueName, { queue, worker, scheduler }], callback) => {
        scheduler.close().then(() => {
          worker.close().then(() => callback());
        });
      }
    );
  }
}

module.exports = { RedisQueueDriver };
