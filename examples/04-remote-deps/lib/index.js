define(['sys', './a', 'common-js/lazy-array', 'sqlite', 'express'],
function(sys, A, Lazy, sqlite, express) {
  console.log('A: ' + sys.inspect(A));
  console.log('Lazy: ' + sys.inspect(Lazy));
});