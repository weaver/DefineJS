var U = require('./util'),
    R = require('./resource'),
    Package = require('./package');

exports.main = main;


// ## Main Program ##

function main(args) {
  var pkg = process.cwd(),
      options = {
        cache: process.env['NODE_MODULE_CACHE'],
        freshContexts: parseInt(process.env['NODE_MODULE_CONTEXTS'] || '0') > 0
      };

  // Remove this file from the arguments.
  args.splice(1, 1);

  var extra = U.getopt('p:', args);
  if (extra.p)
    pkg = extra.p;

  return dispatch(pkg, options, args);
}

function dispatch(pkg, options, args) {
  if (!args[1])
    return cmd.shell(pkg, options, args);

  var path = args[1],
      stat = R.statSync(path);

  if (stat && stat.isDirectory()) {
    if (R.existsSync(R.join(path, 'package.json'))) {
      return cmd.load(path, options, args);
    }
  }

  if (stat && stat.isFile()) {
    return cmd.script(pkg, options, args);
  }

  if (cmd[path]) {
    args.splice(1, 1);
    return cmd[path](pkg, options, args);
  }

  throw new Error('Unrecognized path or command: "' + path + '".');
}


// ## Main Variants ##


// ## Commands ##

var cmd = {};

function defC(name, doc, fn) {
  fn.__doc__ = doc;
  return (cmd[name] = fn);
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
      '  -p: Use this package to run a script.',
      '',
      '## Available Commands ##',
      ''
    );

    var names = Object.keys(cmd).sort(),
        size = names.reduce(function(max, s) { return Math.max(max, s.length); }, 0);

    names.forEach(function(name) {
      console.log('  + %s: %s', field(name, size), cmd[name].__doc__);
    });

    print('');
  });

defC('shell', 'Start an interactive shell.',
  function(pkg, options, args) {
    throw new Error('TODO: implement shell :)');
  });

defC('script', 'Run a script.',
  function(pkg, options, args) {
    Package
      .makeContext(pkg, options)
      .initSync(resolveInFolder(process.cwd(), spliceOut(args, 1)));
  });

defC('load', 'Load up a package, run its main module.',
  function(pkg, options, args) {
    Package
      .makeContext(pkg, options)
      .initSync();
  });


// ## Extra ##

function print() {
  console.log(U.toArray(arguments).join('\n'));
}

function field(s, size) {
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