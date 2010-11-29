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

And instead starting programs with `node`, use `defjs`.

## Try It ##

To get a feel for how DefineJS works, take a look at the "Hello World"
Express webserver.

    git clone git://github.com/weaver/DefineJS.git
    cd DefineJS
    ./bin/defjs examples/express-hello

    # Open http://localhost:3000/ in a browser.

The `defjs` script sets up the module loader before running a
program. In this case, it looks for a `package.json` file in the
`examples/express-hello` folder. It uses this file to download
dependencies and find the main script.

## Why? ##

The goal of this project is to make it easy to share code between the
server and the browser. Dependencies should "just work".

+ **Saves Effort**

  Modules written in this style are good for browsers (see
  [RequireJS][2]). Using the same module format on the client and
  server facilitates code reuse.

+ **Automatic**

  DefineJS fetches dependencies on-demand. The first time you work on
  a new program, feel confident that you can dive in without solving
  dependency headaches first.

+ **Isolated**

  When dependencies are cached in a project-specific location. This
  means you can develop or deploy multiple projects on the same server
  without worrying about version mismatches.

+ **Consistent**

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
    make && make install

## Use It ##

DefineJS groups modules into packages. Each package is described by a
[`package.json`][3] file at its top level that contains details like
`name`, `version`, `dependencies`, &c. The module loader uses this
information to find modules in other packages.

Use the `defjs` script where you would normally use `node`. This
will bootstrap the DefineJS module loader and run your program. If you
run into trouble, try the help command:

    defjs help

Load up a project with a `package.json` file at the top-level like
this. Whatever is defined as `main` in your package will be
automatically loaded (or `./lib/index` by default).

    defjs /path/to/project

Or, run a script. Scripts need a package to help resolve module names.
If there's not a `package.json` in the current directory, specify one
with the `-p` option.

    defjs -p /my/package ~/bin/script.js

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
