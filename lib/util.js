// util.js - extra methods that don't belong anywhere else

var _defjs = require(__dirname + '/../build/default/_defjs'),
    Sys = require('sys'),
    Path = require('path'),
    Child = require('child_process'),
    Fs = require('fs');

exports.liftSync = liftSync;
exports.mustSync = mustSync;
exports.callSync = callSync;
exports.must = must;
exports.extend = extend;
exports.toArray = toArray;
exports.tempname = tempname;
exports.hashname = hashname;
exports.withoutExt = withoutExt;
exports.md5 = md5;
exports.digest = digest;
exports.digestSync = digestSync;
exports.loadJSONish = loadJSONish;
exports.parseJSON = parseJSON;
exports.stringifyJSON = stringifyJSON;
exports.load = load;
exports.loadSync = loadSync;
exports.dump = dump;
exports.dumpSync = dumpSync;
exports.writeFile = writeFile;
exports.writeFileSync = writeFileSync;
exports.getopt = getopt;
exports.capture = capture;
exports.redirect = redirect;
exports.listen = listen;
exports.aEach = aEach;

// Use a synchronous method "asynchronously".
//
// + self   - Object this
// + method - Function synchronous method
// + args   - Array of arguments for `method`
// + next   - Function(error, value) callback
//
// Returns self.
function liftSync(self, method, args, next) {
  var err = null,
      res;

  try {
    res = method.apply(self, args);
  } catch (x) {
    err = x;
  }

  next(err, res);
  return self;
};

// Call an external program synchronously.
//
// This has a similar interface to `child_process.spawn()`.
//
// + command - String program name
// + args    - Array of String command arguments
// + options - Object of additional parameters (optional).
//
// Options include:
//
// + cwd - String working directory
// + env - Object of (key, value) pairs
//
// Returns Integer exit code.
function callSync(command, args, options) {
  var cwd = (options && options.cwd) || "",
      env = (options && options.env) || process.env,
      envList = [];

  for (var key in env)
    envList.push(key + '=' + env[key]);

  return _defjs.callSync(command, args, cwd, envList);
}

// Run an external program synchronously. Require that it exits successfully.
//
// This method accepts a variable number of String arguments. The
// final argument may be an `options` Object. For example:
//
//     mustSync('echo', 'Hello, world.');
//     mustSync('rm', '-rf', tempFolder, { cwd: /tmp });
//
// Returns nothing.
function mustSync() {
  var args = toArray(arguments),
      name = args.shift(),
      options = (typeof args[args.length - 1] != 'string') ? args.pop() : undefined,
      status = callSync(name, args, options);

  if (status !== 0) {
    var err = new Error(name + ' failed (exit code: ' + status + ').');
    err.status = status;
    throw err;
  }
}

function must(name, args, opt, next) {
  if (typeof opt == 'function') {
    next = opt;
    opt = undefined;
  }

  var proc = Child.spawn(name, args, opt);

  proc.on('exit', function(status) {
    if (!status)
      next(null);
    else {
      var err = new Error(name + ' failed (exit code: ' + status + ').');
      err.status = status;
      next(err);
    }
  });
}

// Extend a target object with more attributes.
//
// This method accepts a variable number of Object arguments. The
// (key, value) pairs from each are set on the target in order. For
// example:
//
//     extend({}, {a: 1, b: 2}, {b: 3, c: 4})
//     ==> {a: 1, b: 3, c: 4}
//
// Returns target.
function extend(target) {
  var obj, key;

  target = target || {};
  for (var i = 1, l = arguments.length; i < l; i++) {
    if ((obj = arguments[i])) {
      for (key in obj)
        target[key] = obj[key];
    }
  }

  return target;
}

// Convert a source object to an Array.
//
// + source - Object with a `length` property.
// + offset - Integer starting offset (optional)
//
// Returns Array.
function toArray(source, offset) {
  if (offset === undefined)
    offset = 0;

  if (!source || offset >= source.length)
    return [];

  var result = new Array(source.length - offset);

  for (var i = 0, l = result.length; i < l; i++)
    result[i] = source[i + offset];

  return result;
};

