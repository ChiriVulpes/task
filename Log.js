import ansi from 'ansicolor';
import { timestamp } from './Time';
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
export var ILogSource;
(function (ILogSource) {
    function is(value) {
        return typeof value === 'object'
            && value !== null
            && ILog.is(value.log);
    }
    ILogSource.is = is;
})(ILogSource || (ILogSource = {}));
// eslint-disable-next-line prefer-const
let Log;
class LogImplementation {
    source;
    info(...what) {
        if (this.source !== undefined)
            console.log(timestamp(), this.source, ...what);
        else
            console.log(timestamp(), ...what);
    }
    warn(...what) {
        if (this.source !== undefined)
            console.log(timestamp('yellow'), this.source, ...what);
        else
            console.warn(timestamp('yellow'), ...what);
    }
    error(...what) {
        if (this.source !== undefined)
            console.log(timestamp('red'), this.source, ...what);
        else
            console.error(timestamp('red'), ...what);
    }
    setSources(...sources) {
        this.source = ansi.darkGray('- ') + sources.join(ansi.darkGray(' / ')) + ansi.darkGray(' -');
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
export default Log;
