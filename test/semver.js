var vows = require('vows'),
    assert = require('assert'),
    SemVer = require('../lib/semver');

vows.describe('SemVer')
  .addBatch({
    'in general': {
      topic: '1.0.2',

      'is parsed into its components': function(topic) {
        var semver = parsedEqual(topic, '<SemVer 1.0.2>');
        assert.equal(semver.major, 1);
        assert.equal(semver.minor, 0);
        assert.equal(semver.patch, 2);
        assert.equal(semver.build, 0);
        assert.equal(semver.special, '');
      },

      'may be compared to others': function(topic) {
        var semver = SemVer.parse(topic);
        assert.equal(SemVer.cmp(semver, SemVer.parse('v1.0.2')), 0);
        assert.ok(SemVer.cmp(semver, SemVer.parse('v0.9.9')) > 0);
        assert.ok(SemVer.cmp(semver, SemVer.parse('2')) < 0);
      },

      'can be tested': function(topic) {
        assert.isTrue(SemVer.isSemVer(topic));
      },

      'can be tested for exactness': function(topic) {
        assert.isTrue(SemVer.isExact(topic));
      }
    },

    'a partial version': {
      topic: '1.23',

      'is a SemVer': function(topic) {
        assert.isTrue(SemVer.isSemVer(topic));
      },

      'is not exact': function(topic) {
        assert.isFalse(SemVer.isExact(topic));
      },

      'has missing components filled with zeros': function(topic) {
        parsedEqual(topic, '<SemVer 1.23.0>');
      }
    },

    'when a version starts with "v"': {
      topic: 'v1.0',

      'it is a SemVer': function(topic) {
        assert.isTrue(SemVer.isSemVer(topic));
      },

      'the "v" is ignored': function(topic) {
        parsedEqual(topic, '<SemVer 1.0.0>');
      }
    },

    'special information': {
      topic: function() { return SemVer.parse('21.0.2beta3'); },

      'is captured as text': function(topic) {
        assert.equal(topic.special, 'beta3');
        assert.equal(topic.toString(), '<SemVer 21.0.2beta3>');
      },

      'is sorted lexicographically': function(topic) {
        assert.equal(SemVer.cmp(topic, SemVer.parse('21.0.2beta3')), 0);
        assert.ok(SemVer.cmp(topic, SemVer.parse('21.0.2beta1')) > 0);
        assert.ok(SemVer.cmp(topic, SemVer.parse('21.0.2beta4')) < 0);
        assert.ok(SemVer.cmp(topic, SemVer.parse('21')) > 0);
        assert.ok(SemVer.cmp(topic, SemVer.parse('21.0.2')) < 0);
      }
   },

    'except for build numbers': {
      topic: function() { return SemVer.parse('1.2.5-71'); },

      "which are a special case": function(topic) {
        assert.equal(topic.special, '');
        assert.equal(topic.build, 71);
        assert.equal(topic.toString(), '<SemVer 1.2.5-71>');
      },

      'are sorted as a fourth numeric component': function(topic) {
        assert.equal(SemVer.cmp(topic, SemVer.parse('1.2.5-71')), 0);
        assert.ok(SemVer.cmp(topic, SemVer.parse('1.2.5-6')) > 0);
        assert.ok(SemVer.cmp(topic, SemVer.parse('1.2.5-101')) < 0);
        assert.ok(SemVer.cmp(topic, SemVer.parse('1.2.4')) > 0);
        assert.ok(SemVer.cmp(topic, SemVer.parse('1.5')) < 0);
        assert.ok(SemVer.cmp(topic, SemVer.parse('1.2.5beta1')) > 0);
      }
    },

    'since versions can be compared': {
      topic: function() { return ['1.0', '0.9.1', '0.9.1beta3'].map(SemVer.parse); },

      'lists of them can be sorted': function(topic) {
        assert.deepEqual(
          topic.sort(SemVer.cmp).map(SemVer.format),
          ['0.9.1beta3', '0.9.1', '1.0.0']
        );
      }
    }
  })
  .addBatch({
    'a constraint expression may include': {
      topic: ['0.9.1', '0.7.2', '1.2.3', '1.2.3-4'],

      'exact': function(topic) {
        satisfy('1.2.3-4', topic, '<SemVer 1.2.3-4>');
        satisfy('1.5.0', topic, undefined);
      },

      'equality': function(topic) {
        satisfy('=1.2.3', topic, '<SemVer 1.2.3>');
      },

      'greater than': function(topic) {
        satisfy('>0.9.0', topic, '<SemVer 1.2.3-4>');
      },

      'less than': function(topic) {
        satisfy('<1.0.0', topic, '<SemVer 0.9.1>');
      },

      'greater than or equal': function(topic) {
        satisfy('>=1.0.0', topic, '<SemVer 1.2.3-4>');
      },

      'less than or equal': function(topic) {
        satisfy('<=0.9.0', topic, '<SemVer 0.7.2>');
        satisfy('<=0.9.1', topic, '<SemVer 0.9.1>');
      },

      'anything': function(topic) {
        satisfy('*', topic, '<SemVer 1.2.3-4>');
        satisfy('', topic, '<SemVer 1.2.3-4>');
      },

      'a range': function(topic) {
        satisfy('0.8.0 - 1.0.0', topic, '<SemVer 0.9.1>');
      },

      'logical ORs': function(topic) {
        satisfy('<0.5.0 || >=0.8.0 <1.0.0 || >=2.0.0', topic, '<SemVer 0.9.1>');
      }
    },

    'parsed constraint expressions': {
      topic: SemVer.parseConstraint('<0.5.0 || >=0.8.0 <1.0.0 || >=2.0.0'),

      'produce AST nodes': function(topic) {
        assert.equal(
          '#(Or #(Cmp `<` 0.5.0) #(And #(Cmp `>=` 0.8.0) #(Cmp `<` 1.0.0)) #(Cmp `>=` 2.0.0))',
          topic.toString());
      },

      'can match a SemVer': function(topic) {
        assert.isTrue(topic.match(SemVer.parse('2.1.3')));
        assert.isFalse(topic.match(SemVer.parse('0.7.2')));
      }
    }
  })
  .export(module);

function parsedEqual(ver, repr) {
  var semver = SemVer.parse(ver);
  assert.equal(semver.toString(), repr);
  return semver;
}

function satisfy(constraint, versions, expect) {
  var probe = SemVer.satisfy(constraint, versions);
  assert.equal(probe && probe.toString(), expect);
  return constraint;
}