import Middleware from '../util/Middleware'

export default Middleware<[message?: string]>((definition, req, res, message: string = 'File not found') => {
	res.writeHead(404, { 'Content-Type': 'text/plain' })
	return res.end(message)
})
