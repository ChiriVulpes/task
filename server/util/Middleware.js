export function RequestListener(listener) {
    return listener;
}
/**
 * Return the `ServerResponse` object to indicate the response is handled.
 * Return `undefined` or `void` from the middleware to defer to the next middleware.
 */
function Middleware(middleware) {
    return ((definition, req, res, ...args) => {
        if (!req || !res)
            return ((req, res, ...args) => middleware(definition, req, res, ...args));
        return middleware(definition, req, res, ...args);
    });
}
export default Middleware;
