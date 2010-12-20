// Semantic Versions -- http://semver.org/

var ReParse = require('../ext/reparse').ReParse;

exports.isSemVer = isSemVer;
exports.isExact = isExact;
exports.parse = parse;
exports.format = format;
exports.cmp = cmp;
exports.isAny = isAny;
exports.satisfy = satisfy;
exports.parseConstraint = parseConstraint;


// ## Predicates ##

function isSemVer(ver) {
  return SEMVER.test(ver);
}

function isExact(ver) {
  return /^\s*v?\d+\.\d+\.\d+([A-Za-z][0-9A-Za-z\-]*)?\s*$/.test(ver);
}

function isAny(constraint) {
  return /^\s*\*?\s*$/.test(constraint);
}


// ## SemVer ##

var SEMVER = /^\s*v?(\d+)(?:\.(\d+)(?:\.(\d+)([A-Za-z\-][0-9A-Za-z\-]*)?)?)?\s*$/,
    BUILD = /^\-(\d+)$/;

function parse(ver) {
  var semver = ver.match(SEMVER);
  if (!semver)
    throw new Error('Invalid SemVer: `' + ver + '`.');

  // NPM extends the SemVer spec by allowing a hyphen followed by
  // digits to indicate a build number. Build numbers are sorted
  // differently than special.
  var special = semver[4],
      probe = special && special.match(BUILD),
      build;

  if (probe) {
    special = undefined;
    build = probe[1];
  }

  return new SemVer(semver[1], semver[2], semver[3], special, build);
}

function format(obj) {
  return obj.format();
}

function cmp(a, b) {
  return a.cmp(b);
}

function SemVer(x, y, z, special, build) {
  this.major = parseInt(x || 0);
  this.minor = parseInt(y || 0);
  this.patch = parseInt(z || 0);
  this.build = parseInt(build || 0);
  this.special = special || '';
}

SemVer.prototype.toString = function() {
  return '<SemVer ' + format(this) + '>';
};

SemVer.prototype.format = function() {
  return (
    (this.major || '0') + '.'
    + (this.minor || '0') + '.'
    + (this.patch || '0')
    + (this.special || '')
    + (this.build ? '-' + this.build : '')
  );
};

SemVer.prototype.cmp = function(other) {
  var diff = (
    (this.major - other.major)
    || (this.minor - other.minor)
    || (this.patch - other.patch)
    || (this.build - other.build));

  if (diff != 0)
    return diff;
  else if (this.special && other.special) {
    if (this.special < other.special)
      return -1;
    else if (this.special > other.special)
      return 1;
  }
  else if (this.special)
    return -1;
  else if (other.special)
    return 1;

  return 0;
};


// ## Constraints ##

function satisfy(constraint, versions, otherwise) {
  var probe;

  constraint = parseConstraint(constraint);
  versions = versions.map(parse).sort(cmp);

  for (var i = versions.length - 1; i >= 0; i--) {
    if (constraint.match(probe = versions[i]))
      return probe;
  }

  return otherwise;
}

// ## Constraint Parser ##

// This constraint grammar is derived from NPM's documentation of the
// `dependency` property (see NPM/doc/json.md).

function parseConstraint(constraint) {
  return (new ReParse(constraint, true)).start(_alternatives);
}

// ### Grammar ###
//
//     start        ::= alternatives
//     alternatives ::= alternative '||' constraints | constraints
//     constraints  ::= constraints ' ' constraint | constraint
//     constraint   ::= '*' || range || match
//     range        ::= version ' - ' version
//     match        ::= op? version
//     version      ::= (letter | number | '.' | '-')+
//     op           ::= '=' | '<' || '>' || '<=' || '>='

function _alternatives() {
  return this.chainl(_constraints, _orOp);
}

function _constraints() {
  return new And(this.many(_constraint));
}

function _constraint() {
  return this.choice(_anything, _range, _match);
}

function _anything() {
  this.match(/^\*/);
  return new Any();
}

function _range() {
  var probe = this.seq(_version, /^\-/, _version),
      lo = new Cmp('>=', probe[1]),
      hi = new Cmp('<=', probe[3]);

  return new And([lo, hi]);
}

function _match() {
  var op = this.option(_cmpOp, '=');

  return new Cmp(op, this.produce(_version));
}

function _version() {
  return parse(this.match(/^[\w\.\-]+/));
}

function _orOp() {
  this.match(/^\|\|/);
  return function reduceOr(a, b) {
    return (a instanceof Or) ? a.add(b) : new Or([a, b]);
  };
}

function _cmpOp() {
  return this.match(/^(>=|<=|>|<|=)/);
}

// ### Constraint AST ###

// An AST models a parsed constraint expression. Each AST node
// implements a `match` method that returns true if a SemVer matches
// or false otherwise.

// Match anything.
function Any() {
}

Any.prototype.toString = function() {
  return '<Any *>';
};

Any.prototype.match = function(semver) {
  return true;
};

// Match using a comparison operator.
function Cmp(op, semver) {
  this.semver = semver;
  this.opName = op;
  if (!(this.op = this.ops[op]))
    throw new Error('Unrecognized operator: `' + op + '`.');
}

Cmp.prototype.toString = function() {
  return '#(Cmp `' + this.opName + '` ' + format(this.semver) + ')';
};

Cmp.prototype.match = function(semver) {
  return this.op(semver, this.semver);
};

Cmp.prototype.ops = {
  '=': function(a, b) { return cmp(a, b) === 0; },
  '>': function(a, b) { return cmp(a, b) > 0; },
  '<': function(a, b) { return cmp(a, b) < 0; },
  '>=': function(a, b) { return cmp(a, b) >= 0; },
  '<=': function(a, b) { return cmp(a, b) <= 0; }
};

// Every constraint must match.
function And(list) {
  if (list.length == 0)
    return new Any();
  else if (list.length == 1)
    return list[0];

  this.list = list;
}

And.prototype.toString = function() {
  return '#(And ' + this.list.join(' ') + ')';
};

And.prototype.match = function(semver) {
  for (var i = 0, l = this.list.length; i < l; i++) {
    if (!this.list[i].match(semver))
      return false;
  }
  return true;
};

// At least on constraint must match.
function Or(list) {
  if (list.length == 0)
    return new Any();
  else if (list.length == 1)
    return list[0];

  this.list = list;
}

Or.prototype.toString = function() {
  return '#(Or ' + this.list.join(' ') + ')';
};

Or.prototype.add = function(match) {
  this.list.push(match);
  return this;
};

Or.prototype.match = function(semver) {
  for (var i = 0, l = this.list.length; i < l; i++) {
    if (this.list[i].match(semver))
      return true;
  }
  return false;
};
