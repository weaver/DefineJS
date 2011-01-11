# DefineJS #

A reliable, [non-blocking module][1] loader for [Node.js][4]. See
[http://definejs.org/][5] for more details.

## Install It ##

DefineJS relies on a few command-line utilities to fetch and extract
remote packages. Make sure the `wget`, `tar`, and `unzip` commands are
available.

Run this command to download and install DefineJS:

    curl https://github.com/weaver/DefineJS/raw/master/bin/install.sh | sh

Or use `npm`:

    npm install define

Or install manually:

    git clone git://github.com/weaver/DefineJS.git
    cd DefineJS
    make && make setup

## Use It ##

DefineJS groups modules into packages. Each package is described by a
[`package.json`][3] file at its top level that contains details like
`name`, `version`, `dependencies`, &c. The module loader uses this
information to find modules in other packages.

Use the `defjs` command where you would normally use `node`. This will
bootstrap the DefineJS module loader and run your program. If you have
trouble, try the `help` command:

    defjs help

Start a project with a `package.json` file at the top-level like
this. Whatever is defined as `main` in the package will be
automatically loaded (or `./lib/index` by default).

    defjs /path/to/project

To run a script directly, specify a package to help resolve module
names.  If there's not a `package.json` in the current directory,
specify one with the `-p` option.

    defjs -p /my/package ~/bin/script.js

## About Caching ##

Dependencies are downloaded on-demand and cached in a project-specific
location. By default, this is in a `.packages` folder that's
automatically created in the same directory as the root package.

If you run `defjs` like this:

    defjs -p /my/project

It will cache dependencies in `/my/project/.packages/`. You can clear
the cache any time by using the `-c` option. The `NODE_MODULE_CACHE`
environment variable can override the cache location. For example:

    export NODE_MODULE_CACHE=/tmp/project-packages
    defjs -c /my/project

will cache dependencies in `/tmp/project-packages` and clear anything
already cached there before running the `main` script.

## Module Format ##

Refer to the [Modules/AsynchronousDefinition][1] proposal for a
detailed description of the module format. Most of the time, you'll
use this format:

    define(['name1', 'name2', ...], function(mod1, mod2, ...) {

    });

Whatever is returned from the `function` is used as the module's
exports. If nothing is returned, whatever is added to `exports` is
used.

Names have the same format as Node's `require()`:

  + 'name': a top-level module
  + './name': relative to the current module
  + '/path/to/name': absolute module

There are three special names: `exports`, `module`, and
`require`.

## Package Format ##

Refer to the [Packages/1.1][3] draft for a detailed
description. Dependencies are automatically resolved through
[NPM][6]. To override this, add a `mappings` entry. At a minimum, a
project should have a `package.json` file with `name`, `version`, and
`main` entries.

For example:

    {
      "name": "my-project",
      "version": "0.5.2",
      "main": "./server",
      "dependencies": {
        "express": "1.0"
      },
      "mappings": {
        "commonjs-utils": "http://github.com/kriszyp/commonjs-utils/zipball/v0.2.2"
      }
    }

will resolve the name `'express'` through NPM and will resolve
`'commonjs-utils/lazy-array'` directly to a github repository.

## Status ##

This project is a usable alpha. Feedback and contributions are
welcome.

TODO:

  + Move best-dependency-in-group logic into package
  + Better package names in filesystem
  + Link URL attempts to final match (memo && filesystem)
  + Delay `define()` body until code has finished evaluating.
  + Support `overlay`.
  + Support `engine`.
  + Aync fetching

## License ##

Copyright (c) 2010, Ben Weaver &lt;ben@orangesoda.net&gt;
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

* Redistributions of source code must retain the above copyright
  notice, this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright
  notice, this list of conditions and the following disclaimer in the
  documentation and/or other materials provided with the distribution.

* Neither the name of the <organization> nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT
HOLDER> BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

[1]: http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition
[2]: http://requirejs.org/
[3]: http://wiki.commonjs.org/wiki/Packages/1.1
[4]: http://nodejs.org/
[5]: http://definejs.org/
[6]: http://npmjs.org/
