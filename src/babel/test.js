const babel = require('@babel/core');
const babelParser = require('@babel/parser');
const path = require('path');
const fs = require('fs');

async function transformCode(code) {
  const ret = babelParser.parse(code, {
    sourceType: 'unambiguous',
    presets: ['@babel/preset-env'],
    plugins: [
      '@babel/plugin-transform-typescript',
      // '@babel/plugin-transform-react-jsx',
      'jsx',
      'flow',
    ],
  });
  return new Promise((resolve, reject) => {
    babel.transformFromAst(
      ret,
      null,
      {
        // babelrc: true,
        sourceType: 'unambiguous',
        configFile: './.babelrc.js',
        // presets:["@babel/preset-env"],
        plugins: [
          // '@babel/plugin-transform-typescript',
          // '@babel/plugin-transform-react-jsx',
        ],
      },
      (err, result) => {
        if (err) {
          reject(err);
        }
        resolve(result.code);
      },
    );
  });
}

function main() {
  const code = `
  const a:string='a';
  const div=<a>link</a>;
  `;
  const txt = fs.readFileSync(path.resolve(__dirname, './App.tsx')).toString();
  transformCode(txt).then(res => {
    console.log(res);
  });
}

main();
