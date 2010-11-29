var Sys = require('sys'),
    U = require('./util'),
    R = require('./resource'),
    Package = require('./package');

exports.main = main;


// ## Main Program ##

function main(args) {
  var pkg = process.cwd(),
      config = {
        cache: process.env['NODE_MODULE_CACHE'],
        freshContexts: parseInt(process.env['NODE_MODULE_CONTEXTS'] || '0') > 0,
        showInfo: false,
        showLog: true,
        clearCache: false
      };

  // Remove this file from the arguments.
  args.splice(1, 1);

  try {
    var opts = U.getopt('cdp:q', args);
  } catch (x) {
    help();
    Sys.exit(1);
  }

  if (opts.p)
    pkg = opts.p;
  if (opts.d)
    config.showInfo = opts.d;
  if (opts.q)
    config.showInfo = config.showLog = false;
  if (opts.c)
    config.clearCache = true;

  return dispatch(pkg, config, args);
}

function dispatch(pkg, config, args) {
  if (!args[1])
    return cmd.shell(pkg, config, args);

  var path = args[1],
      stat = R.statSync(path);

  if (stat && stat.isDirectory()) {
    if (R.existsSync(R.join(path, 'package.json'))) {
      return cmd.load(path, config, args);
    }
  }

  pkg = completeName(pkg);

  if (stat && stat.isFile()) {
    return cmd.script(pkg, config, args);
  }

  if (cmd[path]) {
    args.splice(1, 1);
    return cmd[path](pkg, config, args);
  }

  throw new Error('Unrecognized path or command: "' + path + '".');
}


// ## Commands ##

var cmd = {};

function defC(name, doc, fn) {
  fn.__doc__ = doc;
  return (cmd[name] = fn);
}

function help() {
  return cmd['help']();
}

defC('help', 'Help with commands.',
  function() {
    print(
      'Usage: ',
      '  defjs [options]',
      '  defjs [options] command',
      '  defjs [options] script [arguments ...]',
      '',
      '# DefineJS Help #',
      '',
      ('DefineJS is an asynchronous module loader for Node. Use `defjs` script where '
       + 'you would normally use `node`. It starts a shell when no arguments are '
       + 'given.'),
      '',
      '## Options ##',
      '',
      '  -c:     clear the cache',
      '  -d:     show debug information',
      '  -p PKG: use PKG as the root package',
      '  -q:     be quiet',
      '',
      '## Available Commands ##',
      ''
    );

    var names = Object.keys(cmd).sort(),
        size = names.reduce(function(max, s) { return Math.max(max, s.length); }, 0);

    names.forEach(function(name) {
      console.log('  + %s: %s', align(name, size), cmd[name].__doc__);
    });

    print('');
  });

defC('shell', 'Start an interactive shell.',
  function(pkg, config, args) {
    throw new Error('TODO: implement shell :)');
  });

defC('script', 'Run a script.',
  function(pkg, config, args) {
    Package
      .makeContext(pkg, config)
      .initSync(resolveInFolder(process.cwd(), spliceOut(args, 1)));
  });

defC('load', 'Load up a package, run its main module.',
  function(pkg, config, args) {
    Package
      .makeContext(pkg, config)
      .initSync();
  });


// ## Package Name Completion ##

function completeName(name) {
  var uri = R.parse(name);
  if (uri.protocol == 'http:' || uri.protocol == 'https:') {
    if (uri.hostname == 'github.com')
      return completeGithub(uri);
  }
  return name;
}

function completeGithub(uri) {
  var name = R.format(uri);
  if (uri.pathname.match(/^\/[^\/]+\/[^\/]+\/*$/))
    // Autocomplete user/repo to user/repo/zipball/master
    return R.simpleJoin(name, 'zipball/master');
  return name;
}


// ## Extra ##

function print() {
  console.log(U.toArray(arguments).join('\n'));
}

function align(s, size) {
  while (s.length < size)
    s += ' ';
  return s;
}

function folderName(name) {
  return name.replace(/\/*$/, '') + '/';
}

function resolveInFolder(folder, name) {
  return R.resolve(folderName(folder), name);
}

function spliceOut(list, index) {
  var val = list[index];
  list.splice(index, 1);
  return val;
}
