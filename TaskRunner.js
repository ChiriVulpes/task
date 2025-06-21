import ansi from 'ansicolor';
import { spawn } from "child_process";
import chokidar from 'chokidar';
import dotenv from 'dotenv';
import path from 'path';
import * as tsconfigpaths from 'tsconfig-paths';
import Hash from './Hash';
import Log from './Log';
import Task from './Task';
import { stopwatch } from './Time';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
try {
    dotenv.config();
}
catch { }
tsconfigpaths.register();
const debouncedTasks = new Map();
const loggedErrors = new Set();
const taskApi = {
    lastError: undefined,
    series(...tasks) {
        return Task(null, async (api) => {
            const shouldError = !api.noErrors;
            delete api.noErrors;
            for (const task of tasks)
                await api[shouldError ? 'run' : 'try'](task);
        });
    },
    parallel(...tasks) {
        return Task(null, async (api) => {
            const shouldError = !api.noErrors;
            delete api.noErrors;
            await Promise.all(tasks.map(task => Promise.resolve(api[shouldError ? 'run' : 'try'](task))));
        });
    },
    try(task, ...args) {
        this.noErrors = true;
        return this.run(task, ...args);
    },
    /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
    async run(task, ...args) {
        const shouldError = !this.noErrors;
        delete this.noErrors;
        let result;
        const taskName = ansi.cyan(task.name || '<anonymous>');
        if (task.name)
            Log.info(`Starting ${taskName}...`);
        const watch = stopwatch();
        let err;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            result = await task(shouldError ? this : { ...this, noErrors: true }, ...args);
        }
        catch (caught) {
            err = caught;
            if (shouldError)
                this.lastError = caught;
        }
        function logResult() {
            const time = watch.time();
            if (err) {
                if (!loggedErrors.has(err)) {
                    loggedErrors.add(err);
                    Log.error(`Task ${taskName} errored after ${time}:`, err);
                }
            }
            else if (task.name)
                Log.info(`Finished ${taskName} in ${time}`);
        }
        while (true) {
            if (err) {
                logResult();
                if (shouldError)
                    throw err;
            }
            if (!Task.is(result))
                break;
            result = await (!shouldError ? this.try(result) : this.run(result));
        }
        logResult();
        return result;
    },
    /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
    debounce(task, ...args) {
        const shouldError = !this.noErrors;
        delete this.noErrors;
        let debouncedTask = debouncedTasks.get(task);
        if (!debouncedTask) {
            debouncedTask = {
                promise: Promise.resolve(),
                count: 0,
            };
            debouncedTasks.set(task, debouncedTask);
        }
        if (debouncedTask.count <= 1) {
            debouncedTask.count++;
            debouncedTask.promise = debouncedTask.promise.then(async () => {
                try {
                    await this[shouldError ? 'run' : 'try'](task, ...args);
                }
                catch { }
                debouncedTask.count--;
            });
        }
    },
    watch(globs, task, delay = 0) {
        chokidar.watch(globs, { ignoreInitial: true })
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            .on('all', async (event, path) => {
            await sleep(delay);
            if (!await Hash.fileChanged(path))
                return;
            this.debounce(task, path);
        });
    }
};
////////////////////////////////////
// Code
//
function onError(err) {
    Log.error(err.stack ?? err);
}
process.on('uncaughtException', onError);
process.on('unhandledRejection', onError);
const [, , ...tasks] = process.argv;
void (async () => {
    let errors;
    let remainingInMain = false;
    for (const task of tasks) {
        if (task === '--') {
            remainingInMain = true;
            continue;
        }
        try {
            if (tasks.length === 1 || remainingInMain) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
                const taskFunction = require(path.join(process.cwd(), `./task/${task}.ts`))?.default;
                if (!taskFunction)
                    throw new Error(`No task function found by name "${task}"`);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                await taskApi.run(taskFunction);
                continue;
            }
            await new Promise((resolve, reject) => {
                const p = spawn('npx', ['ts-node', `"${__filename}"`, task], { shell: true, stdio: 'inherit' });
                p.on('error', reject);
                p.on('close', code => {
                    if (code)
                        errors = code;
                    resolve();
                });
            });
            if (errors)
                break;
        }
        catch (err) {
            if (!loggedErrors.has(err))
                Log.error(err);
            errors = 1;
            break;
        }
    }
    if (errors || taskApi.lastError)
        process.exit(errors ?? 1);
})();
