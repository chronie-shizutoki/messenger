const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// 安装clean-webpack-plugin
const fs = require('fs');
let CleanWebpackPluginInstalled = false;
let CleanWebpackPluginModule = null;

try {
  CleanWebpackPluginModule = require('clean-webpack-plugin');
  CleanWebpackPluginInstalled = true;
} catch (e) {
  console.log('clean-webpack-plugin not installed, will skip');
}

module.exports = {
  mode: 'production',
  entry: {
    'chat-client': './public/chat-client.js',
    'i18n': './public/js/i18n.js',
    'webauthn-browser': './public/webauthn-browser.js'
  },
  output: {
    filename: '[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: './'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]'
        }
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext]'
        }
      }
    ]
  },
  plugins: [
    // 处理index.html模板
    new HtmlWebpackPlugin({
      template: './public/index-webpack-template.html',
      filename: 'index.html',
      chunks: ['chat-client', 'i18n', 'vendors'],
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true
      }
    }),
    // 处理new-feather.html模板
    new HtmlWebpackPlugin({
      template: './public/new-feather-webpack-template.html',
      filename: 'new-feather.html',
      chunks: [],
      minify: {
        collapseWhitespace: true,
        removeComments: true
      }
    }),
    // 复制其他静态文件
    new CopyPlugin({
      patterns: [
        { from: './public/LXGWWenKaiGB-Regular.woff2', to: 'LXGWWenKaiGB-Regular.woff2' },
        { from: './public/css', to: 'css' },
        { from: './public/locales', to: 'locales' },
        { from: './public/lib', to: 'lib' }
      ]
    })
  ].concat(CleanWebpackPluginInstalled ? [new CleanWebpackPluginModule.CleanWebpackPlugin()] : []),
  optimization: {
    minimize: true,
    minimizer: [
      // JavaScript 压缩和混淆
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,  // 移除console.log
            drop_debugger: true, // 移除debugger
            dead_code: true,     // 移除死代码
            unused: true         // 移除未使用的代码
          },
          mangle: {
            toplevel: true,       // 混淆顶层变量和函数名
            keep_classnames: false, // 不保留类名
            keep_fnames: false     // 不保留函数名
          },
          output: {
            comments: false,      // 移除注释
            beautify: false       // 不格式化输出
          }
        }
      }),
      // CSS 压缩
      new CssMinimizerPlugin()
    ],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
  resolve: {
    extensions: ['.js', '.css']
  },
  performance: {
    hints: false
  }
};

// 如果缺少clean-webpack-plugin，自动安装
if (!CleanWebpackPluginInstalled) {
  const { execSync } = require('child_process');
  console.log('Installing clean-webpack-plugin...');
  try {
    execSync('npm install --save-dev clean-webpack-plugin', { stdio: 'inherit' });
    console.log('clean-webpack-plugin installed successfully.');
    // 提示用户重新运行打包命令
    console.log('Please run the build command again.');
  } catch (error) {
    console.error('Failed to install clean-webpack-plugin:', error);
  }
}