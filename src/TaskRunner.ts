#!/usr/bin/env node

import ansi from 'ansicolor'
import { spawn } from "child_process"
import chokidar from 'chokidar'
import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { glob } from 'tinyglobby'
import * as tsconfigpaths from 'tsconfig-paths'
import Hash from './Hash'
import Log from './Log'
import type { TaskFunction, TaskFunctionDef } from './Task'
import Task from './Task'
import { stopwatch } from './Time'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

try {
	dotenv.config()
}
catch { }

try {
	const tsnode: typeof import("ts-node") = require("ts-node")
	tsnode.register()
} catch { }
tsconfigpaths.register()

export interface ITaskCLIOptions {
	cwd?: string
	env?: NodeJS.ProcessEnv
	stdout?(data: string): any
	stderr?(data: string): any
}

export interface ITaskApi {
	noErrors?: true
	lastError?: Error
	series (...tasks: TaskFunctionDef<any>[]): TaskFunction<any>
	parallel (...tasks: TaskFunctionDef<any>[]): TaskFunction<any>
	run<T, ARGS extends any[]> (task: TaskFunctionDef<T, ARGS>, ...args: ARGS): Promise<T>
	try<T, ARGS extends any[]> (task: TaskFunctionDef<T, ARGS>, ...args: ARGS): Promise<T>
	debounce<T, ARGS extends any[]> (task: TaskFunctionDef<T, ARGS>, ...args: ARGS): void
	watch (globs: string | string[], task: TaskFunctionDef<unknown, [string]>, delay?: number): void
	exec (command: string, ...args: string[]): Promise<void>
	exec (options: ITaskCLIOptions, command: string, ...args: string[]): Promise<void>
	install (...packages: Project[]): Promise<void>
}

interface IDebouncedTask {
	promise: Promise<void>
	count: number
}

const debouncedTasks = new Map<TaskFunctionDef<any, any[]>, IDebouncedTask>()

const loggedErrors = new Set<Error>()

