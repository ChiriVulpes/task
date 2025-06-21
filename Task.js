"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const SYMBOL_IS_TASK_FUNCTION = Symbol('IS_TASK_FUNCTION');
function Task(name, task) {
    Object.defineProperty(task, 'name', { value: name });
    Object.defineProperty(task, SYMBOL_IS_TASK_FUNCTION, { value: true });
    return task;
}
(function (Task) {
    function is(value) {
        return typeof value === 'function' && value[SYMBOL_IS_TASK_FUNCTION];
    }
    Task.is = is;
    function cli(options, command, ...args) {
        return new Promise((resolve, reject) => {
            if (typeof options === 'string') {
                args.unshift(command);
                command = options;
                options = {};
            }
            command = command;
            if (command.startsWith('NPM:'))
                command = `${command.slice(4)}${process.platform === 'win32' ? '.cmd' : ''}`;
            command = command.startsWith('PATH:')
                ? command.slice(5)
                : path_1.default.resolve(`node_modules/.bin/${command}`);
            const childProcess = (0, child_process_1.spawn)(wrapQuotes(command), args.map(wrapQuotes), { shell: true, stdio: [process.stdin, options.stdout ? 'pipe' : process.stdout, options.stderr ? 'pipe' : process.stderr], cwd: options.cwd, env: options.env });
            if (options.stdout)
                childProcess.stdout?.on('data', options.stdout);
            if (options.stderr)
                childProcess.stderr?.on('data', options.stderr);
            childProcess.on('error', reject);
            childProcess.on('exit', code => {
                if (code)
                    reject(new Error(`Error code ${code}`));
                else
                    resolve();
            });
        });
    }
    Task.cli = cli;
})(Task || (Task = {}));
exports.default = Task;
function wrapQuotes(value) {
    if (!value.includes(' '))
        return value;
    if (!value.startsWith('"'))
        value = `"${value}`;
    if (!value.endsWith('"'))
        value = `${value}"`;
    return value;
}
