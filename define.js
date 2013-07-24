// # Define #
//
// Asynchronous Module Definition wrapper for Node.js. For example:
//
//	   define(['exports', 'http'], function(exports, http) {
//		   exports.helloServer = function(port) {
//			   return http.createServer(handle).listen(port);
//		   };
//
//		   function handle(req, res) {
//			   res.writeHead(200, {'Content-Type': 'text/plain'});
//			   res.end('Hello World\n');
//		   }
//	   });
//
// See the [AMD Wiki][0] for more information.
//
// [0]: https://github.com/amdjs/amdjs-api/wiki/AMD


var Module = require('module').Module,
	Url = require('url'),
	Require = require,
	Define = global.define;


// define
//
// define([ ... ], function( ... ));
// define(String, [ ... ], function( ... ))
//
// Modules exports may be created with a factory function. An array of
// dependencies is resolved and the factory is applied to them. If the
// factory returns something, this value is used as the module's
// exports. Otherwise, the factory binds names into `this` (or
// `exports` if imported as a dependency). An String id is optional.
//
//
// define(function(require, exports, module))
// define(String, function(require, exports, module))
//
// If no dependencies are given, the default is `['require',
// 'exports', 'module']`.
//
//
// define({ ... })
// define(String, { ... })
//
// Exports may be provided as an object. Including a String id is
// optional.
//
//
// This implementation ignores ids if they are provided since it's
// just a light wrapper around Node's module system. The Node module
// system uses absolute filenames as module ids unless the module is
// native.
//
// Three special dependency names are:
//
// + require :: Resolve additional dependencies.
// + exports :: Bind exports into this object (also `module.exports`)
// + module :: The module object.

function define(id, deps, factory) {
	var file, mod;

	file = callingFilename();
	mod = Require.cache[require.resolve(file)];
	if (!mod) {
		throw new Error("define: can't load '" + file + "'");
	}

	if (arguments.length === 1) {
		factory = id;
		deps = null;
		id = null;
	}
	else if (arguments.length === 2) {
		factory = deps;
		if (typeof id == "string") {
			deps = null;
		}
		else {
			deps = id;
			id = null;
		}
	}

	load(mod, deps || ['require', 'exports', 'module'], factory);
	return mod;
}

define.amd = { ignoresId: true };


// load
//
// Given a module, list of dependencies, and factory function, resolve
// the dependencies and execute the factory.

function load(mod, deps, factory) {
	var bind, result;

	bind = {
		module: mod,
		exports: mod.exports,
		require: makeRequire(mod)
	};

	deps = deps.map(function(name) {
		return bind[name] || bind.require(name);
	});

	if (typeof factory === 'function') {
		result = factory.apply(mod.exports, deps);
	}
	else {
		result = factory;
	}

	if (result) {
		mod.exports = result;
	}
}

// makeRequire
//
// Build a `require` method for the given module. It's created in a
// way that's compatible with Node's `require` and the AMD's require.
//
// See Also: Module.prototype._compile() and [AMD require][1]
//
// [1]: https://github.com/amdjs/amdjs-api/wiki/require

function makeRequire(mod) {

	function require(name, fn) {
		if (!fn) {
			return mod.require(name);
		}

		name = name.map(require);
		process.nextTick(function() {
			fn.apply(mod.exports, name);
		});

		return null;
	}

	require.resolve = function(request) {
		return Module._resolveFilename(request, mod);
	};

	require.toUrl = function(request) {
		var path = require.resolve(request);
		return path && Url.format({ protocol: 'file', pathname: path });
	};

	for (var probe in Require) {
		if (null == require[probe]) {
			require[probe] = Require[probe];
		}
	}

	return require;
}

// callingFilename
//
// Find the calling filename by throwing an exception to examine its
// stack trace. The trace looks like this:
//
//	   Error: peek
//		   at callingFilename (/path/to/define.js:line:col)
//		  ...
//
// Examine the path names until the first one is found that isn't this
// file.

function callingFilename() {
	var lines, line, probe;

	try {
		throw new Error('peek');
	} catch (err) {
		lines = err.stack.split(/\n/);
	}

	for (var idx = 1, lim = lines.length; idx < lim; idx++) {
		probe = lines[idx].match(/\((.*):\d+:\d+\)/);
		if (!probe) {
			break;
		}
		else if (probe[1] !== __filename) {
			return probe[1];
		}
	}

	throw new Error("define: can't determine calling module");
}

// noConflict
//
// By default, `define` is bound into the global namespace. Use
// `noConflict` to restore the previous binding of `define`.

function noConflict() {
	global.define = Define;
	return define;
}


// ## Exports ##

global.define = define;
module.exports = exports = define;
exports.noConflict = noConflict;