const taskApi: ITaskApi = {
	lastError: undefined,
	series (...tasks): TaskFunction<Promise<void>> {
		return Task(null, async api => {
			const shouldError = !api.noErrors
			delete api.noErrors
			for (const task of tasks)
				await api[shouldError ? 'run' : 'try'](task)
		})
	},
	parallel (...tasks): TaskFunction<Promise<void>> {
		return Task(null, async api => {
			const shouldError = !api.noErrors
			delete api.noErrors
			await Promise.all(tasks.map(task => Promise.resolve(api[shouldError ? 'run' : 'try'](task))))
		})
	},
	try (task, ...args) {
		this.noErrors = true
		return this.run(task, ...args)
	},
	/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
	async run (task, ...args: any[]) {
		const shouldError = !this.noErrors
		delete this.noErrors

		let result: any
		const taskName = ansi.cyan(task.name || '<anonymous>')

		if (task.name)
			Log.info(`Starting ${taskName}...`)
		const watch = stopwatch()

		let err: Error | undefined
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			result = await (task as TaskFunctionDef<any, any[]>)(shouldError ? this : { ...this, noErrors: true }, ...args)
		}
		catch (caught: any) {
			err = caught
			if (shouldError)
				this.lastError = caught
		}

		function logResult () {
			const time = watch.time()
			if (err) {
				if (!loggedErrors.has(err)) {
					loggedErrors.add(err)
					Log.error(`Task ${taskName} errored after ${time}:`, err)
				}
			}
			else if (task.name)
				Log.info(`Finished ${taskName} in ${time}`)
		}

		while (true) {
			if (err) {
				logResult()
				if (shouldError)
					throw err
			}

			if (!Task.is(result))
				break

			result = await (!shouldError ? this.try(result) : this.run(result))
		}

		logResult()
		return result
	},
	/* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
	debounce (task, ...args) {
		const shouldError = !this.noErrors
		delete this.noErrors

		let debouncedTask = debouncedTasks.get(task as TaskFunctionDef<any, any[]>)
		if (!debouncedTask) {
			debouncedTask = {
				promise: Promise.resolve(),
				count: 0,
			}
			debouncedTasks.set(task as TaskFunctionDef<any, any[]>, debouncedTask)
		}

		if (debouncedTask.count <= 1) {
			debouncedTask.count++
			debouncedTask.promise = debouncedTask.promise.then(async () => {
				try {
					await this[shouldError ? 'run' : 'try'](task as TaskFunctionDef<any, any[]>, ...args)
				}
				catch { }
				debouncedTask.count--
			})
		}
	},
	async watch (globs, task, delay = 0) {
		const paths = await glob(globs)
		chokidar.watch(paths, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 100 } })
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			.on('all', async (event, path) => {
				await sleep(delay)
				if (!await Hash.fileChanged(path))
					return

				this.debounce(task, path)
			})
	},
	async exec (options, command, ...args) {
		if (typeof options === 'string') {
			if (command)
				args.unshift(command)

			command = options
			options = {}
		}

		if (options.cwd && !await fs.stat(options.cwd).then(stat => stat.isDirectory()).catch(() => false))
			throw new Error(`Cannot exec here, not a directory or does not exist: '${options.cwd}'`)

		return new Promise<void>((resolve, reject) => {

			command = command!

			if (command.startsWith('NPM:'))
				command = `${command.slice(4)}${process.platform === 'win32' ? '.cmd' : ''}`

			command = command.startsWith('PATH:')
				? command.slice(5)
				: path.resolve(`node_modules/.bin/${command}`)

			const childProcess = spawn(wrapQuotes(command), args.map(wrapQuotes),
				{ shell: true, stdio: [process.stdin, options.stdout ? 'pipe' : process.stdout, options.stderr ? 'pipe' : process.stderr], cwd: options.cwd, env: options.env })

			if (options.stdout)
				childProcess.stdout?.on('data', options.stdout)

			if (options.stderr)
				childProcess.stderr?.on('data', options.stderr)

			childProcess.on('error', reject)
			childProcess.on('exit', code => {
				if (code) reject(new Error(`Error code ${code}`))
				else resolve()
			})
		})
	},
	install,
}

////////////////////////////////////
//#region Install Task

interface Project {
	path: string
	dependencies?: Record<string, GitHubDependency | NPMDependency>
	devDependencies?: Record<string, GitHubDependency | NPMDependency>
}

interface NPMDependency {
	name: string
	tag?: string
}

interface GitHubDependency {
	repo: string
	branch?: string
}

async function install (this: ITaskApi, ...projects: Project[]) {
	const root = process.cwd()

	const parsedLinks = !process.env.TASK_INSTALL_LINK ? []
		: process.env.TASK_INSTALL_LINK.split(/\s+/g)
			.map(link => {
				link = link.trim()
				const ei = link.indexOf('=')
				if (ei === -1)
					throw new Error(`Invalid link format: "${link}"`)

				let name = link.slice(0, ei).trim()
				const linkPath = link.slice(ei + 1).trim()
				let projectName = !name.includes('/') ? '.' : path.dirname(name)
				projectName = projectName.startsWith('./') ? projectName.slice(2) : projectName
				name = !name.includes('/') ? name : path.basename(name)
				return [projectName, { name, linkPath }] as const
			})

	const linksByProject = Object.entries(Object.groupBy(parsedLinks, ([projectName]) => projectName) as Record<string, [string, { name: string, linkPath: string }][]>)
		.map(([projectName, links]) => [
			projectName,
			Object.fromEntries(links.map(([, link]) => [link.name, link.linkPath])),
		] as const)

	const links = Object.fromEntries(linksByProject)

	for (const project of projects) {
		process.chdir(root)
		process.chdir(project.path)
		console.log('')
		Log.info(`Project: ${ansi.lightGreen(project.path)}`)

		if (!Object.entries(project.dependencies ?? {}).length && !Object.entries(project.devDependencies ?? {}).length) {
			await this.exec('NPM:PATH:pnpm', 'install')
			continue
		}

		for (const depType of ['dependencies', 'devDependencies'] as const) {
			if (!project[depType])
				continue

			const toUpdate = Object.entries(project[depType] ?? {})
			if (!toUpdate.length)
				continue

			const gitToUpdate = toUpdate.filter(([, dep]) => 'repo' in dep) as [name: string, dep: GitHubDependency][]
			const gitPackageListString = gitToUpdate.map(([name]) => ansi.lightCyan(name)).join(', ')
			if (gitPackageListString) {
				console.log('')
				Log.info(`Fetching latest versions of ${depType} ${gitPackageListString}...`)
			}
			const gitToInstall: [name: string, path: string, sha: string][] = !gitPackageListString ? []
				: await Promise.all(gitToUpdate.map(async ([name, { repo: path, branch }]) => {
					let response = ''
					const branchArg = branch ? `refs/heads/${branch}` : 'HEAD'
					let sha: string | undefined
					for (let i = 0; i < 7; i++) {
						await this.exec({ stdout: data => response += data.toString() }, 'PATH:git', 'ls-remote', `https://github.com/${path}.git`, branchArg)
						sha = response.trim().split(/\s+/)[0]
						if (!sha) {
							console.error(`Failed to get SHA of latest commit of ${name} repository. ls-remote response: "${response}"`)
							if (i < 6)
								await sleep(1000 * (i ** 2))
							continue
						}
					}

					if (!sha)
						process.exit(1)

					return [name, path, sha]
				}))

			if (gitPackageListString) {
				console.log('')
				Log.info(`Uninstalling ${depType} ${gitPackageListString}...`)
				await this.exec('NPM:PATH:pnpm', 'uninstall', ...gitToUpdate.map(([name]) => name))
			}

			const gitToInstallText = gitToInstall.map(([name, , sha]) => ansi.lightCyan(`${name}#${sha.slice(0, 7)}`)).join(', ')

			const npmToUpdate = toUpdate.filter(([, dep]) => 'name' in dep) as [name: string, dep: NPMDependency][]
			const npmToInstall = npmToUpdate.map(([name, { name: packageName, tag }]) => {
				return [name, packageName, tag] as const
			})

			const npmToInstallText = npmToInstall.map(([name, packageName, tag]) => ansi.lightCyan(`${packageName}${tag ? `@${tag}` : ''}`)).join(', ')

			console.log('')
			Log.info(`Installing ${depType} ${gitToInstallText}${gitToInstallText && npmToInstallText ? ', ' : ''}${npmToInstallText}...`)
			await this.exec('NPM:PATH:pnpm', 'add',
				...gitToInstall.map(([name, path, sha]) => `github:${path}#${sha}`),
				...npmToInstall.map(([, name, tag]) => tag ? `${name}@${tag ?? 'latest'}` : name),
				depType === 'devDependencies' ? '--save-dev' : '--save-prod',
			)
			await this.exec('NPM:PATH:pnpm', 'update',
				...npmToInstall.filter(([, , tag]) => !tag).map(([, name]) => name),
			)
		}

		const projectLinks = links[project.path] ?? {}
		const localLinkNames = Object.keys(projectLinks)
		if (localLinkNames.length) {
			const filesToPreservePreLink = ['./package.json', './pnpm-lock.yaml', './pnpm-workspace.yaml']
			const preservedFilesContent: Record<string, string | undefined> = {}
			for (const file of filesToPreservePreLink)
				preservedFilesContent[file] = await fs.readFile(file, 'utf8').catch(() => undefined)

			console.log('')
			Log.info(`Linking local ${localLinkNames.map(name => ansi.lightCyan(name)).join(', ')}...`)
			const localLinkPaths = Object.values(projectLinks).map(pathname => path.resolve(root, '..', pathname))
			await this.exec('NPM:PATH:pnpm', 'link',
				...localLinkPaths,
			)

			for (const preservedFile of filesToPreservePreLink)
				if (preservedFilesContent[preservedFile] !== undefined)
					await fs.writeFile(preservedFile, preservedFilesContent[preservedFile])
		}

		console.log('')
	}

	for (const project of projects) {
		process.chdir(root)
		process.chdir(project.path)
		console.log('')
		Log.info(`Auditing ${ansi.lightGreen(project.path)}`)
		await this.exec('NPM:PATH:pnpm', 'audit')
	}

	console.log('')
	process.chdir(root)
}

//#endregion
////////////////////////////////////

function wrapQuotes (value: string): string {
	if (!value.includes(' '))
		return value

	if (!value.startsWith('"'))
		value = `"${value}`
	if (!value.endsWith('"'))
		value = `${value}"`

	return value
}

////////////////////////////////////
// Code
//


function onError (err: Error) {
	Log.error(err.stack ?? err)
}

process.on('uncaughtException', onError)
process.on('unhandledRejection', onError)

class OwnError extends Error { }

const cwd = process.cwd()
const [, , ...tasks] = process.argv
void (async () => {
	let errors: number | undefined
	let remainingInMain = false
	const shouldPassParams = tasks.indexOf("--params")
	const params = shouldPassParams <= 0 ? [] : tasks.slice(shouldPassParams + 1)
	if (shouldPassParams > 0)
		tasks.splice(shouldPassParams, Infinity)

	for (const task of tasks) {
		if (task === '--') {
			remainingInMain = true
			continue
		}

		try {
			if (tasks.length === 1 || remainingInMain) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
				let taskFunction;
				try {
					taskFunction = require(path.join(cwd, `./task/${task}.ts`))?.default
				} catch (err) {
					if (err && (err as any).code !== 'MODULE_NOT_FOUND' || !(err as any).message?.includes(`task/${task}.ts`))
						throw err
				}

				if (!taskFunction)
					throw new OwnError(`No task function found by name "${task}"`)

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await taskApi.run(taskFunction, ...params)
				process.chdir(cwd)
				continue
			}

			await new Promise<void>((resolve, reject) => {
				const p = spawn('node', [`"${__filename}"`, task], { shell: true, stdio: 'inherit' })
				p.on('error', reject)
				p.on('close', code => {
					if (code) errors = code
					resolve()
				})
			})

			if (errors)
				break
		}
		catch (err) {
			if (!loggedErrors.has(err as Error))
				Log.error(err instanceof OwnError ? err.message : err)
			errors = 1
			break
		}
	}

	if (errors || taskApi.lastError)
		process.exit(errors ?? 1)
})()
