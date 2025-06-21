import type { ITaskApi } from './TaskRunner'

const SYMBOL_IS_TASK_FUNCTION = Symbol('IS_TASK_FUNCTION')

export type TaskFunctionDef<T, ARGS extends any[] = []> = (api: ITaskApi, ...args: ARGS) => T
export interface TaskFunction<T, ARGS extends any[] = []> extends TaskFunctionDef<T, ARGS> {
	[SYMBOL_IS_TASK_FUNCTION]: true
}

function Task<T, ARGS extends any[] = []> (name: string | null, task: TaskFunctionDef<T, ARGS>) {
	Object.defineProperty(task, 'name', { value: name })
	Object.defineProperty(task, SYMBOL_IS_TASK_FUNCTION, { value: true })
	return task as TaskFunction<T, ARGS>
}

namespace Task {

	export function is (value: unknown): value is TaskFunction<unknown> {
		return typeof value === 'function' && (value as TaskFunction<unknown>)[SYMBOL_IS_TASK_FUNCTION]
	}

}

export default Task
