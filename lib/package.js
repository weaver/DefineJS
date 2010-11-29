// package.js - resolve names, evaluate code
//
// In the top-level of the main Package, this will start the program:
//
//     require('./package')
//       .makeContext(process.cwd())
//       .initSync();
//
// See also:
//
// * http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition
// * http://wiki.commonjs.org/wiki/Modules/1.1.1
// * http://wiki.commonjs.org/wiki/Packages/1.1

var Assert = require('assert'),
    Path = require('path'),
    U = require('./util'),
    R = require('./resource'),
    Script;

exports.makeContext = makeContext;


// ## Context ##

// A context loads Packages, helps find modules, and configures script
// evaulation. There's probably only one context for each program. A
// Package uses its Context to resolve URIs to other Packages and find
// Module filenames. A Module relies on registered extensions and
// configuration options in the Context to evaluate scripts.

function makeContext(base, options) {
  return new Context(base, options);
}

function Context(base, options) {
  this.uri = base;
  this.freshContexts = options && options.freshContexts;
  this.cacheRoot = options && options.cache;
  this.showLog = options && options.showLog;
  this.showInfo = options && options.showInfo;
  this.clearCache = options && options.clearCache;

  this._memo = {};
  this._root = null;
  this._ext = ['.js', '.node'];
  this._compilers = {};
  this._cache = null;
}

Context.prototype.toString = function() {
  return '<Context ' + this.uri + '>';
};

// Return true if the context has been initialized.
Context.prototype.isReady = function() {
  return !!(this._root && this._root.isReady());
};

// Initialize this context.
//
// + script - String filename to run instead of `main` (optional)
//
// Returns self.
Context.prototype.initSync = function(script) {
  this._bootstrapSync();
  if (script) {
    this.log('Starting script "' + script + '".');
    this._root._runScriptSync(script);
  }
  else {
    this.log('Starting main program.');
    this._root.loadSync('');
  }
  return this;
};

// Resolve a Package URI to a location in the filesystem.
//
// If the URI is remote, it's fetched and cached. The filename is
// canonical.
//
// + uri - String package URI
//
// Returns String filename.
Context.prototype.resolveSync = function(uri) {
  return this._cache.resolveSync(uri);
};

// Load and initialize a (resolved) Package URI.
//
// + uri    - String resolved URI
// + parent - Package parent package (optional)
//
// Returns Package instance.
Context.prototype.loadSync = function(uri, parent) {
  var cached = this._memo[uri];

  if (cached)
    return cached;

  var pkg = new Package(this, uri, parent).initSync();
  if ((cached = this._memo[pkg.qname.ns]))
    return (this._memo[uri] = cached);
  else
    return (this._memo[uri] = this._memo[pkg.qname.ns] = pkg);
};

Context.prototype.destroySync = function() {
  return this._bootstrapSync(true);
};

// Register a compiler for a filename extension.
//
// Before evaluation, code is passed to a compiler. If the compiler
// returns a string, this is subsequently evaluated. Otherwise, the
// returned value is used as a Module's `exports`.
//
// + ext      - String extension with leading dot (e.g. ".coffee").
// + compiler - Function(code) compiler
//
// Returns self.
Context.prototype.registerExtension = function(ext, compiler) {
  this._compilers[ext] = compiler;
  return this;
};

// Return true if `ext` is a registered extension.
Context.prototype.isRegistered = function(ext) {
  return ext in this._compilers;
};

// Given code and a filename, pass it through a compiler if possible.
//
// + code     - String source code
// + filename - Source file
//
// Returns compiled Object or original code.
Context.prototype.compile = function(code, filename) {
  var compiler = this._compilers[Path.extname(filename)];
  return compiler ? compiler(code) : code;
};

Context.prototype.log = function() {
  if (this.showLog)
    console.log.apply(console, arguments);
  return this;
};

Context.prototype.info = function() {
  if (this.showInfo)
    console.info.apply(console, arguments);
  return this;
};

