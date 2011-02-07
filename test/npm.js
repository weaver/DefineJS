var Vows = require('vows'),
    Assert = require('assert'),
    Npm = require('../lib/npm'),
    Fs = require('fs'),
    I = require('../lib/install');

Vows.describe('Resources')
  .addBatch({
    'Looking up an exact name': {
      topic: function() { Npm.lookup('define/0.2.5', this.callback); },

      'returns the package': function(err, pkg) {
        Assert.equal((err || '').toString(), '');
        Assert.ok(pkg);
        Assert.equal(pkg.name, 'define');
      }
    },

    'Matching constraints': {
      topic: function() { Npm.lookup({ define: '>0.2.0 <0.2.3' }, this.callback); },

      'finds the best package': function(err, pkg) {
        Assert.equal((err || '').toString(), '');
        Assert.ok(pkg);
        Assert.equal(pkg.name, 'define');
        Assert.equal(pkg.version, '0.2.2');
      }
    },

    'Fetching a package': {
      topic: function() { I.get('npm:///define/0.2.5', this.callback); },

      'downloads and extracts the tarball': function(err, dest) {
        Assert.equal((err || '').toString(), '');
        Assert.ok(Fs.statSync(dest).isDirectory()),
        Assert.equal(dest.indexOf('/tmp/'), 0);
        I.destroy(dest);
      }
    }

  })
  .export(module);