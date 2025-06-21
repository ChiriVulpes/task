"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
var Hash;
(function (Hash) {
    async function file(filepath) {
        const stream = fs_1.default.createReadStream(filepath);
        const hash = crypto_1.default.createHash('sha1');
        hash.setEncoding('hex');
        return new Promise(resolve => {
            stream.on('end', function () {
                hash.end();
                resolve(hash.read());
            });
            stream.pipe(hash);
        });
    }
    Hash.file = file;
    const hashes = {};
    async function fileChanged(filepath) {
        const resolvedPath = path_1.default.resolve(filepath);
        const hash = await file(resolvedPath);
        if (hash === hashes[resolvedPath])
            return false;
        hashes[resolvedPath] = hash;
        return true;
    }
    Hash.fileChanged = fileChanged;
})(Hash || (Hash = {}));
exports.default = Hash;
