// # file.js #
//
// Convenient wrapper around a path.

var Sys = require('sys'),
    Fs = require('fs'),
    Path = require('path'),
    Child = require('child_process'),
    U = require('./util');

exports.mimetype = mimetype;
exports.extname = extname;
exports.File = File;
exports.Temporary = Temporary;


// ## Mime Type ##

// Determine the mimetype of a file.
//
// Register addition mimetypes for filename extensions like this:
//
//     mimetype.def({
//       '.ext': 'mime/type',
//       ...
//     });
//
// mimetype(file, next)
//
// + file - String filename
// + next - Function(Error, String) callback
//
// Returns String mimetype or undefined.
var mimetype = exports.mimetype = (function() {
  var types = {};

  function mimetype(file, next) {
    var mime = types[extname(file)];
    if (mime)
      next(null, mime);
    else
      fileMimeType(file, next);
  }

  mimetype.def = function(items) {
    U.extend(types, items);
    return this;
  };

  return mimetype;
})();

mimetype.def({
  '.zip': 'application/zip',
  '.tgz': 'application/x-tar-gz',
  '.tar.gz': 'application/x-tar-gz'
});


// ## Files ##

function File(path, mime, ctor) {
  ctor = ctor || File;

  if (path instanceof File)
    return path;

  if (!(this instanceof File))
    return new ctor(path, mime, ctor);

  this.path = path;
  this.mime = mime;
  this.ctor = ctor;
}

File.prototype.toString = function() {
  return '#<File ' + this.path + '>';
};

File.prototype.mimetype = function(next) {
  var self = this;

  if (typeof next == 'string')
    this.mime = next;
  else if (this.mime)
    next.call(this, null, this.mime);
  else
    mimetype(this.path, function(err, mime) {
      next.call(self, err, self.mime = mime);
    });

  return this;
};

File.prototype.open = function(opt, next) {
  if (arguments.length < 2) {
    next = opt;
    opt = {};
  }

  var method = (opt.flags == 'w') ? Fs.createWriteStream : Fs.createReadStream,
      stream = method(this.path, opt);

  next.call(this, null, stream, this);
  return this;
};

File.prototype.done = function(next) {
  next && next.call(this, null);
  return this;
};

File.prototype.tempName = function(prefix, suffix) {
  return Path.join(this.path, U.tempname(prefix, suffix));
};

File.prototype.tempFile = function(opt, next) {
  if (arguments.length < 2) {
    next = opt;
    opt = {};
  }

  opt.flags = 'w';
  (new Temporary(this.tempName(opt.prefix, opt.suffix))).open(opt, next);

  return this;
};

File.prototype.tempFolder = function(next) {
  var self = this,
      name = this.tempName();

  mkdirs(name, function(err) {
    err ? next.call(self,err) :
      next.call(self, null, new Temporary(name, 'application/x-directory'));
  });

  return this;
};

File.prototype.isTemporary = function() {
  return (this instanceof Temporary);
};

File.prototype.isFolder = function(next) {
  return this.stat(function(err, stats) {
    err ? next(false) : next(stats.isDirectory());
  });
};

File.prototype.isFile = function(next) {
  return this.stat(function(err, stats) {
    err ? next(false) : next(stats.isFile());
  });
};

File.prototype.only = function(next) {
  var self = this;

  this.readdir(function(err, files) {
    if (err)
      next.call(self, err);
    else if (files.length != 1)
      next.call(self, new Error('Expected one item in ' + self + ', not ' + files.length + '.'));
    else
      next.call(self, null, files[0]);
  });

  return this;
};

File.prototype.onlyFolder = function(next) {
  var self = this;

  this.only(function(err, file) {
    err ? next.call(self, err) : check(file);
  });

  function check(file) {
    file.isFolder(function(yup) {
      yup ? next.call(self, null, file) :
        next.call(self, new Error('Expected folder: ' + file));
    });
  }

  return this;
};

File.prototype.onlyFile = function(next) {
  var self = this;

  this.only(function(err, file) {
    err ? next.call(self, err) : check(file);
  });

  function check(file) {
    file.isFile(function(yup) {
      yup ? next.call(self, null, file) :
        next.call(self, new Error('Expected file: ' + file));
    });
  }

  return this;
};

File.prototype.join = function(path) {
  return new this.ctor(Path.join(this.path, path));
};

File.prototype.basename = function() {
  return Path.basename(this.path);
};

File.prototype.dirname = function() {
  return Path.dirname(this.path);
};

