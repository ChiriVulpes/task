import Server from '../Server'
import Middleware from '../util/Middleware'
import SendFile from '../util/SendFile'

////////////////////////////////////
//#region Load Rewrites

enum RewriteCheckType {
	Equals,
	StartsWith,
	EndsWith,
}

interface RewriteCheck {
	type: RewriteCheckType
	not?: true
	compare: string
}

let rewrites: RewriteCheck[] | undefined
function getRewriteChecks (definition: Server.Definition) {
	if (rewrites)
		return rewrites

	const equalsToken = 'http.request.uri.path eq "'
	const notEqualsToken = 'http.request.uri.path ne "'
	const startsWithToken = 'starts_with(http.request.uri.path, "'
	const endsWithToken = 'ends_with(http.request.uri.path, "'
	return rewrites = (definition.spaIndexRewrite?.slice(1, -1) ?? '').split(' and ')
		.map(expr => {
			const check: Partial<RewriteCheck> = {}
			if (expr.startsWith('not ')) {
				check.not = true
				expr = expr.slice(4)
			}

			if (expr.startsWith(startsWithToken)) {
				check.type = RewriteCheckType.StartsWith
				check.compare = expr.slice(startsWithToken.length, -2)
			}

			if (expr.startsWith(endsWithToken)) {
				check.type = RewriteCheckType.EndsWith
				check.compare = expr.slice(endsWithToken.length, -2)
			}

			if (expr.startsWith(equalsToken)) {
				check.type = RewriteCheckType.Equals
				check.compare = expr.slice(equalsToken.length, -1)
			}

			if (expr.startsWith(notEqualsToken)) {
				check.type = RewriteCheckType.Equals
				check.not = true
				check.compare = expr.slice(notEqualsToken.length, -1)
			}

			return check as RewriteCheck
		})
}

//#endregion
////////////////////////////////////

export default Middleware((definition, req, res) => {
	let [url] = req.url.split('?')
	if (url === '/' || url.startsWith('/?'))
		url = definition.serverIndex ?? '/index.html'

	const rewrites = getRewriteChecks(definition)
	const shouldRewrite = rewrites.every(rewrite => {
		let result: boolean
		switch (rewrite.type) {
			case RewriteCheckType.Equals:
				result = rewrite.compare === url
				break
			case RewriteCheckType.StartsWith:
				result = url.startsWith(rewrite.compare)
				break
			case RewriteCheckType.EndsWith:
				result = url.endsWith(rewrite.compare)
				break
		}
		return rewrite.not ? !result : result
	})

	if (shouldRewrite)
		url = definition.serverIndex ?? '/index.html'

	url = `.${url}`

	return SendFile(definition, req, res, url)
})
