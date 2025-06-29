"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const E404_1 = __importDefault(require("../middleware/E404"));
async function default_1(definition, req, res, filePath) {
    const dirname = path.dirname(filePath);
    const basename = path.basename(filePath).replace(/\?.*$/, '');
    let fullPath = path.resolve(definition.root, dirname, basename);
    // Use await with catch to handle errors directly
    let buffer = await fs.readFile(fullPath)
        .catch(() => {
        fullPath = `${fullPath}/index.html`;
        return fs.readFile(fullPath);
    })
        .catch(() => undefined);
    if (buffer === undefined)
        // If fileContent is undefined, file was not found or error occurred
        return (0, E404_1.default)(definition, req, res);
    const contentType = getContentType(fullPath);
    if (contentType.includes('text') || contentType === 'application/json' || contentType === 'application/javascript') {
        let fileContent = buffer.toString('utf8');
        buffer = Buffer.from(fileContent);
    }
    res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': buffer.length,
    });
    return res.end(buffer);
}
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.html': return 'text/html';
        case '.css': return 'text/css';
        case '.js': return 'application/javascript';
        case '.json': return 'application/json';
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.pdf': return 'application/pdf';
        case '.wasm': return 'application/wasm';
        case '.woff': return 'font/woff';
        case '.woff2': return 'font/woff2';
        case '.ttf': return 'font/ttf';
        case '.otf': return 'font/otf';
        case '.svg': return 'image/svg+xml';
        case '.ico': return 'image/x-icon';
        case '.xml': return 'application/xml';
        case '.txt': return 'text/plain';
    }
    return 'application/octet-stream';
}
