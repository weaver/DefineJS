// index.js - public interface

var Package = require('./package');

exports.makeContext = Package.makeContext;

if (module.id == '.')
  require('./cli').main(process.argv);