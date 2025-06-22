#!/usr/bin/env node

import ansi from 'ansicolor'
import { spawn } from "child_process"
import chokidar from 'chokidar'
import dotenv from 'dotenv'
import path from 'path'
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
	watch (globs, task, delay = 0) {
		chokidar.watch(globs, { ignoreInitial: true, awaitWriteFinish: true })
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			.on('all', async (event, path) => {
				await sleep(delay)
				if (!await Hash.fileChanged(path))
					return

				this.debounce(task, path)
			})
	},
	exec (options, command, ...args) {
		return new Promise<void>((resolve, reject) => {
			if (typeof options === 'string') {
				args.unshift(command!)
				command = options
				options = {}
			}

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
}

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

const [, , ...tasks] = process.argv
void (async () => {
	let errors: number | undefined
	let remainingInMain = false
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
					taskFunction = require(path.join(process.cwd(), `./task/${task}.ts`))?.default
				} catch (err) {
					if (err && (err as any).code !== 'MODULE_NOT_FOUND')
						throw err
				}

				if (!taskFunction)
					throw new OwnError(`No task function found by name "${task}"`)

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await taskApi.run(taskFunction)
				continue
			}

			await new Promise<void>((resolve, reject) => {
				const p = spawn('npx', ['ts-node', `"${__filename}"`, task], { shell: true, stdio: 'inherit' })
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
