# Define.JS #

This is an asynchronous module system for Node.JS. It's based on the
CommonJS [Asynchronous Definition][1] specification and uses the
`package.json` file to automatically fetch dependencies for you.

Modules with asynchronous semantics fit Node well. They look like
this:

    define(['sys'], function(sys) {
      sys.print('Hello, world!');
    });

A related project, [RequireJS][2], allows modules written this way to
be loaded into a browser. This makes it very easy to share the same
code on the client- and server-side.

## Installation ##

Fetch the code from `github` manually or use `npm`:

    npm install define.js

## Using Define.JS ##

Define.JS comes with a convenience script called `defjs`. Use it
instead of `node` to run a program:

    cd /path/to/project
    defjs

which is simply a shortcut for this manual method:

    cd /path/to/project
    export NODE_MODULE_CACHE='/tmp/defjs'
    node /path/to/define.js/lib/index.js

In either case, `path/to/project` should contain a `package.json`
file that describes your project.

[1]: http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition
[2]: http://requirejs.org/
