import { DevServerBuilder, BrowserBuilderSchema } from '@angular-devkit/build-angular';
import { Path, virtualFs } from '@angular-devkit/core';
import * as fs from 'fs';
import { electronConfig } from '../electron-webpack-config';

const webpackMerge = require('webpack-merge');

export class ElectronDevServerBuilder extends DevServerBuilder {
    buildWebpackConfig(
        root: Path,
        projectRoot: Path,
        host: virtualFs.Host<fs.Stats>,
        browserOptions: BrowserBuilderSchema,
    ) {
        const browserConfig = super.buildWebpackConfig(root, projectRoot, host, browserOptions);
        const webpackConfigs: {}[] = [
            browserConfig,
            electronConfig
        ];

        return webpackMerge(webpackConfigs);

    }
}

export default ElectronDevServerBuilder;