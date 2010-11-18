define(['sys', './a', './b', 'utils'], function(sys, A, B, Utils) {
  console.log('A: ' + sys.inspect(A));
  console.log('B: ' + sys.inspect(B));
  console.log('Lazy: ' + sys.inspect(Utils));
});