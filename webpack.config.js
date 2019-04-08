const path = require('path');
const fs = require('fs');

SASS_SRC_DIR = './src/client/styles/';
const sassSrcFiles = fs.readdirSync(SASS_SRC_DIR)
                       .filter(name => name.match(/^[^_].*\.scss$/))
                       .map(name => SASS_SRC_DIR + name);

module.exports = [{
  target: "web",
  mode: 'development',
  entry: sassSrcFiles.concat([
    './src/client/main.js',
  ]),
  output: {
    path: path.resolve(__dirname, 'dist', 'client'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'file-loader',
            options: { name: 'css/[name].css' }
          },
          { loader: 'sass-loader' },
        ]
      }
    ]
  },
//}, {
//  target: "node",
//  mode: 'development',
//  entry: [
//    './src/server/index.js'
//  ],
//  output: {
//    path: path.resolve(__dirname, 'dist', 'server'),
//    filename: 'bundle.js'
//  },
//  module: {
//    rules: [
//      {
//        test: /\.js$/,
//        exclude: /node_modules/,
//        use: 'babel-loader'
//      }
//    ]
//  },
//  externals: {
//      uws: "uws"
//  },
}]
