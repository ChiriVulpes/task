#!/usr/bin/env node
import type { TaskFunction, TaskFunctionDef } from './Task';
export interface ITaskCLIOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdout?(data: string): any;
    stderr?(data: string): any;
}
export interface ITaskApi {
    noErrors?: true;
    lastError?: Error;
    series(...tasks: TaskFunctionDef<any>[]): TaskFunction<any>;
    parallel(...tasks: TaskFunctionDef<any>[]): TaskFunction<any>;
    run<T, ARGS extends any[]>(task: TaskFunctionDef<T, ARGS>, ...args: ARGS): Promise<T>;
    try<T, ARGS extends any[]>(task: TaskFunctionDef<T, ARGS>, ...args: ARGS): Promise<T>;
    debounce<T, ARGS extends any[]>(task: TaskFunctionDef<T, ARGS>, ...args: ARGS): void;
    watch(globs: string | string[], task: TaskFunctionDef<unknown, [string]>, delay?: number): void;
    exec(command: string, ...args: string[]): Promise<void>;
    exec(options: ITaskCLIOptions, command: string, ...args: string[]): Promise<void>;
    install(...packages: Project[]): Promise<void>;
}
interface Project {
    path: string;
    dependencies?: Record<string, GitHubDependency | NPMDependency>;
}
interface NPMDependency {
    name: string;
    tag?: string;
}
interface GitHubDependency {
    repo: string;
    branch?: string;
}
export {};
