// index.js - public interface

var Package = require('./package');

exports.makeContext = Package.makeContext;


// ## Main Program ##

// If this module is used as the main program, it will initialize a
// new context by assuming that the current directory is the main
// Package.

function main() {
  var base = process.cwd(),
      options = {
        cache: process.env['NODE_MODULE_CACHE'],
        freshContexts: parseInt(process.env['NODE_MODULE_CONTEXTS'] || '0') > 0
      };

  // Remove this file from the arguments.
  process.argv.splice(1, 1);

  Package
    .makeContext(base, options)
    .initSync();
}

if (module.id == '.')
  main();