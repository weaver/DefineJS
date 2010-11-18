define(['sys', './a', 'common-js/lazy-array'],
function(sys, A, Lazy) {
  console.log('A: ' + sys.inspect(A));
  console.log('Lazy: ' + sys.inspect(Lazy));
});