// resource.js - mechanisms for fetching, extracting, and caching Packages

var Path = require('path'),
    Url = require('url'),
    Fs = require('fs'),
    F = require('./file'),
    I = require('./install'),
    U = require('./util');

// Require this for it's side-effect of registering an npm protocol
// handler.
require('./npm');

exports.Cache = Cache;
exports.parse = parse;
exports.format = format;
exports.isFolder = isFolder;
exports.resolveInFolder = resolveInFolder;
exports.simpleJoin = simpleJoin;
exports.statSync = statSync;
exports.existsSync = existsSync;
exports.isFileSync = isFileSync;
exports.readSync = readSync;


// ## Resource Cache ##

// Resolve URIs to canonical filenames. If the URI is remote, fetch
// it. If the URI resolves to an archive, extract it.

// Create a URI cache.
//
// folder - String folder name to cache downloaded packages
//
// Returns Cache instance.
function Cache(folder) {
  this.folder = F.File(folder);
  this.temp = this.folder.join('tmp');
  this._memo = {};
}

Cache.prototype.toString = function() {
  return '<Cache "' + this.folder.path + '">';
};

Cache.prototype.setupSync = function() {
  this.temp.mkdirs();
  return this;
};

// Resolve a URI to a canonical filename.
//
// + uri - String uri
//
// Returns String canonical filename.
Cache.prototype.resolveSync = function(uri) {
  var probe;

  if ((probe = this._memo[uri]))
    return probe;

  var parsed = parse(uri),
      canonical = format(parsed),
      dest;

  if ((probe = this._memo[canonical]))
    return (this._memo[uri] = probe);

  if (parsed.protocol == 'file:' && isFolder(parsed.pathname))
    dest = parsed.pathname;
  else
    dest = I.uriTempName(parsed, this.folder.path);

  installSync(canonical, this.temp.path, dest);
  return (this._memo[uri] = this._memo[canonical] = Fs.realpathSync(dest));
};

// Reset the cache.
//
// Returns self.
Cache.prototype.destroySync = function() {
  this._memo = {};
  this.folder.destroy();
  return this;
};


// ## URI ##

var resolve = exports.resolve = Url.resolve;

function parse(uri) {
  var obj = Url.parse(uri, true);
  obj.protocol = obj.protocol || 'file:';
  return obj;
}

function format(uri) {
  return Url.format(uri);
}


// ## Path ##

var join = exports.join = Path.join,
    basename = exports.basename = Path.basename,
    dirname = exports.dirname = Path.dirname;

function isFolder(file) {
  var stat = statSync(file);
  return stat && stat.isDirectory();
}

function resolveInFolder(a, b) {
  return resolve(folderName(a), b);
}

// Path.join() removes the leading "./", this doesn't.
function simpleJoin(a, b) {
  return folderName(a) + b.replace(/^\/*/, '');
}

function folderName(a) {
  return a.replace(/\/*$/, '/');
}

function statSync(path) {
  try {
    return Fs.statSync(path);
  } catch (x) {
    if (x.code == 'ENOENT' || x.code == 'ENOTDIR')
      return undefined;
    throw x;
  }
}

function existsSync(path) {
  return !!statSync(path);
}

function isFileSync(path) {
  var stats = statSync(path);
  return stats && stats.isFile();
}

function readSync(path) {
  return Fs.readFileSync(path).toString('utf-8');
}


// ## Sync Commands ##

function installSync(uri, temp, dest) {
  if (!existsSync(dest))
    runSync('install', uri, temp, dest);
}

function runSync() {
  var args = [process.execPath, __filename].concat(U.toArray(arguments));
  U.mustSync.apply(null, args);
}

function dispatchSync() {
  var cmd = process.argv[2],
      args = process.argv.slice(3),
      method = COMMANDS[cmd];

  if (method)
    method.apply(null, args);
  else {
    fail('Unrecognized command: %j', cmd);
  }
}

function fail() {
  console.warn.apply(console, arguments);
  process.exit(1);
}

function success() {
  process.exit(0);
}

var COMMANDS = {};

function defCmd(name, fn) {
  COMMANDS[name] = fn;
  return fn;
}

defCmd('install', function(uri, temp, dest) {
  I.install(uri, temp, dest, function(err) {
    err ? fail('install failed: %s', err.stack || err) : success();
  });
});

if (require.main === module)
  dispatchSync();
