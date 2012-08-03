define(['jquery', './validate'], function($, Validate) {

	$(function() {
		$('form').submit(onSubmit);
	});

	function onSubmit(ev) {
		ev.preventDefault();

		var phone = $('[name=phone]', this).val();
		$('.status').text(Validate.phoneStatus(phone));
	}
});