/// <reference types="node" />
import { DevServerBuilder, BrowserBuilderSchema } from '@angular-devkit/build-angular';
import { Path, virtualFs } from '@angular-devkit/core';
import * as fs from 'fs';
export declare class ElectronDevServerBuilder extends DevServerBuilder {
    buildWebpackConfig(root: Path, projectRoot: Path, host: virtualFs.Host<fs.Stats>, browserOptions: BrowserBuilderSchema): any;
}
export default ElectronDevServerBuilder;
