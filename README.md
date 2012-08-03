# DefineJS #

DefineJS is an Asynchronous Module Definition wrapper for
Node. Writing modules in AMD style is convenient when code is shared
between Node and a browser. The client needs to use an AMD loader like
[RequireJS][0].


## How To Use ##

In your app's main script, `require('define')`. This will add `define`
as a `global` so it's available everywhere else in the application
automatically. See `examples/shared-code` for a working example web
server.


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

For example:

    define(['exports', 'http'], function(exports, http) {
        function helloServer(port) {
            return http.createServer(handle).listen(port);
        };

        function handle(req, res) {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('Hello World\n');
        }
    });


## See Also ##

Refer to the [AMD Wiki][1] for more information about AMD.

[0]: http://requirejs.org/
[1]: http://requirejs.org/docs/node.html#nodeModules
[2]: https://github.com/amdjs/amdjs-api/wiki/AMD
