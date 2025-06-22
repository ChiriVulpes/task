import WebSocket from 'ws';
import { MiddlewareSupplier } from './util/Middleware';
export interface MessageTypeRegistry {
}
interface SocketDefinition {
    onConnect?(socket: WebSocket): any;
    onClose?(socket: WebSocket): any;
    onMessage?: Record<string, (socket: WebSocket, data: any) => any>;
    onInvalidMessageType?(socket: WebSocket, data: any): any;
    onInvalidMessage?(socket: WebSocket, message: WebSocket.RawData): any;
}
interface Server {
    listen(): Promise<void>;
    socket(definition?: SocketDefinition): void;
    announce(): void;
}
declare function Server(definition: Server.Definition): Promise<Server>;
declare namespace Server {
    interface Definition {
        router: MiddlewareSupplier<[]>;
        root: string;
        hostname?: string;
        port?: number;
        urlRewrite?: string;
    }
    function sendMessage<TYPE extends keyof MessageTypeRegistry>(type: TYPE, data: NoInfer<MessageTypeRegistry[TYPE]>): void;
}
export default Server;
