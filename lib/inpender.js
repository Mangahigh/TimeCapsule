var queues = require('./queues');
var Redlock = require('redlock');
var waitAndThen = require('./waitAndThen');
var _ = require('lodash');

/**
 * Get a date object
 * @returns {Date}
 */
const getNow = () => new Date();

class Impender {
  /** @private */

  /**
   * @param {KeyManager} keyLib
   * @param {QueueManager} queueLib
   * @param {RedisClient} redisClient
   * @param {Object} config
   */
  constructor(keyLib, queueLib, redisClient, config) {
    const redlockConfig = _.merge(
      {
        driftFactor: 0.01,
        retryCount: 5,
        retryDelay: 100,
        retryJitter: 200
      },
      config.redlock
    );

    /**
     * @type {KeyManager}
     * @private
     */
    this._keyLib = keyLib;

    /**
     * @type {Object}
     * @private
     */
    this._config = config;

    /**
     * @type {QueueManager}
     * @private
     */
    this._queueLib = queueLib;

    /**
     * @type {number}
     * @private
     */
    this._lockDuration = 1000;

    /**
     * @type {Redis}
     * @private
     */
    this._redisClient = redisClient;

    /**
     * @type {Redlock}
     * @private
     */
    this._redlockClient = new Redlock([redisClient], redlockConfig);

    this._redlockClient.on('clientError', (err) => console.error('A redis error has occurred:', err));
  }

  /**
   * Gets an exclusive lock, ensures that only one inpender is running
   */
  _getLock() {
    return this._redlockClient.lock(this._keyLib.getName('requeueLock'), this._lockDuration);
  }

  /**
   * Gets a list of items which have reached their embargo date
   * @param {string}   queue
   */
  _getReadyItems(queue) {
    return new Promise((resolve, reject) => {
      try {
        this._redisClient.zrangebyscore([this._keyLib.getName('index', queue), 0, getNow().getTime()], (err, data) => {
          if (err ) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Removes the active lock, then calls moveToPending after a delay
   * @param {Lock} lock
   */
  _unlockAndWait(lock) {
    lock.unlock()
      .then(() => waitAndThen(this._config.waitInterval * 1000))
      .then(() => this.moveToPending());
  }

  /**
   * Removes an item from the delayed queue, and puts it into the pending queue
   * @param {object}   item
   * @param {string}   queue
   */
  _moveItemToPending(item, queue) {
    return new Promise((resolve, reject) => {
      try {
        this._redisClient.multi()
          .rpush(this._keyLib.getName('list', queue), item)
          .zrem(this._keyLib.getName('index', queue), item)
          .exec(resolve);
      } catch (e) {
        reject(e);
      }
    })
  };

  // ---

  /**
   * Move all the items that have reached their embargo date into the pending queue
   */
  moveToPending() {
    this._queueLib.getAll(this._redisClient).then((queues) => {
      if (!queues || !queues.length) {
        waitAndThen(this._config.waitInterval * 1000)
          .then(() => this.moveToPending());
      } else {
        this._getLock().then((lock) => {
          queues.forEach((queue) => {
            lock.extend(this._lockDuration).then(() => {
              this._getReadyItems(queue).then((data) => {
                let remainingItems = data.length;

                if (!remainingItems) {
                  this._unlockAndWait(lock);
                }

                data.forEach((item) => {
                  this._moveItemToPending(item, queue)
                    .then(() => {
                      --remainingItems;

                      if (!remainingItems) {
                        this._unlockAndWait(lock);
                      }
                    });
                });
              });
            });
          });
        });
      }
    });
  }
}

module.exports = Impender;