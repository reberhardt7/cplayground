const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

// We need to enumerate all sass files because we aren't importing the sass
// files from the Javascript (and therefore Webpack doesn't know about them
// unless they're explicitly declared as entrypoints).
SASS_SRC_DIR = './src/client/styles/';
const sassSrcFiles = fs.readdirSync(SASS_SRC_DIR)
                       .filter(name => name.match(/^[^_].*\.scss$/))
                       .map(name => SASS_SRC_DIR + name);

module.exports = [{
  target: "web",
  mode: 'development',
  devtool: 'source-map',
  entry: sassSrcFiles.concat([
    './src/client/main.tsx',
  ]),
  output: {
    path: path.resolve(__dirname, 'dist', 'client'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.js(x?)$/,
        exclude: /node_modules/,
        use: ['babel-loader', 'eslint-loader'],
      }, {
        test: /\.ts(x?)$/,
        exclude: /node_modules/,
        use: ['ts-loader', 'eslint-loader'],
      }, {
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
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
  ],
  devServer: {
    contentBase: './dist',
    hot: true,
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
