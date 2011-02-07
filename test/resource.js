var Vows = require('vows'),
    Assert = require('assert'),
    R = require('../lib/resource');

Vows.describe('Resources')
  .addBatch({
    'A Resource Cache': {
      topic: new R.Cache('/tmp/test-defjs'),

      'can be set up': function(cache) {
        cache.setupSync();
      },

      'can resolve package references': {
        topic: function(cache) {
          return cache.resolveSync('npm:///define/0.2.5');
        },

        'to an installed location': function(dest) {
          console.log('installed', dest);
          Assert.notEqual(dest.indexOf('/tmp/test-defjs'), -1);
        }
      },

      'can be destroyed': function(cache) {
        cache.destroySync();
      }
    }
  })
  .export(module);