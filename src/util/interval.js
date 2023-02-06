// create a self-adjusting interval that can be started and stopped
const noop = () => {};
class SelfAdjustingInterval {
  constructor(func, interval, callback) {
    if (typeof func !== "function") {
      throw new Error(`Expected a function, received "${func}"`);
    }
    this._func = func;

    if (isNaN(interval)) {
      throw new Error(`Expected a number, received "${interval}"`);
    }
    this._interval = interval;

    this._callback = callback || noop;
  }

  async tick() {
    // await the function execution (if possible); always continue the interval
    // regardless of any caught errors
    try {
      await this._func();
    }
    catch (error) {
      this._callback(error);
    }
    finally {
      // get the amount of time that we drifted from the expected time during
      // the function call
      const drift = Date.now() - this._expected;

      // adjust the expected end time for the next tick
      this._expected += this._interval;

      // take into account drift in the next interval
      const adjustedInterval = this._interval - drift;
      let nextInterval;
      if (adjustedInterval < 0) {
        // subtract the drift-adjusted interval from the base-interval as the
        // interval needs to start catching up to the expected ticks
        nextInterval = this._interval + adjustedInterval;
      }
      else {
        nextInterval = adjustedInterval;
      }

      if (nextInterval < 0) {
        // the drift has become so large that it is futile to try to catch up, so
        // just reset the interval instead
        this.stop();
        this.start();
      }
      else {
        // pass the correct this-context by using an arrow function in
        // setTimeout
        this._timeout = setTimeout(() => {
          this.tick();
        }, nextInterval);
      }
    }
  }

  start() {
    // set the initial expected start and end time for the first tick (which is
    // now, since we start it immediately)
    this._expected = Date.now();

    this.tick();
  }

  stop() {
    clearTimeout(this._timeout);
  }
}

module.exports = {
  SelfAdjustingInterval,
};
