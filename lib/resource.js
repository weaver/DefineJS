// resource.js - mechanisms for fetching, extracting, and caching Packages

var Fs = require('fs'),
    Path = require('path'),
    Url = require('url'),
    U = require('./util');

exports.Cache = Cache;
exports.parse = parse;
exports.format = format;
exports.existsSync = existsSync;
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
  this.folder = folder;
  this.withTempSync = withTempSync.bind(null, join(folder, 'tmp'));
  this._memo = {};
}

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
  this._memo = {};
  destroySync(this.folder);
  return this;
};

Cache.prototype._fetchSync = function(uri) {
  var self = this,
      parsed = parse(uri),
      dest = join(self.folder, U.md5(format(parsed)));

  if (!existsSync(dest))
    return fetchSync(parsed, this.withTempSync, function(fetched) {
      return self._extractSync(fetched, dest);
    });

  return dest;
};

Cache.prototype._extractSync = function(from, into) {
  return extractSync(from, this.withTempSync, function(extracted) {
    if (!extracted)
      return from;
    else {
      moveSync(extracted, into);
      return into;
    }
  });
};


// ## URI ##

function parse(uri) {
  var obj = Url.parse(uri);
  obj.protocol = obj.protocol || 'file:';
  return obj;
}

function format(uri) {
  return Url.format(uri);
}


// ## Utilities ##

var join = exports.join = Path.join,
    resolve = exports.resolve = Url.resolve;

function mkdirsSync(path) {
  U.mustSync('mkdir', '-p', path);
}

function destroySync(path) {
  U.mustSync('rm', '-rf', path);
}

function unzipSync(file, into) {
  U.mustSync('unzip', '-q', file, '-d', into);
}

function realpathSync(path) {
  return Fs.realpathSync(path);
}

function existsSync(path) {
  try {
    Fs.statSync(path);
    return true;
  } catch (x) {
    if (x.errno == process.ENOENT)
      return false;
    throw x;
  }
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
    return body(temp);
  } finally {
    destroySync(temp);
  }
}

function isFile(file) {
  return Fs.statSync(file).isFile();
}

function isFolder(file) {
  return Fs.statSync(file).isDirectory();
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


// ## Mimetype ##

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
    return types[Path.extname(file)];
  }

  mimetypeSync.def = function(items) {
    U.extend(types, items);
    return this;
  };

  return mimetypeSync;
})();

mimetypeSync.def({
  '.zip': 'application/zip'
});


// ## Fetch ##

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

fetchSync.def(['file'], function fetchFileSync(uri, withTemp, body) {
  return body(uri.pathname);
});

fetchSync.def(['http', 'https'], function fetchHttpSync(uri, withTemp, body) {
  var remote = format(uri);
  console.info('FETCH %s', remote);
  return withTemp(function(temp) {
    mkdirsSync(temp);
    U.mustSync('wget', '--no-check-certificate', '-q', remote, { cwd: temp });
    return body(onlyFileSync(temp));
  });
});


// ## Extract ##

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

extractSync.def([undefined], function extractFolderSync(path, withTemp, body) {
  var stat = Fs.statSync(path);

  if (!isFolder(path))
    throw new Error('extract() expected folder: "' + path + '".');
  else
    return body(null);
});

extractSync.def(['application/zip'], function extractZipSync(path, withTemp, body) {
  return withTemp(function(temp) {
    console.info('UNZIP %s -> %s', path, temp);
    mkdirsSync(temp);
    unzipSync(path, temp);
    return body(onlyFolderSync(temp));
  });
});
