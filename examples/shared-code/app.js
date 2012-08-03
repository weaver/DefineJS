var express = require('express'),
	define = require('define'),
	validate = require('./public/js/validate');

var app = express()
	.use(express.static(__dirname + '/public'))
	.use(express.bodyParser());

app.get('/', function(req, res) {
	res.render('index.jade', {
		phone: '',
		status: 'Try validating a phone number...'
	});
});

app.post('/', function(req, res) {
	var phone = req.body.phone;

	res.render('index.jade', {
		phone: phone,
		status: validate.phoneStatus(phone)
	});
});

app.listen(3000);