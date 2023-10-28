const { v4: uuidv4 } = require("uuid");

class Job {
  /**
   * Create a new job instance.
   */
  constructor(id = uuidv4(), data = {}) {
    this.id = id;
    this.data = data;
    //
  }
}

module.exports = { Job };
