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
  this.freshContexts = options.freshContexts;
  this._cache = new R.Cache((options && options.cache) || R.join(base, '.modules'));
  this._memo = {};
  this._root = null;
  this._ext = ['.js', '.node'];
  this._compilers = {};
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
// Returns self.
Context.prototype.initSync = function() {
  this._bootstrap();
  this._root.loadSync('');
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

Context.prototype._bootstrap = function() {
  this._root = this.loadSync(this.uri, null);
  return this;
};

Context.prototype._findModuleSync = function(qname) {
  var base = qname.uri(),
      ext = this._ext,
      probe;

  for (var i = 0, l = ext.length; i < l; i++) {
    if (R.existsSync(probe = base + ext[i]));
      return probe;
  }

  return null;
};


// ## Qualified Names ##

// OK, this is a little boring, but makes the rest of the code make
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

function QName(ns, lname) {
  this.ns = ns;
  this.lname = lname || '';
}

QName.make = function(name) {
  var probe;

  if ((probe = splitJar(name)))
    return new QName(probe[0], probe[1]);
  if (isAbsolute(name))
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

QName.prototype.uri = function() {
  return this.lname ? R.join(this.ns, this.lname) : this.ns;
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
  this.main = conf.main || R.simpleJoin(this.directories.lib, 'index');
  this.nsmap = this._makeNSMap(conf.mappings || {});
  this.modules = {};

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
    this.configure(qname, JSON.parse(R.readSync(qname.uri())));
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
    // console.log('resolve main=%s relativeTo=%s qname=%s', this.main, relativeTo, this.qname);
    return (relativeTo || this.qname).resolve(this.main);
  }
  else if (isRelative(name)) {
    // console.log('resolve name=%s relativeTo=%s lib=%s', name, relativeTo, this.lib);
    return (relativeTo || this.lib).resolve(name);
  }
  else if (isAbsolute(name))
    return name;

  var qname = QName.make(name),
      ref = this.nsmap[qname.ns];

  return ref ? ref.resolve(qname.lname) : qname;
};

// Load a module through this package synchronously.
//
// Top-level names are resolved through the parent package. This
// allows "outer" programs to map dependencies for their packages. The
// root package falls back to Node's name resolution.
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

  if (isTopLevel(qname.ns)) {
    if (this.parent)
      return this.parent.loadSync(qname.uri());
    else
      return loadExternalSync(qname);
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

Package.prototype._loadSync = function(qname) {
  Assert.equal(qname.ns, this.lib.ns, 'Namespace mismatch');

  var file = this._findModuleSync(qname),
      ext = Path.extname(file);

  if (ext == '.js' || this.ctx.isRegistered(ext)) {
    // Cache the new module immediately to prevent duplicates if there
    // are circular imports.
    var mod = this.modules[qname.lname] = new Module(qname, file),
        code = R.readSync(file);

    return loadModuleSync(this, qname, mod, code);
  }
  else if (ext == '.node')
    return (this.modules[qname.lname] = loadNativeSync(qname));
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

  // Look for values that refer to other names in the map. Resolve
  // them ahead of time.
  for (name in map) {
    if (map[name].ns in map) {
      for (probe = new QName(map[name].ns, ''); probe.ns in map; )
        probe = map[probe.ns].resolve(probe.lname);
      map[name] = probe;
    }
  }

  map[this.name] = this.qname;

  return map;
};


// ## Modules ##

// A Module encapsulates a group of methods. It's part of a
// Package. This implementation falls back on Node's require()
// implementation to load native extensions and top-level names that
// couldn't be resolved through a Package.

function Module(qname, uri) {
  this.id = qname.uri();
  this.uri = uri;
  this.exports = {};
}

var _require = require;

// Load a native extension (e.g. ".node" file).
//
// + qname - QName of the file.
//
// Returns Node exports.
function loadNativeSync(qname) {
  return _require(qname.uri());
}

// Load a top-level module that couldn't be resolved otherwise.
//
// + qname - QName of the module.
//
// Returns Node exports.
function loadExternalSync(qname) {
  return _require(qname.uri());
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

  // ### Require and Define ###

  // The implementation of require() should be compatible with Node's
  // require().

  function requireAsync(uri, next) {
    pkg.load(uri, qname, next);
  }

  function registerExtension(ext, compiler) {
    ctx.registerExtension(ext, compiler);
  }

  function require(name) {
    return pkg.loadSync(name, qname);
  }

  require.paths = _require.paths;
  require.main = process.mainModule;
  require.async = requireAsync;
  require.registerExtension = registerExtension;

  function define(deps, fn) {
    if (typeof deps == 'function') {
      fn = deps;
      deps = [];
    }

    var result = fn.apply(mod, resolve(deps));
    if (result !== undefined)
      mod.exports = result;

    return result;
  }

  var special = { exports: mod.exports, module: mod };

  function resolve(deps) {
    return deps.map(function(name) {
      return special[name] || require(name);
    });
  }

  // ### Compile Script ###

  // This should closely mirror Node's Module._compile().

  var filename = mod.uri,
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