Context.prototype._bootstrapSync = function(clear) {
  if (this._root && !clear)
    return this;

  if (!this.cacheRoot) {
    if (!R.isFolder(this.uri))
      this.cacheRoot = R.deriveTempName(this.uri);
    else
      this.cacheRoot = R.join(this.uri, '.packages');
  }

  if (!this._cache)
    this._cache = new R.Cache(this.cacheRoot, {
      console: this,
      preinstall: R.compileNative
    });

  if (clear === undefined ? this.clearCache : clear)
    this._cache.destroySync();

  this._root = this.loadSync(this.uri, null);

  return this;
};

Context.prototype._findModuleSync = function(qname) {
  var bases = [qname, qname.join('index')],
      ext = this._ext,
      base, probe;

  for (var b = 0, bc = bases.length; b < bc; b++) {
    base = bases[b].uri();
    for (var e = 0, ec = ext.length; e < ec; e++) {
      if (R.existsSync(base + ext[e]))
        return bases[b].extend(ext[e]);
    }
  }

  return null;
};


// ## Qualified Names ##

// OK, this is a little boring, but helps the rest of the code make
// more sense. The goal of name resolution is to translate each simple
// name into a canonical, absolute filename. During this process,
// names are resolved through Package mappings, so it's necessary to
// track the name of a module and the name of its package together.
//
// A Qualified Name (QName) represents a mostly-resolved name. The
// "namespace" is a Package URI. The "local name" is the name of a
// Module relative to the Package:
//
//   {http://foo.com/package}some/module
//
// After resolution, fetching, and canonicalization, this name may
// have gone through several stages of transformation until its
// finally evaluated. For example:
//
//   {http://foo.com/package}some/module
//   {/tmp/defjs/foo-pkg-123}some/module
//   {http://bar.com/some-package}module
//   {/tmp/defjs/bar-pkg-456}module
//   {/tmp/defjs/bar-pkg-456/lib}module.js
//
// The remote `package` is downloaded. It maps the `some/` prefix to a
// different remote package, which is also downloaded. Finally, the
// `lib/` folder is found with `module.js` inside.
//
// If the local name is an empty string, it's left up to a Package how
// to resolve it. By default, a Package will transform empty local
// names into `main`.

function QName(ns, lname, ext) {
  this.ns = ns;
  this.lname = lname || '';
  this.ext = '';
}

QName.make = function(name) {
  var probe;

  if ((probe = splitJar(name)))
    return new QName(probe[0], probe[1]);
  else if (isAbsolute(name))
    return new QName(name, '');
  else if ((probe = splitName(name)))
    return new QName(probe[1], probe[2]);
  else
    return undefined;
};

QName.prototype.toString = function() {
  return '{' + this.ns + '}' + this.lname;
};

QName.prototype.resolve = function(name) {
  Assert.equal(typeof name, 'string', 'QName.resolve() only works on local names.');
  return new QName(this.ns, R.resolve(this.lname, name));
};

QName.prototype.join = function(name) {
  Assert.equal(typeof name, 'string', 'QName.join() only works on local names.');
  return new QName(this.ns, R.join(this.lname, name));
};

QName.prototype.extend = function(ext) {
  this.ext = ext;
  return this;
}

QName.prototype.uri = function() {
  return (this.lname ? R.join(this.ns, this.lname) : this.ns) + this.ext;
};

QName.prototype.absolute = function() {
  return new QName(this.ns);
};


// ## Package ##

// A Package is a collection of modules. It's configured by a
// `package.json` file at the top-level. Configuration includes
// dependency information and mappings to other packages.

function Package(ctx, uri, parent) {
  this.ctx = ctx;
  this.uri = uri;
  this.parent = parent;
  this.qname = null;
}

Package.prototype.toString = function() {
  return '<Package ' + this.uri + '>';
};

// Return true if this package is initialized.
Package.prototype.isReady = function() {
  return !!this.qname;
};

// Configure this Package manually.
//
// + qname - QName instance of the resolved package URI.
// + conf  - Object configuration.
//
// Return self.
Package.prototype.configure = function(qname, conf) {
  Assert.ok(conf.name, 'Missing required "name".');

  this.qname = qname;
  this.name = conf.name;
  this.directories = U.extend({ lib: './lib' }, conf.directories);
  this.dependencies = conf.dependencies || {};

  this.lib = qname.resolve(folderName(this.directories.lib));
  this.main = withoutExt(conf.main) || R.simpleJoin(this.directories.lib, 'index');
  this.nsmap = this._makeNSMap(conf.mappings || {});
  this.modules = {};
  this.defined = {};

  return this;
};

