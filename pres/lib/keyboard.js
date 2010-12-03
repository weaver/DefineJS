/// keyboard.js - friendly, cross-browser key events
///
/// Copyright (c) 2010, Ben Weaver. All rights reserved.
/// http://github.com/weaver/keyboard.js
///
/// Define a keyboard, bind it to an element, and define keys:
///
///     Keyboard()
///       .bind(document)
///       .define({
///         'Control+Alt+$': function(ev) {
///           alert('Got Control+Alt+$');
///         }
///       });

// Uncomment this line to use without require.js:
// window.Kb = {}; function define(_, fn) { fn(window.Kb); };

define(['exports'], function(exports) {

  exports.Keyboard = Keyboard;
  exports.key = key;
  exports.title = title;
  exports.parse = parse;
  exports.format = format;

  
  // ## Keyboard ##

  // Create a new Keyboard.
  //
  // A Keyboard maps keys to callback functions. A key name has a
  // primary identifier along with modifiers such as Control or Shift.
  //
  //     Keyboard({ 'Alt+Shift+M': function(ev) { ... })).bind(el);
  //
  // The example above creates a keyboard with one key and listens for
  // events on element `el`.
  //
  // Keyboard(keys)
  //
  //   + keys - Map of <key-name, callback> items (optional)
  //
  // Returns a Keyboard instance.
  function Keyboard(keys) {
    if (!(this instanceof Keyboard))
      return new Keyboard(keys);

    var self = this;

    self.trigger = function(ev) {
      var point = name(ev), fn = self.keys[point];
      // console.log('trigger?', ev.type, point, ev, 'need:', modifiers(ev, point), self.keys);
      fn = fn && fn[modifiers(ev, point)];
      return fn ? fn.apply(null, arguments) : true;
    };

    self.clear(keys);
  }

  // Clear all key definitions.
  //
  // + keys - Map of <key-name, callback> items (optional).
  //
  // Returns self.
  Keyboard.prototype.clear = function(keys) {
    this.keys = {};
    keys && this.define(keys);
    return this;
  };

  // Start listening for keyboard events.
  //
  // .bind(el)
  //
  //   + el - Listen on this element.
  //
  // Returns self.
  Keyboard.prototype.bind = function(type, el) {
    if (el === undefined) {
      el = type;
      type = 'keyup';
    }

    bind(el, type, this.trigger);

    return this;
  };

  // Add key definitions to this keyboard.
  //
  // .define(name, callback)
  //
  //   + name - String key name
  //   + callback - Function(Event) callback
  //
  // .define(names)
  //
  //   + names - Map of <key-name, callback> bindings
  //
  // Returns self.
  Keyboard.prototype.define = function(name, fn) {
    if (fn)
      this._def(name, fn);
    else
      for (var n in name)
        this._def(n, name[n]);
    return this;
  };

  Keyboard.prototype._def = function(name, fn) {
    var key = parse(name);
    if (this.keys[key.code] === undefined)
      this.keys[key.code] = {};
    this.keys[key.code][key.mask] = fn;
  };

  
  // ## Events ##

  function bind(el, name, fn) {
    if (document.addEventListener)
      el.addEventListener(name, fn, true);
    else
      el.attachEvent('on' + name, fn);
    return el;
  }

  // Conver a DOM event to a Key.
  function key(ev) {
    var point = name(ev);
    return new Key(modifiers(ev, point), point);
  }

  // Convert a DOM keyboard event into a key identifier.
  function name(ev) {
    var point = ev.key || ev.keyIdentifier || codepoint(ev.keyCode);
    return KEYS[point] || point;
  }

  // Convert a DOM keyboard event into a modifier.
  //
  // If point is a modifier key, remove it from the mask. For example,
  // some browsers will set keyIdentifier='Shift' and shiftKey=true.
  function modifiers(ev, point) {
    return ~(MOD[point] || 0) & (
      (ev.altKey ? MOD.Alt : 0)
      | (ev.shiftKey ? MOD.Shift : 0)
      | (ev.ctrlKey ? MOD.Control : 0)
    );
  }

  
  // ## Key Names ##

  // Normalize a friendly key name by titlecasing names and putting
  // modifiers into a certain order.
  //
  //     title('shift+alt+m') ==> 'Alt+Shit+M'
  //
  // + name - String key name
  //
  // Returns String name or undefined for
  function title(name) {
    return format(parse(name));
  }

  // Parse a friendly key name.
  //
  //     parse('alt+shift+m') ==> { mods: ?, code: ? }
  //
  // + name - String key name
  //
  // Returns Key object.
  function parse(name) {
    var parts = name.toUpperCase().split(/\+/),
        key = parseCode(parts.pop());
    key.mask = parseModifiers(parts, key.mask);
    return key;
  }

  // Convert a Key object to a friendly name.
  //
  // + key - Key object.
  //
  // Returns String name.
  function format(key) {
    var name,
        mask = key.mask,
        parts = [];

    // Check for the case of a named character or space.
    if ((name = CHAR_NAME[key.code])) {
      // Quick check for an exact match.
      if (name[mask] !== undefined)
        return name[mask];
      // Shift is a special case. Fold it away.
      else if ((mask & MOD.Shift) && name[MOD.Shift]) {
        parts.unshift(name[MOD.Shift]);
        mask = mask & ~MOD.Shift;
      }
      // Otherwise, look for a default name.
      else if (name[MOD.None] !== undefined)
        parts.unshift(name[MOD.None]);
    }

    if (parts.length == 0)
      parts.unshift(fromCodePoint(key.code));

    if (parts[0] === undefined)
      throw 'Unrecognized code: "' + key.code + '".';

    if (mask !== 0)
      for (var i = MOD_ORDER.length - 1; i >= 0; i--) {
        name = MOD_ORDER[i];
        if (mask & MOD[name])
          parts.unshift(name);
      }

    return parts.join('+');
  }

  // A Key is a primary code and its modifier mask.
  function Key(mask, code) {
    if (!(this instanceof Key))
      return new Key(mask, code);
    this.mask = mask;
    this.code = code;
  }

  Key.prototype.toString = function() {
    return (this.mask === 0) ? this.code : (this.mask + '|' + this.code);
  };

  Key.prototype.isModifier = function() {
    return this.code in MOD;
  };

  // Convert the character code part of a friendly name to a Key
  // object. Assume `name` is normalized to upper case.
  function parseCode(name) {
    var probe = CHAR[name];
    if (probe === undefined) {
      if (name.length == 1)
        return new Key(0, codePointAt(name, 0));
      else
        throw 'Unrecognized key: "' + name + '".';
    }
    return new Key(probe.mask, KEYS[probe.code] || probe.code);
  }

  // Fold a set of friendly modifier names into a modifier
  // mask. Assume `set` is normalized to upper case.
  function parseModifiers(set, mask) {
    var probe;

    mask = mask || 0;
    for (var i = 0, l = set.length; i < l; i++) {
      probe = MOD[set[i]];
      if (probe === undefined)
        throw 'Unrecognized modifier: "' + set[i] + '".';
      mask |= probe;
    }

    return mask;
  }

  
  // ## Utilities ##

  // Fundamental object iterator.
  //
  // + obj - Object value to iterate over
  // + fn  - Called on each key/value pair.
  //
  // Returns nothing.
  function each(obj, fn) {
    for (var k in obj)
      fn(k, obj[k]);
  }

  function extend(target) {
    var i, l, obj, key;
    for (i = 1, l = arguments.length; i < l; i++) {
      for (key in (obj = arguments[i]))
        target[key] = obj[key];
    }
    return target;
  }

  // Convert an integer to a unicode codepoint.
  //
  //   codepoint(77) ==> 'U+004D'
  //
  // codepoint(n)
  //
  //   + n - Integer value
  //
  // Returns String codepoint.
  var codepoint = (function() {
    var memo = {};
    return function codepoint(n) {
      var point = memo[n];
      if (point === undefined)
        point = memo[n] = 'U+' + zpad(n.toString(16), 4).toUpperCase();
      return point;
    };
  })();

  // Convert a particular character in a string to a codepoint.
  //
  // + s - String value
  // + i - Integer character index in `s`.
  //
  // Returns String codepoint.
  function codePointAt(s, i) {
    return codepoint(s.charCodeAt(i));
  }

  // Convert a codepoint to a character.
  //
  // + point - String codepoint
  //
  // Returns String of length 1 or undefined.
  function fromCodePoint(point) {
    if (typeof point != 'string')
      return undefined;
    else if (point in CHAR)
      return point;
    var probe = (typeof point == 'string') && point.match(/^U\+(.*)$/);
    return probe ? String.fromCharCode(parseInt(probe[1], 16)) : undefined;
  }

  // Pad a string with zeros.
  //
  // + s     - String input
  // + limit - Maximum size of result
  //
  // Returns String padded result.
  function zpad(s, limit) {
    while (s.length < limit)
      s = '0' + s;
    return s;
  }

  
  // ## Key Values ##

  // See also:
  //   http://www.w3.org/TR/DOM-Level-3-Events/#events-KeyboardEvent-key
  //   http://unixpapa.com/js/key.html

  // Modifier Keys
  var MOD = { None: 0, Alt: 1, Control: 2, Shift: 4, Meta: 8 },
      MOD_ORDER = ['Control', 'Alt', 'Shift', 'Meta'];

  each(MOD, function(name, mask) {
    MOD[name.toUpperCase()] = mask;
  });

  // Special keys (see DOM3 Events for table of names).
  var KEYS = {
    'U+0008': 'Backspace',
    'U+0009': 'Tab',
    'U+000D': 'Enter',
    'U+0010': 'Shift',
    'U+0011': 'Control',
    'U+0012': 'Alt',
    'U+0014': 'CapsLock',
    'U+001B': 'Esc',
    'U+0020': 'Spacebar',
    'U+0021': 'PageUp',
    'U+0022': 'PageDown',
    'U+0023': 'End',
    'U+0024': 'Home',
    'U+0025': 'Left',
    'U+0026': 'Up',
    'U+0027': 'Right',
    'U+0028': 'Down',
    'U+002E': 'Del'
  };

  var CHAR_NAME = {},
      CHAR = {
        // Secondary "special key" mappings.
        'Return': Key(MOD.None, 'U+000D'),

        // Cross-browser troublesome keys.
        '!': Key(MOD.Shift, 'U+0031'),
        '@': Key(MOD.Shift, 'U+0032'),
        '#': Key(MOD.Shift, 'U+0033'),
        '$': Key(MOD.Shift, 'U+0034'),
        '%': Key(MOD.Shift, 'U+0035'),
        '^': Key(MOD.Shift, 'U+0036'),
        '&': Key(MOD.Shift, 'U+0037'),
        '*': Key(MOD.Shift, 'U+0038'),
        '(': Key(MOD.Shift, 'U+0039'),
        ')': Key(MOD.Shift, 'U+0030')
      },
      OVERRIDE = {
        'Plus': Key(MOD.Shift, 'U+003D')
      };

  var agent = navigator.userAgent;

  if (/chrome|msie/i.test(agent)) {
    // Chrome and MSIE Verified:
    // Mozilla/5.0 (X11; U; Linux x86_64; en-US) AppleWebKit/534.7 (KHTML, like Gecko) Chrome/7.0.517.41 Safari/534.7
    // Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; WOW64; Trident/4.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C)
    // Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 5.2; Trident/4.0; GTB6; .NET CLR 1.1.4322; .NET CLR 2.0.50727; .NET CLR 3.0.04506.30; .NET CLR 3.0.04506.648; .NET CLR 3.5.21022; MS-RTC LM 8; .NET CLR 3.0.4506.2152; .NET CLR 3.5.30729)
    extend(CHAR, {
      ';': Key(MOD.None, 'U+00BA'),
      ':': Key(MOD.Shift, 'U+00BA'),
      '=': Key(MOD.None, 'U+00BB'),
      '+': Key(MOD.Shift, 'U+00BB'),
      ',': Key(MOD.None, 'U+00BC'),
      '<': Key(MOD.Shift, 'U+00BC'),
      '-': Key(MOD.None, 'U+00BD'),
      '_': Key(MOD.Shift, 'U+00BD'),
      '.': Key(MOD.None, 'U+00BE'),
      '>': Key(MOD.Shift, 'U+00BE'),
      '/': Key(MOD.None, 'U+00BF'),
      '?': Key(MOD.Shift, 'U+00BF'),
      '`': Key(MOD.None, 'U+00C0'),
      '~': Key(MOD.Shift, 'U+00C0'),
      '[': Key(MOD.None, 'U+00DB'),
      '{': Key(MOD.Shift, 'U+00DB'),
      '\\': Key(MOD.None, 'U+00DC'),
      '|': Key(MOD.Shift, 'U+00DC'),
      ']': Key(MOD.None, 'U+00DD'),
      '}': Key(MOD.Shift, 'U+00DD'),
      "'": Key(MOD.None, 'U+00DE'),
      '"': Key(MOD.Shift, 'U+00DE')
    });
  }
  else {
    // FireFox Verified:
    // Mozilla/5.0 (X11; U; Linux x86_64; en-US; rv:1.9.2.11) Gecko/20101019 Firefox/3.6.11
    extend(CHAR, {
      ';': Key(MOD.None, 'U+003B'),
      ':': Key(MOD.Shift, 'U+003B'),
      '=': Key(MOD.None, 'U+003D'),
      '+': Key(MOD.Shift, 'U+003D'),
      ',': Key(MOD.None, 'U+00BC'),
      '<': Key(MOD.Shift, 'U+00BC'),
      '-': Key(MOD.None, 'U+006D'),
      '_': Key(MOD.Shift, 'U+006D'),
      '.': Key(MOD.None, 'U+00BE'),
      '>': Key(MOD.Shift, 'U+00BE'),
      '/': Key(MOD.None, 'U+00BF'),
      '?': Key(MOD.Shift, 'U+00BF'),
      '`': Key(MOD.None, 'U+00C0'),
      '~': Key(MOD.Shift, 'U+00C0'),
      '[': Key(MOD.None, 'U+00DB'),
      '{': Key(MOD.Shift, 'U+00DB'),
      '\\': Key(MOD.None, 'U+00DC'),
      '|': Key(MOD.Shift, 'U+00DC'),
      ']': Key(MOD.None, 'U+00DD'),
      '}': Key(MOD.Shift, 'U+00DD'),
      "'": Key(MOD.None, 'U+00DE'),
      '"': Key(MOD.Shift, 'U+00DE')
    });
  }

  function register(name, key) {
    if (CHAR_NAME[key.code] === undefined)
      CHAR_NAME[key.code] = {};
    CHAR_NAME[key.code][key.mask] = name;
    CHAR[name.toUpperCase()] = key;
  }

  each(CHAR, register);
  each(OVERRIDE, register);
  each(KEYS, function(code, name) {
    register(name, CHAR[name] = Key(0, code));
  });

});