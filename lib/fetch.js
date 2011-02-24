// # fetch.js #
//
// Download and extract stuff.

var Child = require('child_process'),
    Url = require('url'),
    Http = require('http'),
    Https = require('https'),
    F = require('./file'),
    U = require('./util');

exports.open = open;
exports.save = save;
exports.Request = Request;


// ## Fetch ##

var TEMP = F.Temporary('/tmp');

// Download a URI.
//
// The URI protocol determines how the URI is downloaded. Register new
// protocol handlers like this:
//
//     fetch.def(['protocol', ...], function(uri, base, next) {
//       ...
//       next(...);
//     });
//
// A handler accepts these parameters:
//
//   + uri      - Object parsed URI
//   + base     - File object
//   + next     - Function(Error err, Temporary path) continuation
//
// Returns nothing.
var fetch = exports.fetch = (function() {
  var registry = {};

  function dispatch(uri, base, next) {
    uri = (typeof uri == 'string') ? Url.parse(uri) : uri;

    if (arguments.length < 3) {
      next = base;
      base = null;
    }

    base = base ? F.File(base) : TEMP;

    var name = uri.protocol || '';
    if (name in registry)
      registry[name](uri, base, next);
    else
      next(new Error('No ' + name + ' protocol registered for "' + Url.format(uri) + '".'));
  }

  dispatch.def = function define(protocols, method) {
    protocols.forEach(function(name) {
      registry[name && (name + ':')] = method;
    });
    return method;
  };

  return dispatch;
})();

fetch.def(['file', ''], function fetchFile(uri, base, next) {
  next(null, F.File(uri.pathname));
});

fetch.def(['git'], function fetchGit(uri, base, next) {
  var into = F.Temporary(base.tempName(), 'application/x-directory');
  gitClone(Url.format(uri), into.path, function(err) {
    next(err, into);
  });
});

fetch.def(['http', 'https'], function fetchHttp(uri, base, next) {
  save(uri, base, function(err, file, resp) {
    if (err)
      rollback(err, file);
    else {
      if (resp.headers['content-type'])
        file.mimetype(resp.headers['content-type'].split(';')[0]);
      next(null, file);
    }
  });

  function rollback(err, file) {
    if (!file)
      next(err);
    else
      file.done(function() {
        next(err);
      });
  }
});


// ## Extract ##

// Extract an archived resource.
//
// The extraction is determined by mimetype. Register new handlers
// like this:
//
//     extract.def(['mime/type', ...], function(path, base, body) {
//       ...
//       next(...);
//     });
//
// A handler accepts these paremeters:
//
//   + file     - File to extract
//   + base     - File folder to extract into
//   + next     - Function(Error, File) callback
//
// extract(path, mime, next)
//
//   + path - String filename
//   + next - Function(Error, File) callback
//
// Returns String path to extracted file.
var extract = exports.extract = (function() {
  var methods = {};

  function extract(file, base, next) {
    if (arguments.length < 3) {
      next = base;
      base = null;
    }

    base = base ? F.File(base) : TEMP;

    F.File(file).mimetype(function(err, type) {
      type = type || '';
      if (err)
        next(err);
      else if (type in methods)
        methods[type](this, base, next);
      else
        next(new Error('Unrecognized mimetype "' + type + '" for ' + this + '.'));
    });
  }

  extract.isArchive = function(file, next) {
    F.File(file).mimetype(function(err, type) {
      err ? next(false) : next(type in methods);
    });
  };

  extract.def = function(types, method) {
    types.forEach(function(name) {
      methods[name] = method;
    });
    return method;
  };

  return extract;
})();

extract.def(['application/zip'], function extractZip(file, base, next) {
  return extractWith(unzip, file, base, next);
});

extract.def(['application/x-tar-gz'], function extractTarGz(file, base, next) {
  return extractWith(unTarGz, file, base, next);
});

extract.def(['application/x-gzip'], function extractGzip(file, base, next) {
  return decompressWith(zcat, file, base, extractRecursive(base, next));
});

extract.def(['application/x-tar'], function extractTar(file, base, next) {
  return extractWith(unTar, file, base, next);
});