// ### Async Interface ###

// Load a module through this package asynchronously.
//
// + name       - String module name
// + relativeTo - QName of the current module (optional)
// + next       - Function(error, module) callback.
//
// Returns self.
Package.prototype.load = function(name, relativeTo, next) {
  return U.liftSync(this, this.loadSync, [name, relativeTo], next);
};

// ### Sync Interface ###

// Initialize this Package by reading the `package.json` file.
//
// Returns self.
Package.prototype.initSync = function() {
  if (!this.isReady()) {
    var qname = new QName(this.ctx.resolveSync(this.uri), 'package.json');
    this.configure(qname.absolute(), U.loadJSONish(R.readSync(qname.uri())));
  }
  return this;
};

// Resolve a name through this package synchronously.
//
// + name       - String module name
// + relativeTo - QName of the current module (optional)
//
// Returns QName instance.
Package.prototype.resolveSync = function(name, relativeTo) {
  Assert.equal(typeof name, 'string', 'resolveSync() expected String name');

  if (!name) {
    this.ctx.info('resolve main=%s relativeTo=%s qname=%s', this.main, relativeTo, this.qname);
    return (relativeTo || this.qname).resolve(this.main);
  }
  else if (isRelative(name)) {
    this.ctx.info('resolve name=%s relativeTo=%s lib=%s', name, relativeTo, this.lib);
    return (relativeTo || this.lib).resolve(name);
  }
  else if (isAbsolute(name))
    return new QName.make(name);

  var qname = QName.make(name);

  if (name in this.defined) {
    this.ctx.info('resolve defined', name);
    return qname;
  }
  else if (qname.ns in this.nsmap) {
    this.ctx.info('resolve nsmap', qname.ns, this.nsmap[qname.ns], qname.lname);
    return this.nsmap[qname.ns].resolve(qname.lname);
  }
  else {
    this.ctx.info('resolve nothing');
    return qname;
  }
};

// Load a module through this package synchronously.
//
// Top-level names that haven't been explicitly defined are resolved
// through the parent package. The root package falls back to Node's
// name resolution. This allows "outer" packages to map dependencies
// on behalf of packages they use.
//
// + name       - String module name
// + relativeTo - QName of the current module (optional)
//
// Returns Module instance.
Package.prototype.loadSync = function(name, relativeTo) {
  Assert.ok(this.isReady(), 'init() or declare() this package first.');
  Assert.equal(typeof name, 'string', 'expected String name');
  Assert.ok(!relativeTo || isQualified(relativeTo), 'expected optional QName');

  var cached,
      qname = this.resolveSync(name, relativeTo);

  this.ctx.info('loadSync: resolved (%s, %s) -> %s', name, relativeTo, qname);

  if (isTopLevel(qname.ns)) {
    var uri = qname.uri();
    if (uri in this.defined)
      return this.defined[uri];
    else if (this.parent)
      return this.parent.loadSync(uri);
    else {
      // FIXME: avoid creating a Module every time.
      var mod = new Module(qname.uri());
      loadExternalSync(this, qname, mod);
      return mod;
    }
  }
  else if (qname.ns != this.qname.ns) {
    var pkg = this.ctx.loadSync(qname.ns, this);
    return pkg.loadSync(relativeName(qname.lname));
  }
  else if ((cached = this.modules[qname.lname]))
    return cached;
  else
    return this._loadSync(qname);
};

// This is pretty similar to _loadSync(), but doesn't do filename
// resolution or cache the module.
Package.prototype._runScriptSync = function(file) {
  var ext = Path.extname(file),
      qname = new QName(Path.dirname(file), Path.basename(file)),
      mod = new Module(qname.uri(), file);

  if (ext == '.js' || this.ctx.isRegistered(ext))
    return loadModuleSync(this, qname, mod, R.readSync(file));
  else if (ext == '.node')
    return loadNativeSync(this, qname, mod);
  else
    throw new Error('Unrecognized extension: "' + file + '".');
};

