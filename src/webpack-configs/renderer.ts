import { WebpackConfigOptions } from '@angular-devkit/build-angular/src/angular-cli-files/models/build-options';
import { getBrowserConfig } from '@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/browser';

const webpackMerge = require('webpack-merge');

export function getRendererConfig(wco: WebpackConfigOptions) {

  const browserConfig = getBrowserConfig(wco);
  const rendererConfig = {
    target: 'electron-renderer',
    node: {
      __dirname: false
    }
  };

  return webpackMerge(browserConfig, rendererConfig);
}
