// This Hello World server is translated from the example on the
// Express homepage. See: http://expressjs.com/

define(['express'], function(express) {
  var app = express.createServer();

  app.get('/', function(req, res){
    res.send('Hello World');
  });

  app.listen(3000);
  console.log('Listening on <http://localhost:3000/>');
});
