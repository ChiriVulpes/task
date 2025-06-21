"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopwatch = stopwatch;
exports.elapsed = elapsed;
exports.timestamp = timestamp;
const ansicolor_1 = __importDefault(require("ansicolor"));
const perf_hooks_1 = require("perf_hooks");
function stopwatch() {
    const start = perf_hooks_1.performance.now();
    let elapsedTime;
    function stop() {
        if (elapsedTime === undefined)
            elapsedTime = perf_hooks_1.performance.now() - start;
    }
    return {
        get elapsed() {
            return elapsedTime ?? perf_hooks_1.performance.now() - start;
        },
        stop,
        time: () => (stop(), elapsed(elapsedTime)),
    };
}
function elapsed(elapsed) {
    return ansicolor_1.default.magenta(elapsedRaw(elapsed));
}
function elapsedRaw(elapsed) {
    if (elapsed < 1)
        return `${Math.floor(elapsed * 1_000)} μs`;
    if (elapsed < 1_000)
        return `${Math.floor(elapsed)} ms`;
    if (elapsed < 60_000)
        return `${+(elapsed / 1_000).toFixed(2)} s`;
    return `${+(elapsed / 60_000).toFixed(2)} m`;
}
const format = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false, timeZone: 'Australia/Melbourne' });
function timestamp(color = 'darkGray') {
    return ansicolor_1.default[color](format.format(new Date()));
}
class Time {
    static get lastDailyReset() {
        return this.nextDailyReset - this.days(1);
    }
    static get lastWeeklyReset() {
        return this.nextWeeklyReset - this.days(7);
    }
    static get lastTrialsReset() {
        const trialsReset = this.nextWeeklyReset - this.days(4);
        return trialsReset > Date.now() ? trialsReset - this.weeks(1) : trialsReset;
    }
    static get nextDailyReset() {
        const time = new Date().setUTCHours(17, 0, 0, 0);
        return time < Date.now() ? time + this.days(1) : time;
    }
    static get nextWeeklyReset() {
        const now = Date.now();
        const week = now + (this.weeks(1) - (now % this.weeks(1))) - this.days(1) - this.hours(7);
        return week < Date.now() ? week + this.weeks(1) : week;
    }
    static minutes(minutes) {
        return minutes * 1000 * 60;
    }
    static hours(hours) {
        return hours * 1000 * 60 * 60;
    }
    static days(days) {
        return days * 1000 * 60 * 60 * 24;
    }
    static weeks(weeks) {
        return weeks * 1000 * 60 * 60 * 24 * 7;
    }
    static iso(time) {
        return (time === undefined ? new Date() : typeof time === 'object' ? time : new Date(time))
            .toISOString()
            .slice(0, -5) + 'Z';
    }
}
exports.default = Time;
