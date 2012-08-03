# DefineJS #

DefineJS is an Asynchronous Module Definition wrapper for
Node. Writing modules in AMD style is convenient when code is shared
between Node and a browser. The client needs to use an AMD loader like
[RequireJS][0].


## Installation ##

Add a dependency to your project's `package.json` and run `npm
install`:

    {
        "dependencies" {
            "define": "1.0"
        }
    }

or install manually:

    npm install define


## Get Started ##

In your app's main script:

    require('define');

This will add `define` as a `global` so it's available everywhere else
in the application automatically. Create AMD modules anywhere you
like. They can be loaded with `require` or `define`.

See `examples/shared-code` for a working example web server.


## Features ##

+ Share code with web browsers!
+ Very lightweight integration with Node's module system.
+ No need for conditional `require('define')` in every AMD module.
+ Compatible with [AMD Define][2].
+ Compatible with [AMD Require][3].


## DefineJS is Global ##

DefineJS installs `define` as a global when it's loaded. The makes
`define` available everywhere else in the application without any
special workarounds in each file.

If you don't want a global definition, do the following in your app's
main script:

    require('define').noConflict();

then, for individual modules that need `define`:

    if (typeof define === 'undefined') {
        var define = require('define');
    }

However, if you prefer this approach and you're using [RequireJS][0]
for the client-side loader anyway, you should probably just use the
similar [amdefine convention][1] because the RequireJS optimizer
strips it away.


## Module Ids ##

The [AMD Spec][2] allows module definitions to optionally specify an
id. This is very helpful for transport when several modules are
concatenated into the same file.

DefineJS currently accepts module ids, but ignores them. This is
because it's just a very light wrapper around Node's `require`. Node
uses a module's absolute filename as the id, so defining more than one
module in a file is currently unsupported.

In practice, this doesn't matter very much. Just follow the
one-module-to-one-file convention and use something like the
[RequireJS Optimizer][4] for client-side code in production.


## See Also ##

Refer to the [AMD Wiki][2] for more information about AMD.

[0]: http://requirejs.org/
[1]: http://requirejs.org/docs/node.html#nodeModules
[2]: https://github.com/amdjs/amdjs-api/wiki/AMD
[3]: https://github.com/amdjs/amdjs-api/wiki/require
[4]: http://requirejs.org/docs/optimization.html
