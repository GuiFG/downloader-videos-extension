const path = require('path');

module.exports = [
  {
    name: 'service-worker',
    mode: 'development',
    entry: './src/background/service-worker.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'service-worker.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
      ],
    },
  },
  {
    name: 'content-script',
    mode: 'development',
    entry: './src/content/content-script.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'content-script.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
      ],
    },
  },
  {
    name: 'popup',
    mode: 'development',
    entry: './src/popup/popup.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'popup.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
      ],
    },
  },
];
