/// <reference types="node" />
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuildEvent, Builder, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { LoggingCallback } from '@angular-devkit/build-webpack';
import { Path, virtualFs } from '@angular-devkit/core';
import * as fs from 'fs';
import { Observable } from 'rxjs';
import { AssetPatternObject, ElectronRendererBuilderSchema, CurrentFileReplacement } from './schema';
export interface NormalizedElectronRendererBuilderSchema extends ElectronRendererBuilderSchema {
    assets: AssetPatternObject[];
    fileReplacements: CurrentFileReplacement[];
}
export declare class ElectronRendererBuilder implements Builder<ElectronRendererBuilderSchema> {
    context: BuilderContext;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<ElectronRendererBuilderSchema>): Observable<BuildEvent>;
    buildWebpackConfig(root: Path, projectRoot: Path, host: virtualFs.Host<fs.Stats>, options: NormalizedElectronRendererBuilderSchema): any;
    private _deleteOutputDir;
}
export declare const getElectronRendererLoggingCb: (verbose: boolean) => LoggingCallback;
export default ElectronRendererBuilder;
