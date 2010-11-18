var _defjs = require('../build/default/_defjs');

exports.spawnSync = spawnSync;

function spawnSync(command, args, options) {
  var cwd = (options && options.cwd) || "",
      env = (options && options.env) || process.env,
      envList = [];

  for (var key in env)
    envList.push(key + '=' + env[key]);

  return _defjs.spawnSync(command, args, cwd, envList);
}