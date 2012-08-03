define(function() {

	function formatPhone(input) {
		return (typeof input === 'string')
			? '+1' + input.replace(/[^\d]/g, '')
			: '';
	}

	function validPhone(input) {
		var phone = formatPhone(input);
		return phone.length == 12 ? phone : null;
	}

	function phoneStatus(input) {
		var phone = validPhone(input);
		return phone
			? 'Valid: ' + phone
			: 'Invalid phone number';
	}

	return {
		formatPhone: formatPhone,
		validPhone: validPhone,
		phoneStatus: phoneStatus
	};
});