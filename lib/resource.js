// resource.js - mechanisms for fetching, extracting, and caching Packages

var Fs = require('fs'),
    Path = require('path'),
    Url = require('url'),
    U = require('./util'),
    SemVer = require('./semver');

exports.Cache = Cache;
exports.parse = parse;
exports.format = format;
exports.isFolder = isFolder;
exports.isLocal = isLocal;
exports.isRemote = isRemote;
exports.folderName = folderName;
exports.resolveInFolder = resolveInFolder;
exports.join = join;
exports.simpleJoin = simpleJoin;
exports.deriveTempName = deriveTempName;
exports.onlyFileSync = onlyFileSync;
exports.statSync = statSync;
exports.existsSync = existsSync;
exports.readSync = readSync;
exports.compileNative = compileNative;


// ## Resource Cache ##

// Resolve URIs to canonical filenames. If the URI is remote, fetch
// it. If the URI resolves to an archive, extract it.

// Create a URI cache.
//
// folder - String folder name to cache downloaded packages
//
// Returns Cache instance.
function Cache(folder, opt) {
  this.folder = folder;
  this.preinstall = opt && opt.preinstall;
  this.console = (opt && opt.console) || console;

  this.withTempSync = withTempSync.bind(null, join(folder, 'tmp'));
  this._memo = {};
}

Cache.prototype.toString = function() {
  return '<Cache "' + this.folder + '">';
};

// Resolve a URI to a canonical filename.
//
// + uri - String uri
//
// Returns String canonical filename.
Cache.prototype.resolveSync = function(uri) {
  return this._memo[uri] || (this._memo[uri] = realpathSync(this._fetchSync(uri)));
};

// Reset the cache.
//
// Returns self.
Cache.prototype.destroySync = function() {
  this.console.log('Destroying', this);
  this._memo = {};
  destroySync(this.folder);
  return this;
};

Cache.prototype._fetchSync = function(uri) {
  var self = this,
      parsed = parse(uri),
      dest = deriveTempName(uri, self.folder, '');

  if (!existsSync(dest))
    return fetchSync.call(this.console, parsed, self.withTempSync,
      function(fetched) {
        return self._extractSync(fetched, dest);
      });

  return dest;
};

Cache.prototype._extractSync = function(from, into) {
  var self = this;
  return extractSync.call(this.console, from, this.withTempSync,
    function(extracted) {
      if (!extracted)
        return from;
      else {
        self.preinstall && self.preinstall(extracted);
        moveSync(extracted, into);
        return into;
      }
    });
};


// ## URI ##

function parse(uri) {
  var obj = Url.parse(uri, true);
  obj.protocol = obj.protocol || 'file:';
  return obj;
}

function format(uri) {
  return Url.format(uri);
}

function isLocal(uri) {
  return parse(uri).protocol == 'file:';
}

function isRemote(uri) {
  return !isLocal(uri);
}


// ## Utilities ##

var join = exports.join = Path.join,
    resolve = exports.resolve = Url.resolve;

function extname(file) {
  var ext = Path.extname(file);
  if (ext == '.gz')
    ext = Path.extname(file.substr(0, file.length - ext.length)) + ext;
  return ext;
}

// Derive a temporary folder name from a URI.
function deriveTempName(uri, base, prefix) {
  if (typeof uri == 'string')
    uri = parse(uri);
  if (typeof prefix == 'undefined')
    prefix = Path.basename(process.argv[0]) + '-';
  return join(base || '/tmp', prefix + U.md5(format(uri)));
}