Package.prototype._loadSync = function(qname) {
  Assert.equal(qname.ns, this.lib.ns, 'Namespace mismatch');

  var file = this._findModuleSync(qname),
      ext = file.ext,
      cached;

  if (file.lname != qname.lname && (cached = this.modules[file.lname]))
    // In this case, the name was resolved into a directory or
    // something and whatever was cached is some other variant of the
    // name (e.g. "foo" is cached, but "foo/index" is resolved).
    return cached;
  else if (ext == '.js' || this.ctx.isRegistered(ext)) {
    // Cache the new module immediately to prevent duplicates if there
    // are circular imports.
    var filename = file.uri(),
        mod = new Module(qname.uri(), filename),
        code = R.readSync(filename);

    this.modules[qname.lname] = this.modules[file.lname] = mod;
    return loadModuleSync(this, file, mod, code);
  }
  else if (ext == '.node') {
    var mod = new Module(qname.uri(), file.uri());
    this.modules[qname.lname] = this.modules[file.lname] = mod;
    return loadNativeSync(this, qname, mod);
  }
  else
    throw new Error('Unrecognized extension: "' + file + '".');
};

Package.prototype._findModuleSync = function(qname) {
  // this used to be: this.lib.resolve(qname.lname)
  var file = this.ctx._findModuleSync(qname);
  if (!file)
    throw new Error('Cannot find "' + qname + '".');
  return file;
};

Package.prototype._makeNSMap = function(map) {
  var name, probe;

  // Convert all values to QNames.
  for (name in map)
    map[name] = QName.make(map[name]);

  // Add self to the map.
  map[this.name] = this.qname;

  // Unmapped dependencies are mapped through NPM. FIXME: don't ignore
  // versions.
  for (name in this.dependencies) {
    if (!(name in map))
      map[name] = QName.make('npm:/' + name + '/latest');
  }

  // Look for values that refer to other names in the map. Resolve
  // them ahead of time.
  for (name in map) {
    if (map[name].ns in map) {
      for (probe = new QName(map[name].ns, ''); probe.ns in map; )
        probe = map[probe.ns].resolve(probe.lname);
      map[name] = probe;
    }
  }

  return map;
};

Package.prototype._define = function(name) {
  return (this.defined[name] = new Module(name));
};


// ## Modules ##

// A Module encapsulates a group of methods. It's part of a
// Package. This implementation falls back on Node's require()
// implementation to load native extensions and top-level names that
// couldn't be resolved through a Package.

function Module(id, uri) {
  this.id = id;
  this.uri = uri;
  this.exports = {};
}

var _require = require;

// Load a native extension (e.g. ".node" file).
//
// + qname - QName of the file.
//
// Returns Node exports.
function loadNativeSync(pkg, qname, mod) {
  mod.exports = _require(qname.uri());
  return mod;
}

// Load a top-level module that couldn't be resolved otherwise.
//
// + qname - QName of the module.
//
// Returns Node exports.
function loadExternalSync(pkg, qname, mod) {
  mod.exports = _require(qname.uri());
  return mod;
}

