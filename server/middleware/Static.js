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
})(RewriteCheckType || (RewriteCheckType = {}));
let rewrites;
function getRewriteChecks(definition) {
    if (rewrites)
        return rewrites;
    const equalsToken = 'http.request.uri.path eq "';
    const notEqualsToken = 'http.request.uri.path ne "';
    const startsWithToken = 'starts_with(http.request.uri.path, "';
    return rewrites = (definition.urlRewrite?.slice(1, -1) ?? '').split(' and ')
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
    if (req.url === '/' || req.url.startsWith('/?'))
        req.url = '/index.html';
    const rewrites = getRewriteChecks(definition);
    const shouldRewrite = rewrites.every(rewrite => {
        let result;
        switch (rewrite.type) {
            case RewriteCheckType.Equals:
                result = rewrite.compare === req.url;
                break;
            case RewriteCheckType.StartsWith:
                result = req.url.startsWith(rewrite.compare);
                break;
        }
        return rewrite.not ? !result : result;
    });
    if (shouldRewrite)
        req.url = '/index.html';
    req.url = `.${req.url}`;
    return (0, SendFile_1.default)(definition, req, res, req.url);
});
