var Vows = require('vows'),
    Assert = require('assert'),
    F = require('../lib/file'),
    U = require('../lib/util');

Vows.describe('Files')
  .addBatch({
    'Finding a mimetype for a known extension': {
      topic: function() { F.mimetype('example.zip', this.callback); },

      'works immediately': function(err, mime) {
        Assert.ok(!err);
        Assert.equal(mime, 'application/zip');
      }
    },

    'Finding a mimetype for an unknown extension': {
      topic: function() { F.mimetype(__filename, this.callback); },

      'uses the `file` utility': function(err, mime) {
        Assert.ok(!err);
        Assert.ok(mime && mime.indexOf('text/') == 0);
      }
    },

    'Finding a mimetype for a bad filename': {
      topic: function() { F.mimetype(__filename + 'x', this.callback); },

      'can fail': function(err, mime) {
        Assert.ok(err);
        Assert.ok(!mime);
      }
    }
  })
  .export(module);