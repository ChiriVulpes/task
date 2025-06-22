import fs from 'fs/promises'
import path from 'path'

namespace Dependencies {
	export function get (dependency: string) {
		return fs.readFile(path.join(__dirname, `./dependencies/${dependency}.js`), 'utf8')
	}
}

export default Dependencies
