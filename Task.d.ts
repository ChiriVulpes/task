import type { ITaskApi } from './TaskRunner';
declare const SYMBOL_IS_TASK_FUNCTION: unique symbol;
export type TaskFunctionDef<T, ARGS extends any[] = []> = (api: ITaskApi, ...args: ARGS) => T;
export interface TaskFunction<T, ARGS extends any[] = []> extends TaskFunctionDef<T, ARGS> {
    [SYMBOL_IS_TASK_FUNCTION]: true;
}
declare function Task<T, ARGS extends any[] = []>(name: string | null, task: TaskFunctionDef<T, ARGS>): TaskFunction<T, ARGS>;
declare namespace Task {
    function is(value: unknown): value is TaskFunction<unknown>;
    interface ITaskCLIOptions {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        stdout?(data: string): any;
        stderr?(data: string): any;
    }
    function cli(command: string, ...args: string[]): Promise<void>;
    function cli(options: ITaskCLIOptions, command: string, ...args: string[]): Promise<void>;
}
export default Task;
