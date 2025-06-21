"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScript = exports.Time = exports.Task = exports.Server = exports.Model = exports.Middleware = exports.Log = exports.Hash = void 0;
const Hash_1 = __importDefault(require("./Hash"));
exports.Hash = Hash_1.default;
const Log_1 = __importDefault(require("./Log"));
exports.Log = Log_1.default;
const Model_1 = __importDefault(require("./Model"));
exports.Model = Model_1.default;
const E404_1 = __importDefault(require("./server/middleware/E404"));
const Static_1 = __importDefault(require("./server/middleware/Static"));
const Server_1 = __importDefault(require("./server/Server"));
exports.Server = Server_1.default;
const Middleware_1 = __importDefault(require("./server/util/Middleware"));
const Task_1 = __importDefault(require("./Task"));
exports.Task = Task_1.default;
const Time_1 = __importDefault(require("./Time"));
exports.Time = Time_1.default;
const TypeScript_1 = __importDefault(require("./TypeScript"));
exports.TypeScript = TypeScript_1.default;
const Middleware = Object.assign(Middleware_1.default, {
    Static: Static_1.default,
    E404: E404_1.default,
});
exports.Middleware = Middleware;
