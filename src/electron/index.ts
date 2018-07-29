/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {
  BuildEvent,
  Builder,
  BuilderConfiguration,
  BuilderContext,
} from '@angular-devkit/architect';
import { LoggingCallback, WebpackBuilder } from '@angular-devkit/build-webpack';
import { Path, getSystemPath, normalize, resolve, virtualFs } from '@angular-devkit/core';
import * as fs from 'fs';
import { Observable, concat, of, throwError } from 'rxjs';
import { concatMap, last, tap } from 'rxjs/operators';
import * as ts from 'typescript'; // tslint:disable-line:no-implicit-dependencies
import { WebpackConfigOptions } from '@angular-devkit/build-angular/src/angular-cli-files/models/build-options';
import {
  getAotConfig,
  getCommonConfig,
  getNonAotConfig,
  getStatsConfig,
  getStylesConfig,
} from '@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs';
import { getRendererConfig } from '../webpack-configs/renderer'
import { readTsconfig } from '@angular-devkit/build-angular/src/angular-cli-files/utilities/read-tsconfig';
import { requireProjectModule } from '@angular-devkit/build-angular/src/angular-cli-files/utilities/require-project-module';
import { augmentAppWithServiceWorker } from '@angular-devkit/build-angular/src/angular-cli-files/utilities/service-worker';
import {
  statsErrorsToString,
  statsToString,
  statsWarningsToString,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/stats';
import { addFileReplacements, normalizeAssetPatterns } from '@angular-devkit/build-angular/src/utils';
import { ElectronBuilderSchema, } from './schema';
import { AssetPatternObject, CurrentFileReplacement } from '@angular-devkit/build-angular/src/browser/schema';
import { ElectronRendererBuilder, NormalizedElectronRendererBuilderSchema } from '../electron-renderer'
import { ElectronRendererBuilderSchema } from '../electron-renderer/schema'
const webpackMerge = require('webpack-merge');

export class ElectronBuilder implements Builder<ElectronBuilderSchema> {

  constructor(public context: BuilderContext) { }

  run(builderConfig: BuilderConfiguration<ElectronBuilderSchema>): Observable<BuildEvent> {
    const options = builderConfig.options;
    const root = this.context.workspace.root;
    const projectRoot = resolve(root, builderConfig.root);
    const host = new virtualFs.AliasHost(this.context.host as virtualFs.Host<fs.Stats>);
    const webpackBuilder = new WebpackBuilder({ ...this.context, host });
    let rendererOptions: ElectronRendererBuilderSchema;
    return of(null).pipe(
      concatMap(() => options.deleteOutputPath
        ? this._deleteOutputDir(root, normalize(options.outputPath), this.context.host)
        : of(null)),
      concatMap(() => addFileReplacements(root, host, options.fileReplacements)),
      concatMap(() => normalizeAssetPatterns(
        options.assets, host, root, projectRoot, builderConfig.sourceRoot)),
      // Replace the assets in options with the normalized version.
      tap((assetPatternObjects => options.assets = assetPatternObjects)),
      tap(() => {
        rendererOptions = Object.assign({},
          options.renderer,
          {
            assets: options.assets,
            fileReplacements: options.fileReplacements,
            outputPath: options.outputPath,
            verbose: options.verbose,
            progress: options.progress,
            watch: options.watch,
            poll: options.poll,
            extractLicenses: options.extractLicenses,
            showCircularDependencies: options.showCircularDependencies,
            statsJson: options.statsJson,
            deleteOutputPath: false
          });
      }),
      concatMap(() => {
        const electronRendererBuilder = new ElectronRendererBuilder(this.context);
        return electronRendererBuilder.buildWebpackConfig(
          root, projectRoot, host, rendererOptions as NormalizedElectronRendererBuilderSchema);
      }),
      concatMap(() => {
        // Ensure Build Optimizer is only used with AOT.
        if (options.renderer.buildOptimizer && !options.renderer.aot) {
          throw new Error('The `--build-optimizer` option cannot be used without `--aot`.');
        }

        let webpackConfig;
        try {
          webpackConfig = this.buildWebpackConfig(root, projectRoot, host,
            options as NormalizedElectronRendererBuilderSchema);
        } catch (e) {
          return throwError(e);
        }

        return webpackBuilder.runWebpack(webpackConfig, getElectronRendererLoggingCb(options.verbose));
      }),
      concatMap(buildEvent => {
        if (buildEvent.success && !options.watch && options.serviceWorker) {
          return new Observable(obs => {
            augmentAppWithServiceWorker(
              this.context.host,
              root,
              projectRoot,
              resolve(root, normalize(options.outputPath)),
              options.baseHref || '/',
              options.ngswConfigPath,
            ).then(
              () => {
                obs.next({ success: true });
                obs.complete();
              },
              (err: Error) => {
                obs.error(err);
              },
            );
          });
        } else {
          return of(buildEvent);
        }
      }),
    );
  }

  buildWebpackConfig(
    root: Path,
    projectRoot: Path,
    host: virtualFs.Host<fs.Stats>,
    options: NormalizedElectronRendererBuilderSchema,
  ) {
    let wco: WebpackConfigOptions<NormalizedElectronRendererBuilderSchema>;

    const tsConfigPath = getSystemPath(normalize(resolve(root, normalize(options.tsConfig))));
    const tsConfig = readTsconfig(tsConfigPath);

    const projectTs = requireProjectModule(getSystemPath(projectRoot), 'typescript') as typeof ts;

    const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
      && tsConfig.options.target !== projectTs.ScriptTarget.ES5;

    wco = {
      root: getSystemPath(root),
      projectRoot: getSystemPath(projectRoot),
      buildOptions: options,
      tsConfig,
      tsConfigPath,
      supportES2015,
    };

    const webpackConfigs: {}[] = [
      getCommonConfig(wco),
      getRendererConfig(wco),
      getStylesConfig(wco),
      getStatsConfig(wco),
    ];

    if (wco.buildOptions.main || wco.buildOptions.polyfills) {
      const typescriptConfigPartial = wco.buildOptions.aot
        ? getAotConfig(wco, host)
        : getNonAotConfig(wco, host);
      webpackConfigs.push(typescriptConfigPartial);
    }

    return webpackMerge(webpackConfigs);
  }

  private _deleteOutputDir(root: Path, outputPath: Path, host: virtualFs.Host) {
    const resolvedOutputPath = resolve(root, outputPath);
    if (resolvedOutputPath === root) {
      throw new Error('Output path MUST not be project root directory!');
    }

    return host.exists(resolvedOutputPath).pipe(
      concatMap(exists => exists
        // TODO: remove this concat once host ops emit an event.
        ? concat(host.delete(resolvedOutputPath), of(null)).pipe(last())
        // ? of(null)
        : of(null)),
    );
  }
}

export const getElectronRendererLoggingCb = (verbose: boolean): LoggingCallback =>
  (stats, config, logger) => {
    // config.stats contains our own stats settings, added during buildWebpackConfig().
    const json = stats.toJson(config.stats);
    if (verbose) {
      logger.info(stats.toString(config.stats));
    } else {
      logger.info(statsToString(json, config.stats));
    }

    if (stats.hasWarnings()) {
      logger.warn(statsWarningsToString(json, config.stats));
    }
    if (stats.hasErrors()) {
      logger.error(statsErrorsToString(json, config.stats));
    }
  };

export default ElectronBuilder;