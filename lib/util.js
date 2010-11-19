// util.js - extra methods that don't belong anywhere else

var _defjs = require(__dirname + '/../build/default/_defjs');

exports.liftSync = liftSync;
exports.mustSync = mustSync;
exports.callSync = callSync;
exports.extend = extend;
exports.toArray = toArray;
exports.tempname = tempname;
exports.md5 = md5;

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
      res = callSync(name, args, options);

  if (res !== 0)
    throw new Error(name + ' failed (exit code: ' + res);
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
function tempname() {
  var salt = Math.random() * Math.exp(10);
  return require('crypto').createHash('md5')
    .update(process.pid)
    .update(Date.now())
    .update(salt)
    .digest('hex');
}

// Generate the MD5 digest of a string.
//
// + s - String input
//
// Returns String hex digest.
function md5(s) {
  return require('crypto').createHash('md5').update(s).digest('hex');
}
