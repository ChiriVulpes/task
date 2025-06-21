import Middleware from '../util/Middleware';
export default Middleware((definition, req, res, message = 'File not found') => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end(message);
});
