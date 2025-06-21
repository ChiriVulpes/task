"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
var JSON5;
(function (JSON5) {
    async function readFile(path) {
        let text;
        try {
            text = await fs_1.default.promises.readFile(path, 'utf8');
        }
        catch (err) {
            throw new Error(`Failed to read ${path}`, { cause: err });
        }
        try {
            return parse(text);
        }
        catch (err) {
            throw new Error(`Failed to parse ${path}`, { cause: err });
        }
    }
    JSON5.readFile = readFile;
    function convertToJSON(text) {
        return text
            .replace(/\s*\/\/[^\n"]*(?=\n)/g, '')
            .replace(/(?<=\n)\s*\/\/[^\n]*(?=\n)/g, '')
            .replace(/,(?=[^}\]"\d\w_-]*?[}\]])/gs, '')
            .replace(/(?<=[{,]\s*)([\w_]+)(?=:)/g, '"$1"');
    }
    JSON5.convertToJSON = convertToJSON;
    function parse(text) {
        text = convertToJSON(text);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return JSON.parse(text);
    }
    JSON5.parse = parse;
})(JSON5 || (JSON5 = {}));
exports.default = JSON5;
