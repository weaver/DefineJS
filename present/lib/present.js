define(['exports', './keyboard'], function(exports, Kb) {

  exports.create = function(selector) {
    $(selector).each(Present);
  };

  function Present() {
    var pres = $(this),
        slides = pres.find('.slide'),
        index;

    // Initial State

    select(slides.eq(index = 0));

    // UI Interaction

    Kb.Keyboard()
      .bind('keydown', document)
      .define({
        'Spacebar': next,
        'Shift+Spacebar': prev,
        'Left': prev,
        'Right': next,
        'Shift+Left': home,
        'Shift+Right': last
      });

    $(document).click(function(ev) {
      // Be conservative about the mouse. Someone may have clicked on
      // a button or link.
      if ($(ev.target).is('html, .slide'))
        return ev.shiftKey ? prev() : next();
      return true;
    });

    // Methods

    function next() {
      return jump(index + 1);
    }

    function prev() {
      return jump(index - 1);
    }

    function home() {
      return jump(0);
    }

    function last() {
      return jump(slides.length - 1);
    }

    function jump(where) {
      console.debug('jump!', where, index, slides.length);
      if (where < 0 || where >= slides.length || where == index)
        return false;

      deselect(slides.eq(index));
      select(slides.eq(index = where));
      return false;
    }

    function select(slide) {
      return slide.addClass('active').show();
    }

    function deselect(slide) {
      return slide.removeClass('active').hide();
    }
  }

});