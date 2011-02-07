---
layout: default
title: A reliable, non-blocking module loader for Node
---

# DefineJS #

A reliable, [non-blocking module][8] loader for [Node.js][1].

## Install ##

Run this command to download and install DefineJS:

    curl http://definejs.org/install | sh

Or use [NPM][6]:

    npm install define

The source code is available on [github][7].

## Introduction ##

Here's an example module that uses [express][2] to create a "Hello
World" webserver:

    define(['express'], function(express) {
      var app = express.createServer();

      app.get('/', function(req, res){
        res.send('Hello World');
      });

      app.listen(3000);
      console.log('Listening on <http://localhost:3000/>');
    });

Place this code into a file called `server.js`. Try running it in the
context of the [express master branch][3] like this:

    defjs -p http://github.com/visionmedia/express server.js

The `defjs` command starts Node, loads your module, and automatically
downloads dependencies for you.

Running a program this way is quick and informal. Before deploying it,
you'll want to be more specific about which [version][4] of express to
use. Do this by writing a [package][5] definition:

    {
      "name": "hello",
      "description": "An express Hello World webserver.",
      "version": "0.1.0",
      "dependencies": {
        "express": "1.0"
      }
    }

Put this into a file called `package.json` next to `server.js`. Now
you have a package. Run it like this:

    defjs server.js

## Features ##

* Non-blocking format.
* Can use existing Node packages.
* Works with NPM.
* Downloads dependencies on-demand.
* Each project has its own dependency cache.
* Supports remote packages: quickly try new libraries.
* Compatible with [Modules/AsynchronousDefinition][8] proposal.
* Compatible with [Packages/1.1][5] draft.
* Compatible with [RequireJS][9]: share code with the browser.

## Why? ##

Node already supports modules with `require()`. There are other great
package managers like `npm`. Why make DefineJS?

### Non-blocking ###

A non-blocking module format is a natural fit for Node. Although
`require.async()` already allows modules to be loaded asynchronously,
the `define()` format is terser. Multiple modules can be passed to a
single callback.

### Browser-friendly ###

A related project, [RequireJS][9], loads `define()`-style modules into
browsers. This makes sharing the same code between clients and servers
easier. [RequireJS][9] also comes with nice optimization tools to
bundle and minify packages before deployment.

### Isolated ###

Hosting multiple projects on the same computer quickly leads to
dependency hell with most module installers. Installing a new library
just to try it out leaves behind cruft. Keeping development and
production environments consistent is tedious.

DefineJS addresses these problems keeping dependencies in a
project-specific location. In this way, it's like Python's
[virtualenv][10]. It goes a step further by downloading dependencies
on-demand.

Names are always resolved through `package.json` files. When something
works in your development environment, it's more likely to "just work"
you share it with someone else or deploy it.

## Status ##

This project is a usable alpha. Send feedback to ben at
orangesoda.net. [Contributions][7] are welcome.

[1]: http://nodejs.org/
[2]: http://expressjs.com/
[3]: https://github.com/visionmedia/express
[4]: http://semver.org/
[5]: http://wiki.commonjs.org/wiki/Packages/1.1
[6]: http://npmjs.org/
[7]: https://github.com/weaver/DefineJS
[8]: http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition
[9]: http://requirejs.org/
[10]: http://pypi.python.org/pypi/virtualenv