// Generate a random, temporary name.
//
// Returns String.
function tempname(prefix, suffix) {
  prefix = (prefix === undefined) ? kTempPrefix : prefix;
  suffix = suffix || '';

  var salt = Math.random() * Math.exp(10),
      digest = require('crypto').createHash('md5')
        .update(process.pid)
        .update(Date.now())
        .update(salt)
        .digest('hex');

  return prefix + digest + suffix;
}

// Generate a prefixed, hashed version `name`.
//
// Returns String
function hashname(name, prefix) {
  prefix = (prefix === undefined) ? kTempPrefix : prefix;
  return prefix + md5(name);
}

var kTempPrefix = (function() {
  var name = process.argv[1] || process.argv[0];
  return Path.basename(name).replace(/\..*$/, '') + '-';
})();

// Remove extensions from a name.
function withoutExt(name) {
  if (name == '.' || name == '..')
    return name;

  var ext = name && Path.extname(name);
  return ext ? name.substr(0, name.length - ext.length) : name;
}

// Generate the MD5 digest of a string.
//
// + s - String input
//
// Returns String hex digest.
function md5(s) {
  return require('crypto').createHash('md5').update(s).digest('hex');
}

function digestSync(path, method, none) {
  try {
    require('crypto').createHash(method).update(this.readFile());
  } catch (x) {
    if (x.errno == process.ENOENT && none !== undefined)
      return none;
    throw x;
  }
};

function digest(path, method, none, next) {
  var hash = require('crypto').createHash(method),
      stream = Fs.createReadStream(path),
      state = listen()
        .on(stream, { error: done, data: update, end: done })
        .start(next);

  function update(chunk) {
    hash.update(chunk);
  }

  function done(err) {
    if (err && err.errno == process.ENOENT && none !== undefined)
      state.done(null, none);
    else if (err)
      state.done(err);
    else
      state.done(null, hash);
  }
}

