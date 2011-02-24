// # npm.js #
//
// NPM support for the installer.

var Fetch = require('./fetch'),
    SemVer = require('./semver'),
    Qs = require('querystring'),
    U = require('./util');

exports.lookup = lookup;

Fetch.fetch.def(['npm'], function fetchNpm(uri, base, next) {
  var name = uri.pathname;

  if (uri.query)
    name = (typeof uri.query == 'string') ? Qs.parse(uri.query) : uri.query;

  lookup(name, function(err, info) {
    if (err)
      next(err);
    else if (!info)
      next(new Error('cannot resolve: ' + format(uri)));
    else if (!(info.dist && info.dist.tarball))
      next(new Error('no tarball: ' + format(uri)));
    else
      Fetch.fetch(info.dist.tarball, base, next);
  });
});

function lookup(name, next) {
  (typeof name == 'object') ? satisfyNpm(name, next) :
    exactNpm(name, next);
}

function exactNpm(path, next) {
  mustGetJSON(registryUri(path), next);
}

function satisfyNpm(opt, next) {
  var error;

  U.aEach(opt, done, function(constraint, path, loop) {
    mustGetJSON(registryUri(path, constraint), function(err, info) {
      if (err) {
        error = err;
        loop();
      }
      else {
        if (info.versions)
          info = satisfy(constraint, info, path);

        info ? done(null, info) : loop();
      }
    });
  });

  function done(err, pkg) {
    if (err)
      next(err);
    else if (!pkg)
      next(error);
    else
      next(null, pkg);
  }
}

function registryUri(path, constraint) {
  var base = 'http://registry.npmjs.org/',
      result = base + path.replace(/^\/+|\/+$/g, '') + '/';

  if (constraint !== undefined) {
    if (SemVer.isExact(constraint))
      result += constraint;
    else if (SemVer.isAny(constraint))
      result += 'latest';
  }

  return result;
}

function mustGetJSON(uri, next) {
  getJSON(uri, function(err, info) {
    if (err)
      next(err);
    else if (info.error)
      next(new Error(Url.format(uri) + ' :: ' + info.error));
    else
      next(null, info);
  });
}

function getJSON(uri, next) {
  Fetch.open(uri, function(err, resp) {
    err ? next(err) : U.capture(resp, parse);
  });

  function parse(err, data) {
    err ? next(err) : U.parseJSON(data, next);
  }
}

function satisfy(constraint, info, path) {
  var available = Object.keys(info.versions),
      best = SemVer.satisfy(constraint, available);
  return best && info.versions[SemVer.format(best)];
}

