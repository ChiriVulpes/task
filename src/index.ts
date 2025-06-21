import Hash from "./Hash"
import Log from "./Log"
import Model from "./Model"
import E404 from "./server/middleware/E404"
import Static from "./server/middleware/Static"
import Server from "./server/Server"
import MiddlewareBase from "./server/util/Middleware"
import Task from "./Task"
import { ITaskApi } from "./TaskRunner"
import Time from "./Time"
import TypeScript from "./TypeScript"

const Middleware = Object.assign(MiddlewareBase, {
	Static,
	E404,
})

export { Hash, ITaskApi, Log, Middleware, Model, Server, Task, Time, TypeScript }

