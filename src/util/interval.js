// Essentially a SetInterval alias that waits for the function to finish before starting the next call.
// It logs the amount of time it took to call the function, and subtracts it from the interval.
class SelfAdjustingInterval {
	constructor (func, interval, callback) {
		if (typeof func !== 'function') {
			throw new Error(`Expected a function, received "${func}".`);
		}
		if (isNaN(interval)) {
			throw new Error(`Expected a number, received "${interval}".`);
		}
		this.func = func;
		this.interval = interval;
		this.callback = callback;
		this.running = false;
		this.shouldStop = false;
	}
	async start () {
		if (this.running === true) {
			return;
		}
		this.running = true;
		while (true) {
			let startTime = Date.now();
			try {
				await this.func();
			} catch (e) {
				if (typeof this.callback === 'function') {
					this.callback(e);
				}
			}
			let executionTime = Date.now() - startTime;
			let nextInterval = this.interval - executionTime;
			if (nextInterval < 0) {
				// Execution time took longer than the provided interval,
				// so let's just wait the default amount of time.
				nextInterval = this.interval;
			}
			if (this.shouldStop === true) {
				this.shouldStop = false;
				break;
			}
			await new Promise(resolve => setTimeout(resolve, nextInterval));
		}
		this.running = false;
	}
	stop () {
		this.shouldStop = true;
	}
}
module.exports = { SelfAdjustingInterval };