// Evaluate a module resolved through a Package.
//
// + pkg   - Package instance
// + qname - QName of this module (for name resolution)
// + mod   - Module instance
// + code  - String source code
//
// Returns mod.
function loadModuleSync(pkg, qname, mod, code) {
  var ctx = pkg.ctx;

  // ### Setup ###

  // Remove the shebang and "compile" if it's a registered
  // extension. Bail out early if this isn't a script.

  code = ctx.compile(code.replace(/^\#\!.*/, ''), mod.uri);
  if (typeof code != 'string') {
    mod.exports = code;
    return mod;
  }


  // ### Compile Script ###

  // This should closely mirror Node's Module._compile().

  var require = makeRequire(pkg, qname, mod),
      define = makeDefine(pkg, qname, mod, require),
      filename = mod.uri,
      dirname = Path.dirname(mod.uri);

  if (ctx.freshContexts) {
    if (!Script) Script = process.binding('evals').Script;

    var sandbox = U.extend({}, global);

    sandbox.require = require;
    sandbox.define = define;
    sandbox.exports = mod.exports;
    sandbox.__filename = filename;
    sandbox.__dirname = dirname;
    sandbox.module = mod;
    sandbox.global = sandbox;
    sandbox.root = root;

    Script.runInNewContext(code, sandbox, filename);
  }
  else {
    var wrapped = ('(function(exports, require, define, module, __filename, __dirname) {' + code + '\n});'),
        fn = process.compile(wrapped, filename);

    if (filename === process.argv[1] && global.v8debug)
      global.v8debug.Debug.setBreakPoint(fn, 0, 0);
    fn.apply(mod.exports, [mod.exports, require, define, mod, filename, dirname]);
  }

  return mod;
}

// ## Require and Define ##

// This implementation of require() should be compatible with Node's
// require(). The define() method is compatible with CommonJS
// Modules/AsynchronousDefinition.

function makeRequire(pkg, qname, mod) {

  function require(name) {
    return pkg.loadSync(name, qname).exports;
  }

  require.paths = _require.paths;
  require.main = process.mainModule;
  require.async = requireAsync;
  require.registerExtension = registerExtension;

  function requireAsync(uri, next) {
    pkg.load(uri, qname, function(err, mod) {
      err ? next(err) : next(null, mod.exports);
    });
  }

  function registerExtension(ext, compiler) {
    ctx.registerExtension(ext, compiler);
  }

  return require;
}

function makeDefine(pkg, qname, mod, require) {

  // FIXME: The spec says the order of definition SHOULD NOT
  // matter. Make something that defers resolving `deps` and calling
  // `fn` if something in `deps` isn't loaded yet.

  function define(/* id, deps, fn */) {
    var a = 0, argc = arguments.length,
        id, deps, fn;

    if (argc < 1 || argc > 3)
      throw new Error('define() expects 1 - 3 arguments.');
    else if (argc == 1) {
      // Special case: no dependencies.
      fn = arguments[0];
      return (typeof fn == 'function') ? fn() : fn;
    }

    id = (typeof arguments[a] == 'string') ? arguments[a++] : undefined;
    deps = (typeof arguments[a] == 'function') ? [] : arguments[a++];
    fn = arguments[a++];

    return id ? defineTop(id, deps, fn) : defineSelf(deps, fn);
  }

  function defineTop(id, deps, fn) {
    var qname = QName.make(id),
        mod = pkg._define(id),
        require = makeRequire(pkg, qname, mod);

    return _define(require, mod, deps, fn);
  }

  function defineSelf(deps, fn) {
    return _define(require, mod, deps, fn);
  }

  function _define(require, mod, deps, fn) {
    var special = { exports: mod.exports, module: mod, require: require },
        result = fn.apply(mod, resolve(deps, special, require));

    if (result)
      mod.exports = result;

    return result;
  }

  function resolve(deps, special, require) {
    return deps.map(function(name) {
      return special[name] || require(name);
    });
  }

  return define;
}


// ## Names ##

// These utility methods help identify and manipulate different types
// of names. Name resolution looks for these kinds of names:
//
//   * foo/bar                 (top-level)
//   * /foo/bar                (absolute)
//   * http://quux.net/foo/bar (absolute)
//   * ./foo/bar               (relative)
//
// Top-level names are resolved into other Packages. Absolute names
// don't need much resolution. Relative names are resolved against the
// current Module's name.

function relativeName(name) {
  name = topLevelName(name);
  return name ? './' + name : '';
}

function folderName(name) {
  return name.replace(/\/*$/, '/');
}

function isRelative(name) {
  return /^\./.test(name);
}

function topLevelName(name) {
  return name.replace(/^\/+/, '');
}

function isTopLevel(name) {
  return !(isRelative(name) || isAbsolute(name));
}

function isAbsolute(name) {
  return /^(\w+:)|^\//.test(name);
}

function isJar(name) {
  return /^jar:/.test(name);
}

function splitJar(name) {
  return name.match(/^jar:([^!]+)!(.*)$/);
}

function splitName(name) {
  return name.match(/^([^\/]+)\/*(.*)$/);
}

function isPackage(obj) {
  return (obj instanceof Package);
}

function isQualified(obj) {
  return (obj instanceof QName);
}

function isExternal(obj) {
  return (typeof obj == 'string');
}

// Sometimes people use names like 'foo.js' when they mean
// 'foo'. Strip the extension.
function withoutExt(name) {
  var ext = name && Path.extname(name);
  return ext ? name.substr(0, name.length - ext.length) : name;
}