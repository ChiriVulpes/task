"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ansicolor_1 = __importDefault(require("ansicolor"));
const Log_1 = __importDefault(require("./Log"));
const Time_1 = require("./Time");
var TypeScript;
(function (TypeScript) {
    function Reformatter(definition) {
        let lastStart;
        return (data) => {
            data = data.toString('utf8');
            data = data
                .replace(/\[\x1b\[90m\d{1,2}:\d{2}:\d{2}[ \xa0\u202f][AP]\.?M\.?\x1b\[0m\][ \xa0\u202f]/gi, '') // remove time
                .replace(/(\x1b\[96m)(.*?\x1b\[0m:\x1b\[93m)/g, '$1src/$2'); // longer file paths
            const lines = data.split('\n');
            for (let line of lines) {
                if (line.trim().length === 0)
                    // ignore boring lines
                    continue;
                if (line.startsWith('> '))
                    // ignore "> tsc --build --watch --pretty --preserveWatchOutput" line
                    continue;
                if (line.includes('Starting compilation in watch mode...'))
                    lastStart = (0, Time_1.stopwatch)();
                if (line.includes('Starting incremental compilation...')) {
                    if (lastStart)
                        // ignore duplicate "starting incremental compilation" line
                        continue;
                    lastStart = (0, Time_1.stopwatch)();
                }
                if (!definition?.noErrorColours) {
                    line = line
                        .replace(/(?<!\d)0 errors/, ansicolor_1.default.lightGreen('0 errors'))
                        .replace(/(?<!\d)(?!0)(\d+) errors/, ansicolor_1.default.lightRed('$1 errors'));
                }
                if (!definition?.noLogDuration && line.includes('. Watching for file changes.')) {
                    line = line.replace('. Watching for file changes.', ` after ${ansicolor_1.default.magenta((0, Time_1.elapsed)(lastStart.elapsed))}`);
                    lastStart = undefined;
                }
                Log_1.default.info(line);
            }
        };
    }
    TypeScript.Reformatter = Reformatter;
    function compile(task, cwd, ...params) {
        return task.exec({ cwd, stdout: Reformatter() }, 'NPM:tsc', ...params);
    }
    TypeScript.compile = compile;
})(TypeScript || (TypeScript = {}));
exports.default = TypeScript;
