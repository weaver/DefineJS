# DefineJS #

This is an asynchronous module system for Node.JS. It's based on the
CommonJS [Modules/AsynchronousDefinition][1] specification.

Instead of writing modules like this:

    var sys = require('sys');
    sys.print('Hello, world!');

Do this:

    define(['sys'], function(sys) {
      sys.print('Hello, world!');
    });

## Why? ##

+ **DefineJS saves effort.**

  Asynchronous modules are good for browsers (see
  [RequireJS][2]). Using the same module format in both
  places facilitates code sharing.

+ **DefineJS is zero-config.**

  Managing dependencies is tedious. DefineJS automatically fetches
  dependencies and caches them in a project-specific location. The
  first time you work on a new program, feel confident that you can
  dive in without solcing dependency headaches first.

+ **DefineJS is consistent.**

  Every time you run your program, `package.json` is used to resolve
  names. If your program works when you commit it, you can be
  reasonably sure it'll work when you hand it off to someone else or
  deploy it.

## Installation ##

DefineJS relies on a few command-line utilities to fetch and extract
remote packages. Make sure the `wget`, `tar`, and `unzip` commands are
available.

The simplest way to get started is to use `npm`:

    npm install define

Or you can fetch the code from `github` and install manually:

    git clone git://github.com/weaver/DefineJS.git
    cd DefineJS
    node-waf configure build
    sudo ln -s `readlink -f bin/defnode` /usr/local/bin/defnode

## Using DefineJS ##

DefineJS works by loading packages. Each package is described by a
[`package.json`][3] file at its top level that contains details like
`name`, `version`, &c. The module loader uses this information to
start the `main` program.

Use the `defnode` script where you would normally use `node`. If you
run into trouble, try the help command:

    defnode help

Load up a project with a `package.json` file at the top-level:

    defnode /path/to/project

Or, run a script. Scripts need a package to help resolve module names.
If there's not a `package.json` in the current directory, specify it
with the `-p` option.

    defnode -p /my/package ~/bin/script.js

[1]: http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition
[2]: http://requirejs.org/
[3]: http://wiki.commonjs.org/wiki/Packages/1.1
