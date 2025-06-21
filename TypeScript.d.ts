import { ITaskApi } from "./TaskRunner";
declare namespace TypeScript {
    interface ReformatterDefinition {
        noErrorColours?: true;
        noLogDuration?: true;
    }
    function Reformatter(definition?: ReformatterDefinition): (data: string | Buffer) => void;
    function compile(task: ITaskApi, cwd: string, ...params: string[]): Promise<void>;
}
export default TypeScript;
