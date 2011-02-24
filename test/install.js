var Vows = require('vows'),
    Assert = require('assert'),
    Fs = require('fs'),
    Path = require('path'),
    I = require('../lib/install');

Vows.describe('Resources')
  .addBatch({
    // 'Getting a folder': {
    //   topic: function() { I.get(Path.dirname(__dirname), this.callback); },

    //   'symlinks it': function(err, dest) {
    //     Assert.equal((err || '').toString(), '');
    //     Assert.ok(Fs.lstatSync(dest).isSymbolicLink());
    //     Assert.equal(Fs.readlinkSync(dest), Path.dirname(__dirname));
    //     Fs.unlinkSync(dest);
    //   }
    // }

    'Getting a local zipball': {
      topic: function() { I.get(Path.join(__dirname, 'some-package.zip'), this.callback); },

      'extracts it': function(err, dest) {
        Assert.equal((err || '').toString(), '');
        Assert.ok(Fs.statSync(dest).isDirectory()),
        Assert.equal(dest.indexOf('/tmp/'), 0);
        Assert.deepEqual(Fs.readdirSync(dest), ['package.json', '.defjs', 'lib']);
        I.destroy(dest);
      }
    },

    'Getting a remote tarball': {
      topic: function() { I.get('https://github.com/weaver/DefineJS/tarball/v0.2.5', this.callback); },

      'downloads and extracts it': function(err, dest) {
        Assert.equal((err || '').toString(), '');
        Assert.ok(Fs.statSync(dest).isDirectory()),
        Assert.equal(dest.indexOf('/tmp/'), 0);
        I.destroy(dest);
      }
    },

    'Getting a git repository': {
      topic: function() { I.get('git://github.com/weaver/DefineJS.git', this.callback); },

      'extracts it': function(err, dest) {
        Assert.equal((err || '').toString(), '');
        Assert.ok(Fs.statSync(dest).isDirectory()),
        Assert.equal(dest.indexOf('/tmp/'), 0);
        Assert.ok(Fs.statSync(Path.join(dest, 'build/default/_defjs.node')));
        I.destroy(dest);
      }
    }
  })
  .export(module);

