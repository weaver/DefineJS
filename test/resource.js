var Cache = require('../lib/resource').Cache,
    cache = new Cache('/tmp/test-defjs');

function resolve(uri) {
  console.log('resolved %s => %s', uri, cache.resolveSync(uri));
}

cache.destroySync();
resolve('/tmp');
resolve(__dirname + '/some-package.zip');
resolve('http://github.com/kriszyp/commonjs-utils/zipball/master');