// Parse not-quite-JSON.
//
// This is a workaround for not having a more permissive JSON parser.
function loadJSONish(data, next) {
  return parseJSON(data.replace(/'/g, '"').replace(/,(\s*})+/g, '$1'), next);
}

function parseJSON(data, next) {
  if (!next)
    return JSON.parse(data);

  var err, obj;

  try {
    obj = JSON.parse(data);
  } catch (x) {
    err = x;
  }

  next(err, obj);
}

function stringifyJSON(obj, next) {
  if (!next)
    return JSON.stringify(obj);

  var err, data;

  try {
    data = JSON.stringify(obj);
  } catch (x) {
    err = x;
  }

  next(err, data);
}

function loadSync(path, method, opt) {
  opt = opt || {};
  try {
    return method(Fs.readFileSync(path, opt.encoding));
  } catch (x) {
    if (x.errno == process.ENOENT && opt.none !== undefined)
      return opt.none;
    throw x;
  }
}

function load(path, method, opt, next) {
  opt = opt || {};
  Fs.readFile(path, opt.encoding || null, function(err, data) {
    if (err && err.errno == process.ENOENT && opt.none !== undefined)
      next(null, opt.none);
    else if (err)
      next(err);
    else
      method(data, next);
  });
}

function dumpSync(method, path, val, opt) {
  return writeFileSync(path, method(val), opt);
}

function dump(method, path, val, opt, next) {
  method(val, function(err, data) {
    err ? next(err): writeFile(path, data, opt, next);
  });
}

function writeFileSync(path, data, opt) {
  var atomic = opt && opt.atomic,
      encoding = opt && opt.encoding,
      prefix = opt && opt.prefix;

  if (atomic) {
    var temp = atomicName(path, prefix);
    Fs.writeFileSync(temp, data, encoding);
    try {
      Fs.renameSync(temp, path);
    } catch (x) {
      Fs.unlinkSync(temp);
      throw x;
    }
  }
  else {
    Fs.writeFileSync(path, data, encoding);
  }
}

function writeFile(path, data, opt, next) {
  var atomic = opt && opt.atomic,
      encoding = opt && opt.encoding,
      prefix = opt && opt.prefix,
      temp;

  if (atomic) {
    temp = atomicName(path, prefix);
    Fs.writeFile(temp, data, encoding, rename);
  }
  else
    Fs.writeFile(path, data, encoding, next);

  function rename(err) {
    err ? next(err) : Fs.rename(temp, path, rollback);
  }

  function rollback(err) {
    if (err) {
      Fs.unlink(temp, function() { });
      next(err);
    }
    else
      next(null);
  }
}

function atomicName(path, prefix) {
  return Path.join(Path.dirname(path), tempname(prefix || '.atomic'));
}

// Get commandline options.
//
// Reads command line options beginning with a single hypen. The
// `pattern` parameter describes which options are available. If a
// colon follows a letter in the pattern, that option accepts an
// argument.
//
// Options and their values are spliced out of the argument Array.
//
//     getopt('p:h', process.argv);
//     => { p: ... }
//
// + pattern - String of letters and colons
// + args    - Array of arguments (modified)
//
// Returns Map of (option, value) items.
function getopt(pattern, args) {
  var key, val, options = {}, result = {};

  pattern.match(/\w:?/g).forEach(function(val) {
    options[val[0]] = (val.length == 1) ? true : val[1];
  });

  while (args.length > 1 && args[1].charAt(0) == '-') {
    key = args[1].substr(1);
    switch (options[key]) {
    case ':':
      if (args[2] === undefined)
        throw new Error('Missing argument to option "' + args[1] + '".');
      result[key] = args[2];
      args.splice(1, 2);
      break;

    case true:
      result[key] = options[key];
      args.splice(1, 1);
      break;

    default:
      throw new Error('Unrecognized option "' + args[1] + '".');
    }
  }

  return result;
}

// Capture an input stream into a string. Call `next()` when the
// stream is exhausted.
//
// + input    - Stream to capture
// + encoding - String `input` encoding (optional)
// + next     - Function(Error, String) callback.
//
// Returns `input`.
function capture(input, encoding, next) {
  var buffer = '';

  if (typeof encoding == 'function') {
    next = encoding;
    encoding = 'utf-8';
  }

  input.on('data', function(chunk) {
    buffer += chunk.toString(encoding);
  });

  input.on('end', function() {
    next(null, buffer);
  });

  input.on('error', next);

  return input;
}

// Redirect one stream into another.
function redirect(input, output, next) {
  var state = listen()
    .on(input, { data: onData, end: onEnd, error: onError })
    .on(output, { error: onError })
    .start(next);

  function onData(chunk) {
    if (state.isActive())
      output.write(chunk);
  };

  function onEnd() {
    state.done(null);
  };

  function onError(err) {
    state.done(err);
  }
}

// Keep track of a collection of event listeners.
function listen(ctx) {
  return new Listen();
}

function Listen(ctx) {
  this.bindings = [];
  this._ctx = ctx;
  this._next = null;
}

Listen.prototype.isActive = function() {
  return !!this._next;
};

Listen.prototype.on = function(obj, events) {
  this.bindings.push({ obj: obj, events: events });
  return this;
};

Listen.prototype.each = function(fn) {
  this.bindings.forEach(function(bound) {
    var obj = bound.obj;
    for (var name in bound.events) {
      fn.call(this, bound.events[name], name, obj);
    }
  });
  return this;
};

Listen.prototype.start = function(next) {
  this._next = next;
  return this.each(function(handler, name, obj) {
    obj.on(name, handler);
  });
};

Listen.prototype.stop = function() {
  return this.each(function(handler, name, obj) {
    obj.removeListener(name, handler);
  });
};

Listen.prototype.done = function(err) {
  if (this.stop().isActive()) {
    var next = this._next;
    this._next = null;
    next.apply(this._ctx, arguments);
  }
};

function aEach(seq, next, fn) {
  var index = 0, limit, list;

  if (typeof seq.length == 'number') {
    list = seq;
    limit = list.length;
    each();
  }
  else {
    list = Object.keys(seq);
    limit = list.length;
    eachItem();
  }

  function each(err) {
    if (err || (index >= limit))
      next(err);
    else
      fn(list[index++], index, each);
  }

  function eachItem(err) {
    if (err || (index >= limit))
      next(err);
    else {
      var key = list[index++];
      fn(seq[key], key, eachItem);
    }
  }
}
