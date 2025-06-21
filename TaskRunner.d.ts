#!/usr/bin/env node
import type { TaskFunction, TaskFunctionDef } from './Task';
export interface ITaskApi {
    noErrors?: true;
    lastError?: Error;
    series(...tasks: TaskFunctionDef<any>[]): TaskFunction<any>;
    parallel(...tasks: TaskFunctionDef<any>[]): TaskFunction<any>;
    run<T, ARGS extends any[]>(task: TaskFunctionDef<T, ARGS>, ...args: ARGS): Promise<T>;
    try<T, ARGS extends any[]>(task: TaskFunctionDef<T, ARGS>, ...args: ARGS): Promise<T>;
    debounce<T, ARGS extends any[]>(task: TaskFunctionDef<T, ARGS>, ...args: ARGS): void;
    watch(globs: string[], task: TaskFunctionDef<unknown, [string]>, delay?: number): void;
}
