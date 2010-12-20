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
  return EXACT.test(ver);
}

function isAny(constraint) {
  return /^\s*\*?\s*$/.test(constraint);
}


// ## SemVer ##

var EXACT = /^\s*v?(\d+)\.(\d+)\.(\d+)([A-Za-z\-][0-9A-Za-z\-]*)?\s*$/,
    SEMVER = /^\s*v?(\d+)(?:\.(\d+)(?:\.(\d+)([A-Za-z\-][0-9A-Za-z\-]*)?)?)?\s*$/,
    BUILD = /^\-(\d+)$/,
    Inf = Number.POSITIVE_INFINITY;

function parse(ver, exact) {
  var semver = ver.match(exact === false ? SEMVER : EXACT);
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
  this.major = parseInt(x);
  this.minor = y && parseInt(y);
  this.patch = z && parseInt(z);
  this.build = build && parseInt(build);
  this.special = special;
}

SemVer.prototype.toString = function() {
  return '<SemVer ' + format(this) + '>';
};

SemVer.prototype.format = function() {
  return (
    this.major
    + (this.minor   !== undefined ? '.' + this.minor : '')
    + (this.patch   !== undefined ? '.' + this.patch : '')
    + (this.special !== undefined ? this.special     : '')
    + (this.build   !== undefined ? '-' + this.build : '')
  );
};

// Note: wildcarding the minor and patch components makes this method
// more complex. If it gets any more out-of-hand, consider
// implementing a separate `match()` method for use in the `Cmp`
// constraint matching.
SemVer.prototype.cmp = function(other) {
  return (
    // The major version must exist.
    (this.major - other.major)

    // The minor and patch versions may not exist if this is a partial
    // SemVer. In that case, compare undefined components as
    // wildcards.
    || cmpUndef(this.minor, other.minor)
    || cmpUndef(this.patch, other.patch)

    // The build component is non-standard. Since its usually missing,
    // don't compare it as a wildcard. Assume missing values are zero:
    //
    //     1.2.3  <==>  1.2.3-0
    || cmpZero(this.build, other.build)

    // Special values are usually missing. If special values exist,
    // they're compared lexicographically. A missing special value is
    // always greater than a defined special value because:
    //
    //     1.0.0beta1 < 1.0.0
    || cmpSpecial(this.special, other.special));
};

function cmpUndef(a, b) {
  if (a === undefined || b === undefined)
    return 0;
  else
    return (a - b);
}

function cmpZero(a, b) {
  return (a || 0) - (b || 0);
}

function cmpSpecial(a, b) {
  if (a == b)
    return 0;
  else if (a && b)
    return (a < b) ? -1 : 1;
  else
    return a ? -1 : 1;
}


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
  return new Cmp(this.option(_cmpOp, '='), this.produce(_version));
}

function _version() {
  return parse(this.match(/^[\w\.\-]+/), false);
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
