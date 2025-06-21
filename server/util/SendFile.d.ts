import type { ServerResponse } from 'http';
import Server from '../Server';
import type { IncomingMessage } from './Middleware';
export default function (definition: Server.Definition, req: IncomingMessage, res: ServerResponse, filePath: string): Promise<ServerResponse | void | undefined>;
