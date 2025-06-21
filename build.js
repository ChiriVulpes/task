const childProcess = require('child_process');
const fs = require('fs');
const util = require('util');

const exec = util.promisify(childProcess.exec);

(async () => {
	await fs.promises.rm("out", { recursive: true, force: true });
	await fs.promises.mkdir("out", { recursive: true });

	const packageJson = /** @type {Partial<typeof import('./package.json')>} */(JSON.parse(await fs.promises.readFile("package.json", "utf8")));
	delete packageJson.private;
	delete packageJson.scripts;
	delete packageJson.devDependencies;
	// delete packageJson.overrides;

	await fs.promises.writeFile("out/package.json", JSON.stringify(packageJson, null, 2) + "\n");
	await fs.promises.writeFile("out/.gitignore", "node_modules/\n")

	await fs.promises.copyFile("README.md", "out/README.md");
	await fs.promises.copyFile("LICENSE", "out/LICENSE");

	let { stdout, stderr } = await exec('tsc --project src/tsconfig.json');
	console.log(stdout);
	console.error(stderr);

	process.chdir("out");
	({ stdout, stderr } = await exec('npm install --no-audit --no-fund'));
	console.log(stdout);
	console.error(stderr);
})();
