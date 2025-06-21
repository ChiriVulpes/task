import type { AnsicolorMethods } from 'ansicolor';
export type ISOString = `${bigint}-${'0' | ''}${bigint}-${'0' | ''}${bigint}T${'0' | ''}${bigint}:${'0' | ''}${bigint}:${'0' | ''}${bigint}Z`;
export type Stopwatch = ReturnType<typeof stopwatch>;
export declare function stopwatch(): {
    readonly elapsed: number;
    stop: () => void;
    time: () => string;
};
export declare function elapsed(elapsed: number): string;
export declare function timestamp(color?: keyof AnsicolorMethods): string;
export default class Time {
    static get lastDailyReset(): number;
    static get lastWeeklyReset(): number;
    static get lastTrialsReset(): number;
    static get nextDailyReset(): number;
    static get nextWeeklyReset(): number;
    static minutes(minutes: number): number;
    static hours(hours: number): number;
    static days(days: number): number;
    static weeks(weeks: number): number;
    static iso(time?: Date | number | string): ISOString;
}