// Some HTTP servers reply with a very generic encoding. Throw it away
// and fall back to `file`.
extract.def(['application/octet-stream'], function extractOctet(file, base, next) {
  file
    .mimetype('')
    .mimetype(function(err, type) {
      if (type == 'application/octet-stream')
        next(new Error('"' + type + '" is too generic: ' + file));
      else
        extract(file, base, next);
    });
});

function extractWith(extract, file, base, next) {
  var into;

  base.tempFolder(function(err, temp) {
    err ? next(err) : extract(file.path, (into = temp).path, ready);
  });

  function ready(err) {
    if (err)
      into.done(function() {
        next(err);
      });
    else
      next(null, into);
  }
}

function decompressWith(decompress, file, base, next) {
  var into;

  base.tempFile(function(err, stream, temp) {
    into = temp;
    err ? next(err) : decompress(file.path, stream, ready);
  });

  function ready(err) {
    if (err)
      into.done(function() {
        next(err);
      });
    else
      next(null, into);
  }
}

function extractRecursive(base, next) {

  function handle(err, temp) {
    err ? next(err) : check(temp);
  };

  function check(temp) {
    extract.isArchive(temp, function(archive) {
      archive ? again(temp) : next(null, temp);
    });
  }

  function again(temp) {
    extract(temp, base, function(err, result) {
      temp.done();
      next(err, result);
    });
  }

  return handle;
}


// ## HTTP ##

function open(uri, base, next) {
  return (new Request(uri)).open(base, next);
}

function save(uri, base, next) {
  return (new Request(uri)).save(base, next);
}

function Request(uri) {
  this.uri = (typeof uri != 'string') ? Url.format(uri) : uri;
  this.method = 'GET';
  this.maxTries = 10;
}

Request.prototype.open = function(next) {
  var method = this.method,
      seen = {},
      tries = this.maxTries,
      last;

  follow(this.uri);

  function follow(uri) {
    if (uri in seen)
      next(new Error('Redirect loop: ' + uri));
    else if (!tries--)
      next(new Error('Too many redirects: ' + uri));
    else {
      seen[last = uri] = true;
      request(method, uri, check);
    }
  }

  function check(err, resp) {
    if (err)
      next(err);
    else if (resp.statusCode >= 400) {
      next(new Error('Got ' + resp.statusCode + ' <' + last + '>'));
    }
    else if (resp.statusCode >= 300)
      follow(resp.headers['location']);
    else
      next(null, resp);
  }

  return this;
};

Request.prototype.save = function(base, next) {
  var suffix = F.extname(this.uri);

  return this.open(function(err, resp) {
    err ? next(err) : accept(resp);
  });

  function accept(resp) {
    base.tempFile({ suffix: suffix }, function(err, stream, file) {
      err ? next(err) : U.pipe(resp, stream, function(err) {
        next(err, file, resp);
      });
    });
  }
};

function request(method, uri, next) {
  uri = (typeof uri == 'string') ? Url.parse(uri) : uri;

  var host = uri.hostname,
      secure = uri.protocol == 'https:',
      port = uri.port || (secure ? 443 : 80),
      path = uri.pathname + (uri.search || ''),
      options = {
        host: host,
        port: port,
        path: path,
        method: method
      };

  var request = (secure ? Https : Http)
    .request(options, onResponse)
    .on('error', onError);

  request.end();

  function onResponse(resp) {
    next(null, resp);
  }

  function onError(err) {
    next(err);
  }
}


// ## External Utilities ##

function unzip(path, into, next) {
  U.must('unzip', ['-qq', path, '-d', into], next);
}

function unTarGz(path, into, next) {
  U.must('tar', ['-xzf', path, '-C', into], next);
}

function unTar(path, into, next) {
  U.must('tar', ['-xf', path, '-C', into], next);
}

function gitClone(uri, into, next) {
  U.must('git', ['clone', '-q', uri, into], next);
}

function zcat(path, into, next) {
  U.pipe(Child.spawn('zcat', [path]).stdout, into, next);
}