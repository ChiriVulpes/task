import * as fs from 'fs/promises'
import type { ServerResponse } from 'http'
import * as path from 'path'
import E404 from '../middleware/E404'
import Server from '../Server'
import type { IncomingMessage } from './Middleware'

export default async function (definition: Server.Definition, req: IncomingMessage, res: ServerResponse, filePath: string): Promise<ServerResponse | void | undefined> {
	const dirname = path.dirname(filePath)
	const basename = path.basename(filePath).replace(/\?.*$/, '')
	let fullPath = path.resolve(definition.root, dirname, basename)

	// Use await with catch to handle errors directly
	let buffer = await fs.readFile(fullPath)
		.catch(() => {
			fullPath = `${fullPath}/index.html`
			return fs.readFile(fullPath)
		})
		.catch(() => undefined)

	if (buffer === undefined)
		// If fileContent is undefined, file was not found or error occurred
		return E404(definition, req, res)

	const contentType = getContentType(fullPath)
	if (contentType.includes('text') || contentType === 'application/json' || contentType === 'application/javascript') {
		let fileContent = buffer.toString('utf8')
		buffer = Buffer.from(fileContent)
	}

	res.writeHead(200, {
		'Content-Type': contentType,
		'Content-Length': buffer.length,
	})
	return res.end(buffer)
}

function getContentType (filePath: string) {
	const ext = path.extname(filePath).toLowerCase()
	switch (ext) {
		case '.html': return 'text/html'
		case '.css': return 'text/css'
		case '.js': return 'application/javascript'
		case '.json': return 'application/json'
		case '.png': return 'image/png'
		case '.jpg': case '.jpeg': return 'image/jpeg'
		case '.gif': return 'image/gif'
		case '.pdf': return 'application/pdf'
		case '.wasm': return 'application/wasm'
		case '.woff': return 'font/woff'
		case '.woff2': return 'font/woff2'
		case '.ttf': return 'font/ttf'
		case '.otf': return 'font/otf'
		case '.svg': return 'image/svg+xml'
		case '.ico': return 'image/x-icon'
		case '.xml': return 'application/xml'
		case '.txt': return 'text/plain'
	}

	return 'application/octet-stream'
}
