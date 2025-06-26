(() => {
	const baseURL = self.document?.currentScript?.dataset.baseUrl

	/**
	 * @enum {number}
	 */
	const ModuleState = {
		Unprocessed: 0,
		Waiting: 1,
		Processed: 2,
		Error: 3,
	}

	/**
	 * @typedef {(module: string) => any} ModuleGetter
	 */

	/**
	 * @typedef {(modules: string[], resolve: (module: any) => void, reject: (err?: any) => any) => void} ModuleGetterAsync
	 */

	/**
	 * @typedef {(getModule: ModuleGetter | ModuleGetterAsync, module: Module, ...args: any[]) => any} ModuleInitializer
	 */

	/**
	 * @typedef {Object} Module
	 * @property {true} __esModule - Indicates that this module is an ES module.
	 * @property {string} _name - The name of the module.
	 * @property {ModuleState} _state - The current state of the module.
	 * @property {string[]} _requirements - An array of module names that this module depends on.
	 * @property {ModuleInitializer} _initializer - The function that initializes the module.
	 * @property {Error} [_error] - An error that occurred during module initialization, if any.
	 * @property {boolean} _init - Whether the module should be initialized immediately.
	 * @property {true} [_allowRedefine] - Whether the module can be redefined.
	 * @property {(module: Module) => void} _replace - A function to replace the module
	 * @property {(nameOrNames: string | string[], resolve?: (module: any) => void, reject?: (err?: any) => void) => void | Module} [require] - A function to require other modules.
	 * @property {any} [default] - The default export of the module.
	 */

	/**
	 * @type {Map<string, Module>}
	 */
	const moduleMap = new Map()
	/**
	 * @type {Set<string>}
	 */
	const requirements = new Set()

	/** @type {string | undefined} */
	let nextName
	/**
	 * @param {string | string[]} name
	 * @param {string[] | ModuleInitializer} reqs
	 * @param {ModuleInitializer?} fn
	 */
	function define (name, reqs, fn) {
		if (typeof name === "function" && !nextName)
			throw new Error("Cannot define module without a name")

		if (typeof name === "function")
			fn = name, name = /** @type {string} */ (nextName), nextName = undefined

		if (Array.isArray(name)) {
			fn = /** @type {ModuleInitializer} */ (reqs)
			reqs = name

			const src = self.document?.currentScript?.getAttribute("src") || self.document?.currentScript?.getAttribute("data-src")
			if (!src)
				throw new Error("Cannot define module without a name")

			name = src.startsWith("./") ? src.slice(2) : src.startsWith("/") ? src.slice(1) : src
			const qIndex = name.indexOf("?")
			name = qIndex === -1 ? name : name.slice(0, qIndex)
			name = baseURL && name.startsWith(baseURL) ? name.slice(baseURL.length) : name
			name = name.endsWith(".js") ? name.slice(0, -3) : name
			name = name.endsWith("/index") ? name.slice(0, -6) : name
		}

		reqs ??= []

		const existingDefinition = moduleMap.get(name)
		if (existingDefinition && !existingDefinition._allowRedefine)
			throw new Error(`Module "${name}" cannot be redefined`)

		if (typeof reqs === "function") {
			if (fn)
				throw new Error("Unsupport define call")

			fn = reqs
			reqs = []
		}

		const _requirements = reqs.slice(2).map(req => findModuleName(name, req))
		const initialiser = /** @type {ModuleInitializer} */ (fn)
		/**
		 * @type {Module}
		 */
		const module = {
			__esModule: true,
			_name: name,
			_state: ModuleState.Unprocessed,
			_requirements,
			_initializer: initialiser,
			_init: self.document?.currentScript?.dataset.init === name,
			_replace (newModule) {
				if (typeof newModule !== "object" && typeof newModule !== "function")
					throw new Error("Cannot assign module.exports to a non-object")

				newModule._name = name
				newModule._state = ModuleState.Unprocessed
				newModule._requirements = _requirements
				newModule._initializer = initialiser
				newModule._replace = module._replace
				moduleMap.set(name, newModule)
			},
		}
		moduleMap.set(name, module)
		for (const req of module._requirements)
			requirements.add(req)

		const preload = name.endsWith("$preload")
		if (preload) {
			if (module._requirements.length)
				throw new Error(`Module "${name}" cannot import other modules`)

			initializeModule(module)
		}

		if (initialProcessCompleted)
			processModules()
	}

	define.amd = true
	define.nameNext = function (name) {
		nextName = name
	}

	/**
	 * @param {string} name 
	 */
	function allowRedefine (name) {
		const module = moduleMap.get(name)
		if (!module)
			return

		module._allowRedefine = true
	}

	/**
	 * @param {string} name
	 * @param {string[]} [requiredBy]
	 */
	function getModule (name, requiredBy) {
		requiredBy ??= []
		let module = moduleMap.get(name)
		if (!module) {
			if (name.endsWith(".js"))
				name = name.slice(0, -3)

			if (name.startsWith(".")) {
				let from = requiredBy[requiredBy.length - 1]
				if (!from.includes("/"))
					from += "/"

				name = findModuleName(from, name)
			}

			module = moduleMap.get(name)
			if (!module)
				throw new Error(`Module "${name}" has not been declared and cannot be required`)
		}

		if (module._state === ModuleState.Unprocessed)
			module = processModule(name, module, requiredBy)

		return module
	}

	/**
	 * @param {string} name
	 */
	function initializeModuleByName (name) {
		const module = getModule(name)
		if (!module)
			throw new Error(`Module "${name}" has not been declared and cannot be initialized`)
		initializeModule(module)
	}

	/**
	 * @param {Module} module
	 * @param {string[]} [requiredBy]
	 * @param {...any} args 
	 */
	function initializeModule (module, requiredBy, ...args) {
		if (module._state)
			throw new Error(`Module "${module._name}" has already been processed`)

		requiredBy ??= []

		try {
			requiredBy = [...requiredBy, module._name]

			/**
			 * @param {string | string[]} nameOrNames
			 * @param {(module: any) => void} [resolve]
			 * @param {(err?: any) => void} [reject]
			 */
			function require (nameOrNames, resolve, reject) {
				if (Array.isArray(nameOrNames)) {
					const results = nameOrNames.map(name => getModule(name, requiredBy))
					return resolve?.(results.length === 1 ? results[0] : results)
				}

				return getModule(nameOrNames, requiredBy)
			}

			module.require = require

			const result = module._initializer(require, module, ...args)
			if (module.default === undefined) {
				module.default = result ?? module
				module.__esModule = true
			}

			const mapCopy = moduleMap.get(module._name)
			if (!mapCopy)
				throw new Error(`Module "${module._name}" has not been defined or has been removed during initialization`)

			module = mapCopy
			module._state = ModuleState.Processed

			injectModule(module)

		} catch (err) {
			module._state = ModuleState.Error
			module._error = err
			err.message = `[Module initialization ${module._name}] ${err.message}`
			console.error(err)
		}
	}

	const isInjectableModuleDefaultNameRegex = /^[A-Z_$][a-zA-Z_$0-9]+$/
	function injectModule (module) {
		const name = module._name
		const inject = module.default ?? module
		const moduleDefaultName = basename(name)
		if (isInjectableModuleDefaultNameRegex.test(moduleDefaultName) && !(moduleDefaultName in self))
			Object.assign(self, { [moduleDefaultName]: inject })

		for (const key of Object.keys(module)) {
			if (key !== "default" && !key.startsWith("_") && isInjectableModuleDefaultNameRegex.test(key) && !(key in self)) {
				Object.assign(self, { [key]: module[key] })
			}
		}
	}


	////////////////////////////////////
	// Add the above functions to "self"
	//

	/**
	 * @typedef {Object} SelfExtensions
	 * @property {typeof define} define
	 * @property {typeof getModule} getModule
	 * @property {typeof initializeModuleByName} initializeModule
	 * @property {(name: string) => boolean} hasModule
	 * @property {typeof allowRedefine} allowRedefine
	 */

	const extensibleSelf = /** @type {Window & typeof globalThis & SelfExtensions} */(self)
	extensibleSelf.define = define
	extensibleSelf.getModule = getModule
	extensibleSelf.initializeModule = initializeModuleByName
	extensibleSelf.allowRedefine = allowRedefine
	extensibleSelf.hasModule = name => moduleMap.has(name)


	////////////////////////////////////
	// Actually process the modules
	//

	self.document?.addEventListener("DOMContentLoaded", processModules)

	let initialProcessCompleted = false
	async function processModules () {
		const scriptsStillToImport = Array.from(self.document?.querySelectorAll("template[data-script]") ?? [])
			.map(definition => {
				const script = /** @type {HTMLTemplateElement} */ (definition).dataset.script
				definition.remove()
				return script
			})

		await Promise.all(Array.from(new Set(scriptsStillToImport))
			.filter((v) => v !== undefined)
			.map(tryImportAdditionalModule)
		)

		while (requirements.size) {
			const remainingRequirements = Array.from(requirements)
			await Promise.all(remainingRequirements.map(tryImportAdditionalModule))
			for (const req of remainingRequirements)
				requirements.delete(req)
		}

		for (const [name, module] of moduleMap.entries())
			if (module._init)
				processModule(name, module)

		initialProcessCompleted = true
	}

	/**
	 * @param {string} req 
	 */
	async function tryImportAdditionalModule (req) {
		if (moduleMap.has(req))
			return

		await importAdditionalModule(req)

		if (!moduleMap.has(req))
			throw new Error(`The required module '${req}' could not be asynchronously loaded.`)
	}

	/**
	 * @param {string} req
	 */
	async function importAdditionalModule (req) {
		if (self.document) {
			const script = document.createElement("script")
			document.head.appendChild(script)
			/** @type {Promise<void>} */
			const promise = new Promise(resolve => script.addEventListener("load", () => resolve()))
			script.src = `/script/${req}.js`
			return promise
		}
		else {
			self.importScripts(`/script/${req}.js`)
		}
	}

	/**
	 * @param {string} name 
	 * @param {Module | undefined} module 
	 * @param {string[]} requiredBy 
	 */
	function processModule (name, module = moduleMap.get(name), requiredBy = []) {
		if (!module)
			throw new Error(`No "${name}" module defined`)

		if (module._state === ModuleState.Waiting)
			throw new Error(`Circular dependency! Dependency chain: ${[...requiredBy, name].map(m => `"${m}"`).join(" > ")}`)

		if (!module._state) {
			module._state = ModuleState.Waiting
			const args = module._requirements
				.map(req => processModule(req, undefined, [...requiredBy, name]))

			module._state = ModuleState.Unprocessed
			initializeModule(module, requiredBy, ...args)
		}

		return moduleMap.get(name)
	}


	////////////////////////////////////
	// Utils
	//

	/**
	 * @param {string} name 
	 * @param {string} requirement 
	 */
	function findModuleName (name, requirement) {
		let root = dirname(name)
		if (requirement.startsWith("./"))
			return join(root, requirement.slice(2))

		while (requirement.startsWith("../"))
			root = dirname(root), requirement = requirement.slice(3)

		return requirement // join(root, requirement);
	}

	/**
	 * @param {string} name 
	 */
	function dirname (name) {
		const lastIndex = name.lastIndexOf("/")
		return lastIndex === -1 ? "" : name.slice(0, lastIndex)
	}

	/**
	 * @param {string} name 
	 */
	function basename (name) {
		const lastIndex = name.lastIndexOf("/")
		return name.slice(lastIndex + 1)
	}

	/**
	 * @param  {...string} path 
	 */
	function join (...path) {
		return path.filter(p => p).join("/")
	}
})()
