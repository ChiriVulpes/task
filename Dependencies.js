"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
var Dependencies;
(function (Dependencies) {
    function get(dependency) {
        return promises_1.default.readFile(path_1.default.join(__dirname, `./dependencies/${dependency}.js`), 'utf8');
    }
    Dependencies.get = get;
})(Dependencies || (Dependencies = {}));
exports.default = Dependencies;
