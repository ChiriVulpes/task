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
    const tsnode = require("tsx/cjs/api");
    tsnode.register();
}
catch { }
tsconfigpaths.register();
function childEnv(optionsEnv) {
    const env = {
        ...process.env,
        ...optionsEnv,
    };
    // pnpm exposes its own config to lifecycle scripts via npm_config_*.
    // npm then misinterprets this as npm's global config and can double-load it.
    delete env.npm_config_globalconfig;
    delete env.NPM_CONFIG_GLOBALCONFIG;
    return env;
}
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
    async readExec(command, ...args) {
        let output = '';
        await this.exec({ stdout: data => output += data.toString() }, command, ...args);
        return output;
    },
    async exec(options, command, ...args) {
        if (typeof options === 'string') {
            if (command)
                args.unshift(command);
            command = options;
            options = {};
        }
        if (options.cwd && !await promises_1.default.stat(options.cwd).then(stat => stat.isDirectory()).catch(() => false))
            throw new Error(`Cannot exec here, not a directory or does not exist: '${options.cwd}'`);
        return new Promise((resolve, reject) => {
            command = command;
            if (command.startsWith('NPM:'))
                command = `${command.slice(4)}${process.platform === 'win32' ? '.cmd' : ''}`;
            command = command.startsWith('PATH:')
                ? command.slice(5)
                : path_1.default.resolve(`node_modules/.bin/${command}`);
            const childProcess = (0, child_process_1.spawn)(wrapQuotes(command), args.map(wrapQuotes), { shell: true, stdio: [process.stdin, options.stdout ? 'pipe' : process.stdout, options.stderr ? 'pipe' : process.stderr], cwd: options.cwd, env: childEnv(options.env) });
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
function parseLocalLinkName(name) {
    const parts = name
        .replaceAll('\\', '/')
        .split('/')
        .map(part => part.trim())
        .filter(part => part && part !== '.');
    if (!parts.length)
        throw new Error(`Invalid link package name: "${name}"`);
    if (parts.length >= 2 && parts[parts.length - 2].startsWith('@')) {
        const packageName = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
        return [parts.slice(0, -2).join('/') || '.', packageName];
    }
    return [parts.slice(0, -1).join('/') || '.', parts[parts.length - 1]];
}
function localPackagePath(projectRoot, packageName) {
    return path_1.default.resolve(projectRoot, 'node_modules', ...packageName.split('/'));
}
function normalisePathForComparison(pathname) {
    pathname = path_1.default.resolve(pathname);
    if (process.platform === 'win32')
        pathname = pathname.replace(/^\\\\\?\\/, '').toLowerCase();
    return pathname;
}
function toPosixPath(pathname) {
    return pathname.replaceAll('\\', '/');
}
function packageBinEntries(packageName, packageJson) {
    const { bin } = packageJson;
    if (!bin)
        return [];
    if (typeof bin === 'string') {
        const binName = packageName.startsWith('@') ? packageName.split('/')[1] : packageName;
        return [[binName, bin]];
    }
    return Object.entries(bin);
}
async function normalizeBinShim(shimPath, binDir, binTarget) {
    let content = await promises_1.default.readFile(shimPath, 'utf8');
    const originalContent = content;
    const relativeTarget = path_1.default.relative(binDir, binTarget);
    const relativeTargetPosix = toPosixPath(relativeTarget);
    const absoluteTarget = path_1.default.resolve(binTarget);
    const absoluteTargetPosix = toPosixPath(absoluteTarget);
    const replacements = [
        [`%~dp0\\${relativeTarget}`, absoluteTarget],
        [`%~dp0/${relativeTargetPosix}`, absoluteTargetPosix],
        [`$basedir\\${relativeTarget}`, absoluteTarget],
        [`$basedir/${relativeTargetPosix}`, absoluteTargetPosix],
    ];
    for (const [from, to] of replacements)
        content = content.replaceAll(from, to);
    if (content === originalContent
        && !content.includes(`"${absoluteTarget}"`)
        && !content.includes(`"${absoluteTargetPosix}"`)
        && !content.includes(`'${absoluteTargetPosix}'`))
        throw new Error(`Bin shim does not point to expected local package target: ${shimPath}`);
    if (content !== originalContent)
        await promises_1.default.writeFile(shimPath, content);
}
async function normalizeLocalPackageBins(packageName, target, projectRoot) {
    const packageJsonPath = path_1.default.resolve(target, 'package.json');
    const packageJson = JSON.parse(await promises_1.default.readFile(packageJsonPath, 'utf8'));
    const bins = packageBinEntries(packageName, packageJson);
    if (!bins.length)
        return;
    const binDir = path_1.default.resolve(projectRoot, 'node_modules/.bin');
    for (const [binName, binPath] of bins) {
        const binTarget = path_1.default.resolve(target, binPath);
        const stat = await promises_1.default.stat(binTarget).catch(() => undefined);
        if (!stat?.isFile())
            throw new Error(`Local package bin target does not exist: ${binTarget}`);
        const shimPaths = [
            path_1.default.resolve(binDir, binName),
            path_1.default.resolve(binDir, `${binName}.CMD`),
            path_1.default.resolve(binDir, `${binName}.ps1`),
        ];
        const existingShimPaths = (await Promise.all(shimPaths.map(async (shimPath) => await promises_1.default.stat(shimPath).then(() => shimPath).catch(() => undefined)))).filter(shimPath => shimPath !== undefined);
        if (!existingShimPaths.length)
            throw new Error(`No bin shim found for local package bin: ${packageName} -> ${binName}`);
        for (const shimPath of existingShimPaths)
            await normalizeBinShim(shimPath, binDir, binTarget);
    }
}
async function normalizeLocalPackageLinks(projectLinks, workspaceRoot, projectRoot) {
    for (const [packageName, linkPath] of Object.entries(projectLinks)) {
        const target = path_1.default.resolve(workspaceRoot, '..', linkPath);
        const targetStat = await promises_1.default.stat(target).catch(() => undefined);
        if (!targetStat?.isDirectory())
            throw new Error(`Local package link target does not exist or is not a directory: ${target}`);
        const installedPath = localPackagePath(projectRoot, packageName);
        const installedStat = await promises_1.default.lstat(installedPath).catch(() => undefined);
        if (!installedStat)
            throw new Error(`Local package link was not installed: ${installedPath}`);
        if (!installedStat.isSymbolicLink())
            throw new Error(`Refusing to replace non-link local package entry: ${installedPath}`);
        const [installedRealPath, targetRealPath] = await Promise.all([
            promises_1.default.realpath(installedPath),
            promises_1.default.realpath(target),
        ]);
        if (normalisePathForComparison(installedRealPath) !== normalisePathForComparison(targetRealPath))
            throw new Error(`Local package link points to the wrong target: ${installedPath} -> ${installedRealPath}, expected ${target}`);
        const currentLinkTarget = await promises_1.default.readlink(installedPath);
        if (!path_1.default.isAbsolute(currentLinkTarget)) {
            await promises_1.default.rm(installedPath);
            await promises_1.default.symlink(target, installedPath, process.platform === 'win32' ? 'junction' : 'dir');
        }
        await normalizeLocalPackageBins(packageName, target, projectRoot);
    }
}
async function restorePnpmWorkspaceState(statePath, content) {
    if (content === undefined)
        return;
    let state;
    try {
        state = JSON.parse(content);
    }
    catch {
        await promises_1.default.writeFile(statePath, content);
        return;
    }
    if (state && typeof state === 'object' && 'lastValidatedTimestamp' in state)
        state.lastValidatedTimestamp = Date.now() + 1000;
    await promises_1.default.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
}
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
            const [projectName, packageName] = parseLocalLinkName(name);
            name = packageName;
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
        console.log('');
        Log_1.default.info(`Project: ${ansicolor_1.default.lightGreen(project.path)}`);
        if (!Object.entries(project.dependencies ?? {}).length && !Object.entries(project.devDependencies ?? {}).length) {
            await this.exec('NPM:PATH:pnpm', 'install');
            continue;
        }
        for (const depType of ['dependencies', 'devDependencies']) {
            if (!project[depType])
                continue;
            const toUpdate = Object.entries(project[depType] ?? {});
            if (!toUpdate.length)
                continue;
            const gitToUpdate = toUpdate.filter(([, dep]) => 'repo' in dep);
            const gitPackageListString = gitToUpdate.map(([name]) => ansicolor_1.default.lightCyan(name)).join(', ');
            if (gitPackageListString) {
                console.log('');
                Log_1.default.info(`Fetching latest versions of ${depType} ${gitPackageListString}...`);
            }
            const gitToInstall = !gitPackageListString ? []
                : await Promise.all(gitToUpdate.map(async ([name, { repo: path, branch }]) => {
                    const branchArg = branch ? `refs/heads/${branch}` : 'HEAD';
                    let sha;
                    for (let i = 0; i < 7; i++) {
                        const response = await this.readExec('PATH:git', 'ls-remote', `https://github.com/${path}.git`, branchArg);
                        sha = response.trim().split(/\s+/)[0];
                        if (!sha) {
                            console.error(`Failed to get SHA of latest commit of ${name} repository. ls-remote response: "${response}"`);
                            if (i < 6)
                                await sleep(1000 * (i ** 2));
                            continue;
                        }
                    }
                    if (!sha)
                        process.exit(1);
                    return [name, path, sha];
                }));
            if (gitPackageListString) {
                console.log('');
                Log_1.default.info(`Uninstalling ${depType} ${gitPackageListString}...`);
                await this.exec('NPM:PATH:pnpm', 'uninstall', ...gitToUpdate.map(([name]) => name));
            }
            const gitToInstallText = gitToInstall.map(([name, , sha]) => ansicolor_1.default.lightCyan(`${name}#${sha.slice(0, 7)}`)).join(', ');
            const npmToUpdate = toUpdate.filter(([, dep]) => 'name' in dep);
            let npmToInstall = npmToUpdate
                .map(([name, { name: packageName, tag }]) => {
                return [name, packageName, tag];
            });
            let npmToInstallText = npmToInstall.map(([name, packageName, tag]) => ansicolor_1.default.lightCyan(`${packageName}${tag ? `@${tag}` : ''}`)).join(', ');
            if (npmToInstall.length) {
                Log_1.default.info(`Fetching latest versions for ${depType} ${npmToInstallText}...`);
                npmToInstall = await Promise.all(npmToInstall
                    .map(async ([name, packageName, tag]) => [
                    name,
                    packageName,
                    await this.readExec('NPM:PATH:pnpm', 'view', `${packageName}@${tag ?? 'latest'}`, 'version', '--silent')
                        .then(version => version.trim()),
                ]));
                npmToInstallText = npmToInstall.map(([name, packageName, tag]) => ansicolor_1.default.lightCyan(`${packageName}${tag ? `@${tag}` : ''}`)).join(', ');
            }
            console.log('');
            Log_1.default.info(`Installing ${depType} ${gitToInstallText}${gitToInstallText && npmToInstallText ? ', ' : ''}${npmToInstallText}...`);
            await this.exec('NPM:PATH:pnpm', 'add', ...gitToInstall.map(([name, path, sha]) => `github:${path}#${sha}`), ...npmToInstall.map(([, name, tag]) => `${name}@${tag ?? 'latest'}`), depType === 'devDependencies' ? '--save-dev' : '--save-prod');
        }
        const projectLinks = links[project.path] ?? {};
        const localLinkNames = Object.keys(projectLinks);
        if (localLinkNames.length) {
            const filesToPreservePreLink = ['./package.json', './pnpm-lock.yaml', './pnpm-workspace.yaml'];
            const workspaceStateFile = './node_modules/.pnpm-workspace-state-v1.json';
            const preservedFilesContent = {};
            for (const file of filesToPreservePreLink)
                preservedFilesContent[file] = await promises_1.default.readFile(file, 'utf8').catch(() => undefined);
            const preservedWorkspaceStateContent = await promises_1.default.readFile(workspaceStateFile, 'utf8').catch(() => undefined);
            console.log('');
            Log_1.default.info(`Linking local ${localLinkNames.map(name => ansicolor_1.default.lightCyan(name)).join(', ')}...`);
            const localLinkPaths = Object.values(projectLinks).map(pathname => path_1.default.resolve(root, '..', pathname));
            try {
                await this.exec('NPM:PATH:pnpm', 'link', ...localLinkPaths);
                await normalizeLocalPackageLinks(projectLinks, root, process.cwd());
            }
            finally {
                for (const preservedFile of filesToPreservePreLink)
                    if (preservedFilesContent[preservedFile] !== undefined)
                        await promises_1.default.writeFile(preservedFile, preservedFilesContent[preservedFile]);
                await restorePnpmWorkspaceState(workspaceStateFile, preservedWorkspaceStateContent);
            }
        }
        console.log('');
    }
    for (const project of projects) {
        process.chdir(root);
        process.chdir(project.path);
        console.log('');
        Log_1.default.info(`Auditing ${ansicolor_1.default.lightGreen(project.path)}`);
        await this.exec('NPM:PATH:pnpm', 'audit', '--prod');
    }
    console.log('');
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
    const shouldPassParams = tasks.indexOf("--params");
    const params = shouldPassParams <= 0 ? [] : tasks.slice(shouldPassParams + 1);
    if (shouldPassParams > 0)
        tasks.splice(shouldPassParams, Infinity);
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
                await taskApi.run(taskFunction, ...params);
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
