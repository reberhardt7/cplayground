const path = require('path');

module.exports = [{
  target: "web",
  mode: 'development',
  entry: [
    './src/client/main.js',
    './src/client/styles/styles.scss',
  ],
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
