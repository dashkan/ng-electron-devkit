/// <reference types="node" />
import { BuilderContext, BuilderConfiguration, BuildEvent } from "@angular-devkit/architect";
import { BrowserBuilder, NormalizedBrowserBuilderSchema, BrowserBuilderSchema } from "@angular-devkit/build-angular";
import { Path, virtualFs } from '@angular-devkit/core';
import { Observable } from "rxjs";
import * as fs from 'fs';
export declare class ElectronBuilder extends BrowserBuilder {
    context: BuilderContext;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<BrowserBuilderSchema>): Observable<BuildEvent>;
    buildWebpackConfig(root: Path, projectRoot: Path, host: virtualFs.Host<fs.Stats>, options: NormalizedBrowserBuilderSchema): any;
}
export default ElectronBuilder;
