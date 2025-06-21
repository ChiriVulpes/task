// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./util/https-localhost.d.ts" />
import ansi from 'ansicolor';
import https from 'https';
import { getCerts } from 'https-localhost/certs';
import os from 'os';
import WebSocket from 'ws';
import Log from '../Log';
const websocketConnections = new Set();
async function Server(definition) {
    const server = https.createServer({
        ...await getCerts(process.env.HOST || 'localhost'),
    }, definition.router);
    const port = +definition.port || 8095;
    const result = {
        async listen() {
            return new Promise(resolve => server.listen(port, resolve));
        },
        socket(definition) {
            const wss = new WebSocket.Server({ server });
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
            Log.info('Listening on port', ansi.lightGreen(port));
            const networkInterfaces = os.networkInterfaces();
            Log.info('Serving', ansi.cyan(definition.root), 'on:', ...(definition.hostname ? [definition.hostname]
                : Object.values(networkInterfaces)
                    .flatMap(interfaces => interfaces)
                    .filter((details) => details?.family === 'IPv4')
                    .map(details => details.address))
                .map(hostname => ansi.darkGray(`https://${hostname}:${port}`)));
        },
    };
    return result;
}
(function (Server) {
    function sendMessage(type, data) {
        for (const socket of websocketConnections) {
            socket.send(JSON.stringify({
                type,
                data,
            }));
        }
    }
    Server.sendMessage = sendMessage;
})(Server || (Server = {}));
export default Server;
