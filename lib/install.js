// # install.js #
//
// Download and install packages.

var Url = require('url'),
    Path = require('path'),
    Qs = require('querystring'),
    Fetch = require('./fetch'),
    SemVer = require('./semver'),
    U = require('./util');

exports.get = get;
exports.install = install;
exports.destroy = destroy;
exports.uriTempName = uriTempName;

function get(uri, next) {
  var dest = uriTempName(uri);
  install(uri, null, dest, function(err) {
    err ? next(err) : next(null, dest);
  });
}

function destroy(path, next) {
  next ? U.must('rm', ['-rf', path], next) :
    U.mustSync('rm', '-rf', path);
}


// ## Installing ##

// Install a package.
//
// URI scenarios:
//
//   + local folder
//   + local archive (zip, tar, &c)
//   + remote archive
//   + remote git repository
function install(uri, base, dest, next) {
  var temp, work;

  Path.exists(dest, function(exists) {
    if (exists)
      next(null);
    else {
      console.warn('+ installing <%s>', uri);
      Fetch.fetch(uri, base, check);
    }
  });

  function check(err, file) {
    err ? next(err) : file.isFolder(function(folder) {
      folder ? use(null, file) : extract(file);
    });
  }

  function extract(file) {
    Fetch.extract(file, base, function(err, folder) {
      file.done();
      err ? next(err) : (temp = folder).onlyFolder(use);
    });
  }

  function use(err, folder) {
    err ? done(err) : maybeRun('preinstall', work = folder, ready);
  }

  function ready(err) {
    if (err) {
      work && work.done();
      done(err);
    }
    else if (work.isTemporary())
      work.rename(dest, done);
    else
      //work.symlink(dest, done);
      done();
  }

  function done(err) {
    temp && temp.done();
    next(err);
  }
}


// ## Names ##

function uriTempName(uri, base, hint) {
  uri = (typeof uri == 'string') ? Url.parse(uri) : uri;
  base = base || '/tmp';

  var prefix = (hint || uriPrefix(uri)) + '-',
      name = Url.format(uri);

  return Path.join(base, U.hashname(name, prefix));
}

// Deconstruct a URI into a short prefix.
//
// Local URIs:
//
// + /path/to/archive.zip    --> archive
// + /path/to/folder         --> folder
// + /path/to/module/vX.Y.Z  --> module-vX.Y.Z
//
// Remote URIs:
//
// + https://github.com/weaver/DefineJS/tarball/v0.2.5 --> DefineJS-v0.2.5
// + http://nodejs.org/dist/node-v0.2.6.tar.gz         --> node-v0.2.6
// + npm:///name/x.y.z                                 --> name-x.y.z
// + npm:/?name=x.y.z                                  --> name


function uriPrefix(uri) {
  var parts = uri.pathname.split(/\/+/g),
      name;

  if (parts.length == 1)
    return U.withoutExt(parts[0]);

  // Remove the leading empty string.
  parts.shift();

  if (uri.protocol == '' || uri.protocol == 'file:') {
    // Quick exit for `/path/to/module/vX.Y.Z`
    if (SemVer.isSemVer(name = parts.pop()))
      return withoutExt(parts.pop()) + '-' + name;
    name = U.withoutExt(name);
  }
  else if (uri.protocol == 'npm:') {
    if (!uri.query)
      return parts.join('-');
    else if (typeof uri.query == 'string')
      return Object.keys(Qs.parse(uri.query)).join('-');
    else
      return Object.keys(uri.query).join('-');
  }
  else if (parts.length == 1) {
    return U.withoutExt(parts[0]);
  }
  else {
    // Ignore the leading part of the path. Assume it's probably
    // something like "dist" or a username.
    parts.shift();

    // Use the second part of the path as the primary name.
    name = U.withoutExt(parts.shift());
  }

  // Look for a version, append it to the name.
  for (var i = 0, l = parts.length; i < l; i++) {
    if (SemVer.isSemVer(parts[i])) {
      name = name + '-' + parts[i];
      break;
    }
  }

  return name;
}


// ## Scripts ##

function maybeRun(script, folder, next) {
  var pkgFile = folder.join('package.json'),
      stateFile = folder.join('.defjs');

  pkgFile.digest('md5', '', function(err, hash) {
    err ? next(err) : compare(hash && hash.digest('hex'));
  });

  function compare(digest) {
    stateFile.loadJSON({}, function(err, obj) {
      (err || obj[script] === digest) ? next(err) : run(digest, obj);
    });
  }

  function run(digest, state) {
    runScript(script, folder, function(err) {
      err ? next(err) : remember(digest, state);
    });
  }

  function remember(digest, state) {
    state[script] = digest;
    stateFile.dumpJSON(state, { atomic: true, prefix: '.defjs-' }, next);
  }
}

function runScript(name, folder, next) {
  var pkgFile = folder.join('package.json'),
      opt = { encoding: 'utf-8', none: {} },
      pkg;

  pkgFile.load(U.loadJSONish, opt, function(err, obj) {
    err ? next(err) : getScript(folder, (pkg = obj), name, run);
  });

  function run(script) {
    !script ? next(null) :
      U.must('sh', ['-c', script], { cwd: folder.path }, next);
  }
}

function getScript(folder, pkg, name, next) {
  if (pkg.scripts && pkg.scripts[name])
    next(pkg.scripts[name]);
  else if (name in SCRIPTS)
    SCRIPTS[name](folder, pkg, name, next);
  else
    next();
}

var SCRIPTS = {
  preinstall: function(folder, pkg, name, next) {
    folder.hasFile('wscript', function(exists) {
      exists ? next('node-waf configure build') : next();
    });
  }
};