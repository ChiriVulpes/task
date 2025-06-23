"use strict";
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./util/https-localhost.d.ts" />
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ansicolor_1 = __importDefault(require("ansicolor"));
const https_1 = __importDefault(require("https"));
const certs_1 = require("https-localhost/certs");
const os_1 = __importDefault(require("os"));
const ws_1 = __importDefault(require("ws"));
const Log_1 = __importDefault(require("../Log"));
const Middleware_1 = require("./util/Middleware");
async function Server(definition) {
    const websocketConnections = new Set();
    const server = https_1.default.createServer({
        ...await (0, certs_1.getCerts)(process.env.HOST || 'localhost'),
    }, (0, Middleware_1.RequestListener)(async (req, res) => {
        const result = await definition.router(definition, req, res);
        if (!result) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }));
    const port = +definition.port || 8095;
    const result = {
        async listen() {
            return new Promise(resolve => server.listen(port, resolve));
        },
        socket(definition) {
            const wss = new ws_1.default.Server({ server });
            wss.on('connection', ws => {
                websocketConnections.add(ws);
                definition?.onConnect?.(ws);
                ws.on('message', message => {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-base-to-string
                        const parsedMessage = JSON.parse(message.toString('utf8'));
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        const { type, data } = typeof parsedMessage === 'object' && parsedMessage !== null ? parsedMessage : {};
                        const handler = definition?.onMessage?.[type] ?? definition?.onInvalidMessageType;
                        handler?.(ws, data);
                    }
                    catch {
                        definition?.onInvalidMessage?.(ws, message);
                    }
                });
                ws.on('close', () => {
                    websocketConnections.delete(ws);
                    definition?.onClose?.(ws);
                });
            });
        },
        announce() {
            Log_1.default.info('Listening on port', ansicolor_1.default.lightGreen(port));
            const networkInterfaces = os_1.default.networkInterfaces();
            Log_1.default.info('Serving', ansicolor_1.default.cyan(definition.root), 'on:', ...(definition.hostname ? [definition.hostname]
                : Object.values(networkInterfaces)
                    .flatMap(interfaces => interfaces)
                    .filter((details) => details?.family === 'IPv4')
                    .map(details => details.address))
                .map(hostname => ansicolor_1.default.darkGray(`https://${hostname}:${port}`)));
        },
        sendMessage(type, data) {
            for (const socket of websocketConnections) {
                socket.send(JSON.stringify({
                    type,
                    data,
                }));
            }
        },
    };
    return result;
}
exports.default = Server;
