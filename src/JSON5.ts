import fs from "fs"

namespace JSON5 {
	export async function readFile<T = any> (path: string): Promise<T> {
		let text: string
		try {
			text = await fs.promises.readFile(path, 'utf8')
		}
		catch (err) {
			throw new Error(`Failed to read ${path}`, { cause: err })
		}

		try {
			return parse(text)
		}
		catch (err) {
			throw new Error(`Failed to parse ${path}`, { cause: err })
		}
	}

	export function convertToJSON (text: string): string {
		return text
			.replace(/\s*\/\/[^\n"]*(?=\n)/g, '')
			.replace(/(?<=\n)\s*\/\/[^\n]*(?=\n)/g, '')
			.replace(/,(?=[^}\]"\d\w_-]*?[}\]])/gs, '')
			.replace(/(?<=[{,]\s*)([\w_]+)(?=:)/g, '"$1"')
	}

	export function parse<T = any> (text: string): T {
		text = convertToJSON(text)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return JSON.parse(text)
	}
}

export default JSON5
