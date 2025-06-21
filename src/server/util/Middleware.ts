import type { IncomingMessage as HTTPIncomingMessage, RequestListener as HTTPRequestListener, ServerResponse } from 'http'
import Server from '../Server'

type Merge<T1, T2> = { [KEY in keyof T1 | keyof T2]: T2 extends { [OLD_KEY in KEY]?: any } ? T2[KEY] : T1 extends { [NEW_KEY in KEY]?: any } ? T1[KEY] : never }
type PromiseOr<T> = T | Promise<T>

interface IncomingMessageOverride {
	url: string
}

export type IncomingMessage = Merge<HTTPIncomingMessage, IncomingMessageOverride>

export type RequestListener = (req: IncomingMessage, res: ServerResponse) => PromiseOr<any>
export function RequestListener (listener: RequestListener): HTTPRequestListener {
	return listener as HTTPRequestListener
}

export type MiddlewareDefinition<ARGS extends any[] = any[]> = (definition: Server.Definition, req: IncomingMessage, res: ServerResponse, ...args: ARGS) => PromiseOr<ServerResponse | undefined | void>
export type Middleware<ARGS extends any[] = any[]> = (req: IncomingMessage, res: ServerResponse, ...args: ARGS) => PromiseOr<ServerResponse | undefined | void>
export interface MiddlewareSupplier<ARGS extends any[] = any[]> {
	(definition: Server.Definition): Middleware<ARGS>
	(definition: Server.Definition, req?: IncomingMessage, res?: ServerResponse, ...args: any[]): PromiseOr<ServerResponse | undefined | void>
}

/**
 * Return the `ServerResponse` object to indicate the response is handled.
 * Return `undefined` or `void` from the middleware to defer to the next middleware.
 */
function Middleware<ARGS extends any[]> (middleware: MiddlewareDefinition<ARGS>) {
	return ((definition, req, res, ...args) => {
		if (!req || !res)
			return (
				(req, res, ...args) => middleware(definition, req, res, ...args)
			) as Middleware<ARGS>

		return middleware(definition, req, res, ...args as ARGS)
	}) as MiddlewareSupplier<ARGS>
}

export default Middleware
