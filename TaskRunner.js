#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ansicolor_1 = __importDefault(require("ansicolor"));
const child_process_1 = require("child_process");
const chokidar_1 = __importDefault(require("chokidar"));
const dotenv_1 = __importDefault(require("dotenv"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const tinyglobby_1 = require("tinyglobby");
const tsconfigpaths = __importStar(require("tsconfig-paths"));
const Hash_1 = __importDefault(require("./Hash"));
const Log_1 = __importDefault(require("./Log"));
const Task_1 = __importDefault(require("./Task"));
const Time_1 = require("./Time");
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
try {
    dotenv_1.default.config();
}
catch { }
try {
    const tsnode = require("ts-node");
    tsnode.register();
}
catch { }
tsconfigpaths.register();
const debouncedTasks = new Map();
const loggedErrors = new Set();
const taskApi = {
    lastError: undefined,
    series(...tasks) {
        return (0, Task_1.default)(null, async (api) => {
            const shouldError = !api.noErrors;
            delete api.noErrors;
            for (const task of tasks)
                await api[shouldError ? 'run' : 'try'](task);
        });
    },
    parallel(...tasks) {
        return (0, Task_1.default)(null, async (api) => {
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
        const taskName = ansicolor_1.default.cyan(task.name || '<anonymous>');
        if (task.name)
            Log_1.default.info(`Starting ${taskName}...`);
        const watch = (0, Time_1.stopwatch)();
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
                    Log_1.default.error(`Task ${taskName} errored after ${time}:`, err);
                }
            }
            else if (task.name)
                Log_1.default.info(`Finished ${taskName} in ${time}`);
        }
        while (true) {
            if (err) {
                logResult();
                if (shouldError)
                    throw err;
            }
            if (!Task_1.default.is(result))
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
    async watch(globs, task, delay = 0) {
        const paths = await (0, tinyglobby_1.glob)(globs);
        chokidar_1.default.watch(paths, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 100 } })
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            .on('all', async (event, path) => {
            await sleep(delay);
            if (!await Hash_1.default.fileChanged(path))
                return;
            this.debounce(task, path);
        });
    },
    exec(options, command, ...args) {
        return new Promise((resolve, reject) => {
            if (typeof options === 'string') {
                if (command)
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
    },
    install,
};
async function install(...projects) {
    const root = process.cwd();
    const parsedLinks = !process.env.TASK_INSTALL_LINK ? []
        : process.env.TASK_INSTALL_LINK.split(/\s+/g)
            .map(link => {
            link = link.trim();
            const ei = link.indexOf('=');
            if (ei === -1)
                throw new Error(`Invalid link format: "${link}"`);
            let name = link.slice(0, ei).trim();
            const linkPath = link.slice(ei + 1).trim();
            let projectName = !name.includes('/') ? '.' : path_1.default.dirname(name);
            projectName = projectName.startsWith('./') ? projectName.slice(2) : projectName;
            name = !name.includes('/') ? name : path_1.default.basename(name);
            return [projectName, { name, linkPath }];
        });
    const linksByProject = Object.entries(Object.groupBy(parsedLinks, ([projectName]) => projectName))
        .map(([projectName, links]) => [
        projectName,
        Object.fromEntries(links.map(([, link]) => [link.name, link.linkPath])),
    ]);
    const links = Object.fromEntries(linksByProject);
    for (const project of projects) {
        process.chdir(root);
        process.chdir(project.path);
        const toUpdate = Object.entries(project.dependencies ?? {});
        if (!toUpdate.length) {
            await this.exec('NPM:PATH:npm', 'install', '--no-audit', '--no-fund');
            continue;
        }
        const packageJsonString = await promises_1.default.readFile('./package.json', 'utf8');
        const gitToUpdate = toUpdate.filter(([, dep]) => 'repo' in dep);
        const gitPackageListString = gitToUpdate.map(([name]) => ansicolor_1.default.lightCyan(name)).join(', ');
        if (gitPackageListString)
            Log_1.default.info(`Fetching latest versions of ${gitPackageListString}...`);
        const gitToInstall = !gitPackageListString ? []
            : await Promise.all(gitToUpdate.map(async ([name, { repo: path, branch }]) => {
                let response = '';
                const branchArg = branch ? `refs/heads/${branch}` : 'HEAD';
                await this.exec({ stdout: data => response += data.toString() }, 'PATH:git', 'ls-remote', `https://github.com/${path}.git`, branchArg);
                const sha = response.trim().split(/\s+/)[0];
                if (!sha)
                    throw new Error(`Failed to get SHA of latest commit of ${name} repository`);
                return [name, path, sha];
            }));
        if (gitPackageListString) {
            Log_1.default.info(`Uninstalling ${gitPackageListString}...`);
            await this.exec('NPM:PATH:npm', 'uninstall', ...gitToUpdate.map(([name]) => name), '--save', '--no-audit', '--no-fund');
        }
        const gitToInstallText = gitToInstall.map(([name, , sha]) => ansicolor_1.default.lightCyan(`${name}#${sha.slice(0, 7)}`)).join(', ');
        const npmToUpdate = toUpdate.filter(([, dep]) => 'name' in dep);
        const npmToInstall = npmToUpdate.map(([name, { name: packageName, tag }]) => {
            return [name, packageName, tag];
        });
        const npmToInstallText = npmToInstall.map(([name, packageName, tag]) => ansicolor_1.default.lightCyan(`${packageName}${tag ? `@${tag}` : ''}`)).join(', ');
        Log_1.default.info(`Installing ${gitToInstallText}${gitToInstallText && npmToInstallText ? ', ' : ''}${npmToInstallText}...`);
        await this.exec('NPM:PATH:npm', 'install', ...gitToInstall.map(([name, path, sha]) => `github:${path}#${sha}`), ...npmToInstall.map(([, name, tag]) => tag ? `${name}@${tag ?? 'latest'}` : name), '--save-dev', '--no-audit', '--no-fund', '--prefer-online');
        const projectLinks = links[project.path] ?? {};
        const localLinkNames = Object.keys(projectLinks);
        if (localLinkNames.length) {
            Log_1.default.info(`Linking local ${localLinkNames.map(name => ansicolor_1.default.lightCyan(name)).join(', ')}...`);
            const localLinkPaths = Object.values(projectLinks).map(pathname => path_1.default.resolve(root, '..', pathname));
            await this.exec('NPM:PATH:npm', 'link', ...localLinkPaths, '--no-audit', '--no-fund');
        }
        await promises_1.default.writeFile('./package.json', packageJsonString, 'utf8');
    }
    process.chdir(root);
}
//#endregion
////////////////////////////////////
function wrapQuotes(value) {
    if (!value.includes(' '))
        return value;
    if (!value.startsWith('"'))
        value = `"${value}`;
    if (!value.endsWith('"'))
        value = `${value}"`;
    return value;
}
////////////////////////////////////
// Code
//
function onError(err) {
    Log_1.default.error(err.stack ?? err);
}
process.on('uncaughtException', onError);
process.on('unhandledRejection', onError);
class OwnError extends Error {
}
const cwd = process.cwd();
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
                let taskFunction;
                try {
                    taskFunction = require(path_1.default.join(cwd, `./task/${task}.ts`))?.default;
                }
                catch (err) {
                    if (err && err.code !== 'MODULE_NOT_FOUND' || !err.message?.includes(`task/${task}.ts`))
                        throw err;
                }
                if (!taskFunction)
                    throw new OwnError(`No task function found by name "${task}"`);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                await taskApi.run(taskFunction);
                process.chdir(cwd);
                continue;
            }
            await new Promise((resolve, reject) => {
                const p = (0, child_process_1.spawn)('node', [`"${__filename}"`, task], { shell: true, stdio: 'inherit' });
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
                Log_1.default.error(err instanceof OwnError ? err.message : err);
            errors = 1;
            break;
        }
    }
    if (errors || taskApi.lastError)
        process.exit(errors ?? 1);
})();
