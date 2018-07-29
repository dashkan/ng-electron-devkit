/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference types="node" />
import { BuildEvent, Builder, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { Path, virtualFs } from '@angular-devkit/core';
import * as fs from 'fs';
import { Observable } from 'rxjs';
import { DevServerBuilderOptions } from '@angular-devkit/build-angular/src/dev-server';
import { BrowserBuilderSchema } from '@angular-devkit/build-angular/src/browser/schema';
export declare class ElectronDevServerBuilder implements Builder<DevServerBuilderOptions> {
    context: BuilderContext;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<DevServerBuilderOptions>): Observable<BuildEvent>;
    buildWebpackConfig(root: Path, projectRoot: Path, host: virtualFs.Host<fs.Stats>, browserOptions: BrowserBuilderSchema): any;
    private _buildServerConfig;
    private _addLiveReload;
    private _addSslConfig;
    private _addProxyConfig;
    private _buildServePath;
    private _findDefaultServePath;
    private _getBrowserOptions;
}
export default ElectronDevServerBuilder;
