"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Middleware_1 = __importDefault(require("../util/Middleware"));
exports.default = (0, Middleware_1.default)((definition, req, res, message = 'File not found') => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end(message);
});