File.prototype.exists = function(next) {
  Path.exists(this.path, next);
  return this;
};

File.prototype.hasFile = function(name, next) {
  Path.exists(Path.join(this.path, name), next);
  return this;
};

File.prototype.mkdirs = function(next) {
  mkdirs(this.path, next);
  return this;
};

File.prototype.destroy = function(next) {
  rm(this.path, next);
  return this;
};

File.prototype.stat = function(next) {
  var self = this;

  if (!next)
    return Fs.statSync(this.path);
  else
    Fs.stat(this.path, function(err, stats) {
      next.call(self, err, stats);
    });

  return this;
};

File.prototype.symlink = function(dest, next) {
  var self = this;

  if (!next) {
    Fs.symlinkSync(this.path, dest);
    return self.ctor(dest);
  }

  Fs.symlink(this.path, dest, function(err) {
    err ? next.call(self, err) :
      next.call(self, null, self.ctor(dest));
  });

  return this;
};

File.prototype.readdir = function(next) {
  var self = this;

  function join(name) {
    return self.join(name);
  }

  if (!next)
    return Fs.readdirSync(this.path).map(join);

  Fs.readdir(this.path, function(err, files) {
    err ? next.call(self, err) :
      next.call(self, err, files.map(join));
  });

  return this;
};

File.prototype.rename = function(dest, next) {
  var self = this;

  if (!next) {
    Fs.renameSync(this.path, dest);
    return self.ctor(dest);
  }

  Fs.rename(this.path, dest, function(err) {
    err ? next.call(self, err) :
      next.call(self, null, self.ctor(dest));
  });

  return this;
};

File.prototype.digest = function(method, none, next) {
  var self = this;

  if (typeof none == 'function') {
    next = none;
    none = undefined;
  }

  if (!next)
    return U.digestSync(this.path, method, none);
  else
    U.digest(this.path, method, none, function(err, hash) {
      next.call(self, err, hash);
    });

  return this;
};

File.prototype.load = function(method, opt, next) {
  var self = this;

  if (typeof opt == 'function') {
    next = opt;
    opt = undefined;
  }

  if (!next)
    return U.loadSync(this.path, method, opt);
  else
    U.load(this.path, method, opt, function(err, obj) {
      next.call(self, err, obj);
    });

  return this;
};

File.prototype.loadJSON = function(none, next) {
  var opt = { encoding: 'utf-8' };

  if (typeof none == 'function')
    next = none;
  else
    opt.none = none;

  return this.load(U.parseJSON, opt, next);
};

File.prototype.dump = function(method, val, opt, next) {
  var self = this;

  if (typeof opt == 'function') {
    next = opt;
    opt = undefined;
  }

  if (!next)
    return U.dumpSync(method, this.path, val, opt);
  else
    U.dump(method, this.path, val, opt, function(err) {
      next.call(self, err);
    });

  return this;
};

File.prototype.dumpJSON = function(val, opt, next) {
  return this.dump(U.stringifyJSON, val, opt, next);
};

Sys.inherits(Temporary, File);
function Temporary(path, mime, ctor) {
  return File.call(this, path, mime, ctor || Temporary);
}

Temporary.prototype.toString = function() {
  return '#<Temporary ' + this.path + '>';
};

Temporary.prototype.done = function(next) {
  return this.destroy(next || function(err) { if (err) throw err; });
};


// ## Helpers ##

function extname(file) {
  var ext = Path.extname(file);
  if (ext == '.gz')
    ext = Path.extname(file.substr(0, file.length - ext.length)) + ext;
  return ext;
}


// ## External Utilities ##

// Use the `file` command to determine a mime type.
function fileMimeType(file, next) {
  var proc = Child.spawn('file', ['-i', file]);

  U.capture(proc.stdout, 'ascii', function(err, output) {
    err ? next(err) : match(output);
  });

  // output = "filename.ext: mime/type; charset=encoding"
  function match(output) {
    var probe = output.match(/^.*\:\s+([^\s;]+\/[^\s;]+)/);
    if (probe)
      next(null, probe[1]);
    else if (output)
      next(new Error(output));
    else
      next(new Error('Empty: `file -i ' + file + '`.'));
  }
}

function mkdirs(path, next) {
  return next ? U.must('mkdir', ['-p', path], next) :
    U.mustSync('mkdir', '-p', path);
}

function rm(path, next) {
  return next ? U.must('rm', ['-rf', path], next) :
    U.mustSync('rm', '-rf', path);
}
