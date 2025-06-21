"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SYMBOL_IS_TASK_FUNCTION = Symbol('IS_TASK_FUNCTION');
function Task(name, task) {
    Object.defineProperty(task, 'name', { value: name });
    Object.defineProperty(task, SYMBOL_IS_TASK_FUNCTION, { value: true });
    return task;
}
(function (Task) {
    function is(value) {
        return typeof value === 'function' && value[SYMBOL_IS_TASK_FUNCTION];
    }
    Task.is = is;
})(Task || (Task = {}));
exports.default = Task;
