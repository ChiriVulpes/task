import ansicolor from "ansicolor"
import Log from "./Log"
import { ITaskApi } from "./TaskRunner"
import { elapsed, stopwatch, Stopwatch } from "./Time"

namespace TypeScript {

	export interface ReformatterDefinition {
		noErrorColours?: true
		noLogDuration?: true
	}

	export function Reformatter (definition?: ReformatterDefinition) {
		let lastStart: Stopwatch | undefined
		return (data: string | Buffer) => {
			data = data.toString('utf8')

			data = data
				.replace(/\[\x1b\[90m\d{1,2}:\d{2}:\d{2}[ \xa0\u202f][AP]\.?M\.?\x1b\[0m\][ \xa0\u202f]/gi, '') // remove time
				.replace(/(\x1b\[96m)(.*?\x1b\[0m:\x1b\[93m)/g, '$1src/$2') // longer file paths

			const lines = data.split('\n')
			for (let line of lines) {
				if (line.trim().length === 0)
					// ignore boring lines
					continue

				if (line.startsWith('> '))
					// ignore "> tsc --build --watch --pretty --preserveWatchOutput" line
					continue

				if (line.includes('Starting compilation in watch mode...'))
					lastStart = stopwatch()

				if (line.includes('Starting incremental compilation...')) {
					if (lastStart)
						// ignore duplicate "starting incremental compilation" line
						continue

					lastStart = stopwatch()
				}

				if (!definition?.noErrorColours) {
					line = line
						.replace(/(?<!\d)0 errors/, ansicolor.lightGreen('0 errors'))
						.replace(/(?<!\d)(?!0)(\d+) errors/, ansicolor.lightRed('$1 errors'))
				}

				if (!definition?.noLogDuration && line.includes('. Watching for file changes.')) {
					line = line.replace('. Watching for file changes.', ` after ${ansicolor.magenta(elapsed(lastStart!.elapsed))}`)
					lastStart = undefined
				}

				Log.info(line)
			}
		}
	}

	export function compile (task: ITaskApi, cwd: string, ...params: string[]) {
		return task.exec({ cwd, stdout: Reformatter() }, 'NPM:tsc', ...params)
	}
}

export default TypeScript;
