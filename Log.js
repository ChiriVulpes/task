"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ILogSource = void 0;
const ansicolor_1 = __importDefault(require("ansicolor"));
const Time_1 = require("./Time");
var ILog;
(function (ILog) {
    function is(value) {
        return typeof value === 'object'
            && value !== null
            && typeof value.info === 'function'
            && typeof value.warn === 'function'
            && typeof value.error === 'function'
            && typeof value.setSources === 'function';
    }
    ILog.is = is;
})(ILog || (ILog = {}));
var ILogSource;
(function (ILogSource) {
    function is(value) {
        return typeof value === 'object'
            && value !== null
            && ILog.is(value.log);
    }
    ILogSource.is = is;
})(ILogSource || (exports.ILogSource = ILogSource = {}));
// eslint-disable-next-line prefer-const
let Log;
class LogImplementation {
    source;
    info(...what) {
        if (this.source !== undefined)
            console.log((0, Time_1.timestamp)(), this.source, ...what);
        else
            console.log((0, Time_1.timestamp)(), ...what);
    }
    warn(...what) {
        if (this.source !== undefined)
            console.log((0, Time_1.timestamp)('yellow'), this.source, ...what);
        else
            console.warn((0, Time_1.timestamp)('yellow'), ...what);
    }
    error(...what) {
        if (this.source !== undefined)
            console.log((0, Time_1.timestamp)('red'), this.source, ...what);
        else
            console.error((0, Time_1.timestamp)('red'), ...what);
    }
    setSources(...sources) {
        this.source = ansicolor_1.default.darkGray('- ') + sources.join(ansicolor_1.default.darkGray(' / ')) + ansicolor_1.default.darkGray(' -');
        return this;
    }
    get(source, ...sources) {
        if (typeof source !== 'string') {
            if (ILog.is(source))
                return source;
            if (ILogSource.is(source))
                return source.log;
            return Log;
        }
        return this.new(source, ...sources);
    }
    new(...sources) {
        return new LogImplementation()
            .setSources(...sources);
    }
}
Log = new LogImplementation();
exports.default = Log;
