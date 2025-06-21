type LogFunction = (...what: any[]) => void;
interface ILog {
    info: LogFunction;
    warn: LogFunction;
    error: LogFunction;
    setSources(...sources: string[]): ILog;
}
declare namespace ILog {
    function is(value: unknown): value is ILog;
}
export interface ILogSource {
    log: ILog;
}
export declare namespace ILogSource {
    function is(value: unknown): value is ILogSource;
}
declare let Log: LogImplementation;
declare class LogImplementation implements ILog {
    private source;
    info(...what: unknown[]): void;
    warn(...what: unknown[]): void;
    error(...what: unknown[]): void;
    setSources(...sources: string[]): this;
    get(source: unknown): ILog;
    get(...sources: string[]): ILog;
    new(...sources: string[]): ILog;
}
export default Log;
