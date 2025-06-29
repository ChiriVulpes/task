"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Middleware_1 = __importDefault(require("../util/Middleware"));
const SendFile_1 = __importDefault(require("../util/SendFile"));
////////////////////////////////////
//#region Load Rewrites
var RewriteCheckType;
(function (RewriteCheckType) {
    RewriteCheckType[RewriteCheckType["Equals"] = 0] = "Equals";
    RewriteCheckType[RewriteCheckType["StartsWith"] = 1] = "StartsWith";
    RewriteCheckType[RewriteCheckType["EndsWith"] = 2] = "EndsWith";
})(RewriteCheckType || (RewriteCheckType = {}));
let rewrites;
function getRewriteChecks(definition) {
    if (rewrites)
        return rewrites;
    const equalsToken = 'http.request.uri.path eq "';
    const notEqualsToken = 'http.request.uri.path ne "';
    const startsWithToken = 'starts_with(http.request.uri.path, "';
    const endsWithToken = 'ends_with(http.request.uri.path, "';
    return rewrites = (definition.spaIndexRewrite?.slice(1, -1) ?? '').split(' and ')
        .map(expr => {
        const check = {};
        if (expr.startsWith('not ')) {
            check.not = true;
            expr = expr.slice(4);
        }
        if (expr.startsWith(startsWithToken)) {
            check.type = RewriteCheckType.StartsWith;
            check.compare = expr.slice(startsWithToken.length, -2);
        }
        if (expr.startsWith(endsWithToken)) {
            check.type = RewriteCheckType.EndsWith;
            check.compare = expr.slice(endsWithToken.length, -2);
        }
        if (expr.startsWith(equalsToken)) {
            check.type = RewriteCheckType.Equals;
            check.compare = expr.slice(equalsToken.length, -1);
        }
        if (expr.startsWith(notEqualsToken)) {
            check.type = RewriteCheckType.Equals;
            check.not = true;
            check.compare = expr.slice(notEqualsToken.length, -1);
        }
        return check;
    });
}
//#endregion
////////////////////////////////////
exports.default = (0, Middleware_1.default)((definition, req, res) => {
    let [url] = req.url.split('?');
    if (url === '/' || url.startsWith('/?'))
        url = definition.serverIndex ?? '/index.html';
    const rewrites = getRewriteChecks(definition);
    const shouldRewrite = rewrites.every(rewrite => {
        let result;
        switch (rewrite.type) {
            case RewriteCheckType.Equals:
                result = rewrite.compare === url;
                break;
            case RewriteCheckType.StartsWith:
                result = url.startsWith(rewrite.compare);
                break;
            case RewriteCheckType.EndsWith:
                result = url.endsWith(rewrite.compare);
                break;
        }
        return rewrite.not ? !result : result;
    });
    if (shouldRewrite)
        url = definition.serverIndex ?? '/index.html';
    url = `.${url}`;
    return (0, SendFile_1.default)(definition, req, res, url);
});
