// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./util/https-localhost.d.ts" />

import ansi from 'ansicolor'
import https from 'https'
import { getCerts } from 'https-localhost/certs'
import os from 'os'
import WebSocket from 'ws'
import Log from '../Log'
import { MiddlewareSupplier, RequestListener } from './util/Middleware'

export interface MessageTypeRegistry {

}

interface SocketDefinition {
	onConnect?(socket: WebSocket): any
	onClose?(socket: WebSocket): any
	onMessage?: Record<string, (socket: WebSocket, data: any) => any>
	onInvalidMessageType?(socket: WebSocket, data: any): any
	onInvalidMessage?(socket: WebSocket, message: WebSocket.RawData): any
}

interface Server {
	listen (): Promise<void>
	socket (definition?: SocketDefinition): void
	announce (): void
	sendMessage<TYPE extends keyof MessageTypeRegistry> (type: TYPE, data: NoInfer<MessageTypeRegistry[TYPE]>): void
}

async function Server (definition: Server.Definition) {
	const websocketConnections = new Set<WebSocket>()
	const server = https.createServer(
		{
			...await getCerts(process.env.HOST || 'localhost'),
		},
		RequestListener(async (req, res) => {
			const result = await definition.router(definition, req, res)
			if (!result) {
				res.writeHead(500, { 'Content-Type': 'text/plain' })
				res.end('Internal Server Error')
			}
		}),
	)

	const port = +definition.port! || process.env.PORT

	const result: Server = {
		async listen () {
			return new Promise<void>(resolve => server.listen(port, resolve))
		},
		socket (definition) {
			const wss = new WebSocket.Server({ server })
			wss.on('connection', ws => {
				websocketConnections.add(ws)
				definition?.onConnect?.(ws)

				ws.on('message', message => {
					try {
						// eslint-disable-next-line @typescript-eslint/no-base-to-string
						const parsedMessage = JSON.parse(message.toString('utf8')) as { type?: string, data?: any }
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						const { type, data } = typeof parsedMessage === 'object' && parsedMessage !== null ? parsedMessage : {}

						const handler = definition?.onMessage?.[type!] ?? definition?.onInvalidMessageType
						handler?.(ws, data)
					}
					catch {
						definition?.onInvalidMessage?.(ws, message)
					}
				})

				ws.on('close', () => {
					websocketConnections.delete(ws)
					definition?.onClose?.(ws)
				})
			})
		},
		announce () {
			Log.info('Listening on port', ansi.lightGreen(port))

			const networkInterfaces = os.networkInterfaces()
			Log.info('Serving', ansi.cyan(definition.root), 'on:', ...(definition.hostname ? [definition.hostname]
				: Object.values(networkInterfaces)
					.flatMap(interfaces => interfaces)
					.filter((details): details is os.NetworkInterfaceInfoIPv4 => details?.family === 'IPv4')
					.map(details => details.address))
				.map(hostname => ansi.darkGray(`https://${hostname}:${port}`)))
		},
		sendMessage (type, data) {
			for (const socket of websocketConnections) {
				socket.send(JSON.stringify({
					type,
					data,
				}))
			}
		},
	}

	return result
}

namespace Server {
	export interface Definition {
		router: MiddlewareSupplier<[]>
		root: string
		hostname?: string
		port?: number
		spaIndexRewrite?: string
		serverIndex?: string
	}
}

export default Server
