const path = require('path');

module.exports = function (api) {
  api.cache(true);

  const presets = [];

  return {
    presets,
    plugins: [path.resolve(__dirname, './plugin.js')],
  };
};