// Path.join() removes the leading "./", this doesn't.
function simpleJoin(a, b) {
  return folderName(a) + b.replace(/^\/*/, '');
}

function folderName(a) {
  return a.replace(/\/*$/, '/');
}

function resolveInFolder(a, b) {
  return resolve(folderName(a), b);
}

function mkdirsSync(path) {
  U.mustSync('mkdir', '-p', path);
}

function destroySync(path) {
  U.mustSync('rm', '-rf', path);
}

function unzipSync(file, into) {
  U.mustSync('unzip', '-q', file, '-d', into);
}

function unTarGzSync(file, into) {
  U.mustSync('tar', '-xzf', file, '-C', into);
}

function realpathSync(path) {
  return Fs.realpathSync(path);
}

function statSync(path) {
  try {
    return Fs.statSync(path);
  } catch (x) {
    if (x.errno == process.ENOENT)
      return undefined;
    throw x;
  }
}

function existsSync(path) {
  return !!statSync(path);
}

function readSync(path) {
  return Fs.readFileSync(path).toString('utf-8');
}

function moveSync(orig, dest) {
  return Fs.renameSync(orig, dest);
}

function withTempSync(base, body) {
  var temp = join(base, U.tempname());
  try {
    mkdirsSync(temp);
    return body(temp);
  } finally {
    destroySync(temp);
  }
}

function isFile(file) {
  var stat = statSync(file);
  return stat && stat.isFile();
}

function isFolder(file) {
  var stat = statSync(file);
  return stat && stat.isDirectory();
}

// Look for a single item inside a folder.
//
// + folder - String path
//
// Returns String filename.
function onlySync(folder) {
  var files = Fs.readdirSync(folder);
  if (files.length != 1)
    throw new Error('Expected one item in "' + folder + '", not ' + files.length + '.');

  return join(folder, files[0]);
}

// Look for a single file inside a folder.
//
// + folder - String path
//
// Returns String filename.
function onlyFileSync(folder) {
  var file = onlySync(folder);

  if (!isFile(file))
    throw new Error('Expected file: ' + file);

  return file;
}

// Look for a single folder inside a folder.
//
// + folder - String path
//
// Returns String filename.
function onlyFolderSync(folder) {
  var file = onlySync(folder);

  if (!isFolder(file))
    throw new Error('Expected folder: ' + file);

  return file;
}

function compileNative(folder) {
  if (existsSync(join(folder, 'wscript')))
    U.mustSync('node-waf', 'configure', 'build', { cwd: folder });
}


// ## Fetch and Extract ##

// Synchronously determine the mimetype of a file.
//
// Register addition mimetypes for filename extensions like this:
//
//     mimetypeSync.def({
//       '.ext': 'mime/type',
//       ...
//     });
//
// mimetypeSync(file)
//
//   + file - String filename
//
// Returns String mimetype or undefined.
var mimetypeSync = (function() {
  var types = {};

  function mimetypeSync(file) {
    return types[extname(file)];
  }

  mimetypeSync.def = function(items) {
    U.extend(types, items);
    return this;
  };

  return mimetypeSync;
})();

mimetypeSync.def({
  '.zip': 'application/zip',
  '.tgz': 'application/x-tar-gz',
  '.tar.gz': 'application/x-tar-gz'
});

// Download a URI.
//
// The URI protocol determines how the URI is downloaded. Register new
// protocol handlers like this:
//
//     fetchSync.def(['protocol', ...], function(uri, withTemp, body) {
//       ...
//       return body(...);
//     });
//
// A handler accepts these parameters:
//
//   + uri      - Object parsed URI
//   + withTemp - Function(body) make a temporary folder
//   + body     - Function(path) call this with the filename, return the result
//
// fetchSync(uri)
//
//   + uri - Object parsed URI
//
// Returns String filename.
var fetchSync = (function() {
  var registry = {};

  function dispatchSync(uri) {
    if (uri.protocol in registry)
      return registry[uri.protocol].apply(this, arguments);
    else
      throw new Error('No ' + name + ' protocol registered for "' + uri.protocol + '".');
  }

  dispatchSync.def = function define(protocols, method) {
    protocols.forEach(function(name) {
      registry[name + ':'] = method;
    });
    return method;
  };

  return dispatchSync;
})();

// Extract an archived resource.
//
// The extraction is determined by mimetype. Register new handlers
// like this:
//
//     extractSync.def(['mime/type', ...], function(path, withTemp, body) {
//       ...
//       return body(...);
//     });
//
// A handler accepts these paremeters:
//
//   + path     - String path to extract
//   + withTemp - Function(body) makes a temporary folder
//   + body     - Function(path) call this with the filename, return the result.
//
// extractSync(file)
//
//   + file - String filename
//
// Returns String path to extracted file.
var extractSync = (function() {
  var methods = {};

  function dispatchSync(file) {
    var type = mimetypeSync(file);
    if (type in methods)
      return methods[type].apply(this, arguments);
    else
      throw new Error('Unrecognized mimetype "' + type + '" for file "' + file + '".');
  }

  dispatchSync.def = function(types, method) {
    types.forEach(function(name) {
      methods[name] = method;
    });
    return method;
  };

  return dispatchSync;
})();


// ## Filesystem ##

fetchSync.def(['file'], function fetchFileSync(uri, withTemp, body) {
  return body(uri.pathname);
});

extractSync.def([undefined], function extractFolderSync(path, withTemp, body) {
  if (!isFolder(path))
    throw new Error('extract() expected folder: "' + path + '".');
  else
    return body(null);
});

extractSync.def(['application/zip'], function extractZipSync(path, withTemp, body) {
  return extractPackage(this, unzipSync, path, withTemp, body);
});

extractSync.def(['application/x-tar-gz'], function extractTarGzSync(path, withTemp, body) {
  return extractPackage(this, unTarGzSync, path, withTemp, body);
});

function extractPackage(console, extract, path, withTemp, body) {
  return withTemp(function(temp) {
    console.log('Extracting %s', Path.basename(path));
    extract(path, temp);
    return body(onlyFolderSync(temp));
  });
}


// ## HTTP ##

fetchSync.def(['http', 'https'], function fetchHttpSync(uri, withTemp, body) {
  return wget(this, withTemp, format(uri), body);
});

function wget(console, withTemp, remote, body) {
  console.log('Downloading', remote);
  return withTemp(function(temp) {
    U.mustSync('wget', '--no-check-certificate', '-q', remote, { cwd: temp });
    return body(onlyFileSync(temp));
  });
}


// ## NPM ##

fetchSync.def(['npm'], function fetchNpmSync(uri, withTemp, body) {
  var info = bestNpm(this, uri, withTemp);

  if (!info)
    throw new Error('cannot resolve: ' + format(uri));
  else if (!(info.dist && info.dist.tarball))
    throw new Error('no tarball: ' + format(uri));

  return fetchSync.call(this, parse(info.dist.tarball), withTemp, body);
});

// FIXME: This loop would be better in package.js somewhere since
// names may be resolved through a package mapping instead of through
// NPM. See `Package._mapDep()`.
//
// Also, this sort of thing messes up hashing and could cause
// duplicate modules to load. Refactor the Cache to allow for symlinks
// to be created or something.
function bestNpm(console, uri, withTemp) {
  var opt = uri.query;

  if (!opt)
    return mustGetJSON(console, withTemp, registryUri(uri.pathname));

  var info, path, constraint, err;

  // `opt` is a map of <name, constraint> items. Try each item until
  // one works. If none work, give up.
  for (key in opt) {
    path = '/' + key + '/';
    constraint = opt[key];

    info = wgetJSON(console, withTemp, registryUri(path, constraint));

    if (info.error) {
      err = info.error;
      info = undefined;
    }
    else if (info.versions)
      info = satisfy(constraint, info, path);

    if (info)
      break;
  }

  if (!info && err)
    throw err;

  return info;
}

function registryUri(path, constraint) {
  var result = 'http://registry.npmjs.org' + path;

  if (constraint !== undefined) {
    if (SemVer.isExact(constraint))
      result += constraint;
    else if (SemVer.isAny(constraint))
      result += 'latest';
  }

  return result;
}

function satisfy(constraint, info, path) {
  var available = Object.keys(info.versions),
      best = SemVer.satisfy(constraint, available);

  return best && info.versions[SemVer.format(best)];
}

function mustGetJSON(console, withTemp, remote) {
  var info = wgetJSON(console, withTemp, remote);
  if (info.error)
    throw new Error(info.error + ': ' + remote);
  return info;
}

function wgetJSON(console, withTemp, remote) {
  return JSON.parse(wget(console, withTemp, remote, readSync));
}
