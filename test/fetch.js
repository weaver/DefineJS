var Vows = require('vows'),
    Assert = require('assert'),
    Fetch = require('../lib/fetch'),
    U = require('../lib/util');

Vows.describe('Fetching')
  .addBatch({
    'Fetching an existing file': {
      topic: function() { Fetch.fetch(__filename, this.callback); },

     'returns the file': function(err, file) {
       Assert.ok(!err);
       Assert.equal(file.path, __filename);
       file.mimetype(function(err, type) {
         Assert.equal(type.indexOf('text/'), 0);
       });
     }
    },

    'Fetching a remote file': {
      topic: function() { Fetch.fetch('https://github.com/weaver/DefineJS/zipball/master', this.callback); },

      'returns a temporary file': function(err, file) {
        Assert.ok(!err);
        Assert.equal(file.path.indexOf('/tmp/'), 0);
        Assert.ok(goodZip(file.path));
        file.mimetype(function(err, type) {
          Assert.equal(type, 'application/zip');
          this.done(function() { });
        });
      }
    }
  })
  .addBatch({
    'Zip files': {
      topic: function() { Fetch.extract(__dirname + '/some-package.zip', this.callback); },

      'are extracted to a temporary location': function(err, file) {
        Assert.ok(!err);
        Assert.equal(file.path.indexOf('/tmp/'), 0);
        Assert.equal(file.readdir()[0].basename(), 'some-package');
        file.done(function() { });
      }
    },

    'TarGz files': {
      topic: function() { Fetch.extract(__dirname + '/some-package.tar.gz', this.callback); },

      'are extracted to a temporary location': function(err, file) {
        Assert.ok(!err);
        Assert.equal(file.path.indexOf('/tmp/'), 0);
        Assert.deepEqual(file.readdir()[0].basename(), 'some-package');
        file.done(function() { });
      }
    }

  })
  .export(module);

function goodZip(path) {
  U.mustSync('unzip', '-qqt', path);
  return true;
}