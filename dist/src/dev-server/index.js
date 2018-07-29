"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const build_webpack_1 = require("@angular-devkit/build-webpack");
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const url = require("url");
const webpack = require("webpack");
const check_port_1 = require("@angular-devkit/build-angular/src/angular-cli-files/utilities/check-port");
const browser_1 = require("@angular-devkit/build-angular/src/browser");
const renderer_1 = require("../renderer");
const utils_1 = require("@angular-devkit/build-angular/src/utils");
const opn = require('opn');
class ElectronDevServerBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        const webpackDevServerBuilder = new build_webpack_1.WebpackDevServerBuilder(Object.assign({}, this.context, { host }));
        let browserOptions;
        let first = true;
        let opnAddress;
        return check_port_1.checkPort(options.port, options.host).pipe(operators_1.tap((port) => options.port = port), operators_1.concatMap(() => this._getBrowserOptions(options)), operators_1.tap((opts) => browserOptions = opts), operators_1.concatMap(() => utils_1.addFileReplacements(root, host, browserOptions.fileReplacements)), operators_1.concatMap(() => utils_1.normalizeAssetPatterns(browserOptions.assets, host, root, projectRoot, builderConfig.sourceRoot)), 
        // Replace the assets in options with the normalized version.
        operators_1.tap((assetPatternObjects => browserOptions.assets = assetPatternObjects)), operators_1.concatMap(() => {
            const browserBuilder = new renderer_1.ElectronRendererBuilder(this.context);
            const webpackConfig = browserBuilder.buildWebpackConfig(root, projectRoot, host, browserOptions);
            let webpackDevServerConfig;
            try {
                webpackDevServerConfig = this._buildServerConfig(root, projectRoot, options, browserOptions);
            }
            catch (err) {
                return rxjs_1.throwError(err);
            }
            // Resolve public host and client address.
            let clientAddress = `${options.ssl ? 'https' : 'http'}://0.0.0.0:0`;
            if (options.publicHost) {
                let publicHost = options.publicHost;
                if (!/^\w+:\/\//.test(publicHost)) {
                    publicHost = `${options.ssl ? 'https' : 'http'}://${publicHost}`;
                }
                const clientUrl = url.parse(publicHost);
                options.publicHost = clientUrl.host;
                clientAddress = url.format(clientUrl);
            }
            // Resolve serve address.
            const serverAddress = url.format({
                protocol: options.ssl ? 'https' : 'http',
                hostname: options.host === '0.0.0.0' ? 'localhost' : options.host,
                port: options.port.toString(),
            });
            // Add live reload config.
            if (options.liveReload) {
                this._addLiveReload(options, browserOptions, webpackConfig, clientAddress);
            }
            else if (options.hmr) {
                this.context.logger.warn('Live reload is disabled. HMR option ignored.');
            }
            if (!options.watch) {
                // There's no option to turn off file watching in webpack-dev-server, but
                // we can override the file watcher instead.
                webpackConfig.plugins.unshift({
                    // tslint:disable-next-line:no-any
                    apply: (compiler) => {
                        compiler.hooks.afterEnvironment.tap('angular-cli', () => {
                            compiler.watchFileSystem = { watch: () => { } };
                        });
                    },
                });
            }
            if (browserOptions.optimization) {
                this.context.logger.error(core_1.tags.stripIndents `
            ****************************************************************************************
            This is a simple server for use in testing or debugging Angular applications locally.
            It hasn't been reviewed for security issues.

            DON'T USE IT FOR PRODUCTION!
            ****************************************************************************************
          `);
            }
            this.context.logger.info(core_1.tags.oneLine `
          **
          Angular Live Development Server is listening on ${options.host}:${options.port},
          open your browser on ${serverAddress}${webpackDevServerConfig.publicPath}
          **
        `);
            opnAddress = serverAddress + webpackDevServerConfig.publicPath;
            webpackConfig.devServer = webpackDevServerConfig;
            return webpackDevServerBuilder.runWebpackDevServer(webpackConfig, undefined, browser_1.getBrowserLoggingCb(browserOptions.verbose));
        }), operators_1.map(buildEvent => {
            if (first && options.open) {
                first = false;
                opn(opnAddress);
            }
            return buildEvent;
        }));
    }
    buildWebpackConfig(root, projectRoot, host, browserOptions) {
        const browserBuilder = new renderer_1.ElectronRendererBuilder(this.context);
        const webpackConfig = browserBuilder.buildWebpackConfig(root, projectRoot, host, browserOptions);
        return webpackConfig;
    }
    _buildServerConfig(root, projectRoot, options, browserOptions) {
        const systemRoot = core_1.getSystemPath(root);
        if (options.disableHostCheck) {
            this.context.logger.warn(core_1.tags.oneLine `
        WARNING: Running a server with --disable-host-check is a security risk.
        See https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
        for more information.
      `);
        }
        const servePath = this._buildServePath(options, browserOptions);
        const config = {
            host: options.host,
            port: options.port,
            headers: { 'Access-Control-Allow-Origin': '*' },
            historyApiFallback: {
                index: `${servePath}/${path.basename(browserOptions.index)}`,
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
            },
            stats: 'none',
            compress: browserOptions.optimization,
            watchOptions: {
                poll: browserOptions.poll,
            },
            https: options.ssl,
            overlay: {
                errors: !browserOptions.optimization,
                warnings: false,
            },
            public: options.publicHost,
            disableHostCheck: options.disableHostCheck,
            publicPath: servePath,
            hot: options.hmr,
        };
        if (options.ssl) {
            this._addSslConfig(systemRoot, options, config);
        }
        if (options.proxyConfig) {
            this._addProxyConfig(systemRoot, options, config);
        }
        return config;
    }
    _addLiveReload(options, browserOptions, webpackConfig, // tslint:disable-line:no-any
    clientAddress) {
        // This allows for live reload of page when changes are made to repo.
        // https://webpack.js.org/configuration/dev-server/#devserver-inline
        let webpackDevServerPath;
        try {
            webpackDevServerPath = require.resolve('webpack-dev-server/client');
        }
        catch (_a) {
            throw new Error('The "webpack-dev-server" package could not be found.');
        }
        const entryPoints = [`${webpackDevServerPath}?${clientAddress}`];
        if (options.hmr) {
            const webpackHmrLink = 'https://webpack.js.org/guides/hot-module-replacement';
            this.context.logger.warn(core_1.tags.oneLine `NOTICE: Hot Module Replacement (HMR) is enabled for the dev server.`);
            const showWarning = options.hmrWarning;
            if (showWarning) {
                this.context.logger.info(core_1.tags.stripIndents `
          The project will still live reload when HMR is enabled,
          but to take advantage of HMR additional application code is required'
          (not included in an Angular CLI project by default).'
          See ${webpackHmrLink}
          for information on working with HMR for Webpack.`);
                this.context.logger.warn(core_1.tags.oneLine `To disable this warning use "hmrWarning: false" under "serve"
           options in "angular.json".`);
            }
            entryPoints.push('webpack/hot/dev-server');
            webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin());
            if (browserOptions.extractCss) {
                this.context.logger.warn(core_1.tags.oneLine `NOTICE: (HMR) does not allow for CSS hot reload
                when used together with '--extract-css'.`);
            }
        }
        if (!webpackConfig.entry.main) {
            webpackConfig.entry.main = [];
        }
        webpackConfig.entry.main.unshift(...entryPoints);
    }
    _addSslConfig(root, options, config) {
        let sslKey = undefined;
        let sslCert = undefined;
        if (options.sslKey) {
            const keyPath = path.resolve(root, options.sslKey);
            if (fs_1.existsSync(keyPath)) {
                sslKey = fs_1.readFileSync(keyPath, 'utf-8');
            }
        }
        if (options.sslCert) {
            const certPath = path.resolve(root, options.sslCert);
            if (fs_1.existsSync(certPath)) {
                sslCert = fs_1.readFileSync(certPath, 'utf-8');
            }
        }
        config.https = true;
        if (sslKey != null && sslCert != null) {
            config.https = {
                key: sslKey,
                cert: sslCert,
            };
        }
    }
    _addProxyConfig(root, options, config) {
        let proxyConfig = {};
        const proxyPath = path.resolve(root, options.proxyConfig);
        if (fs_1.existsSync(proxyPath)) {
            proxyConfig = require(proxyPath);
        }
        else {
            const message = 'Proxy config file ' + proxyPath + ' does not exist.';
            throw new Error(message);
        }
        config.proxy = proxyConfig;
    }
    _buildServePath(options, browserOptions) {
        let servePath = options.servePath;
        if (!servePath && servePath !== '') {
            const defaultServePath = this._findDefaultServePath(browserOptions.baseHref, browserOptions.deployUrl);
            const showWarning = options.servePathDefaultWarning;
            if (defaultServePath == null && showWarning) {
                this.context.logger.warn(core_1.tags.oneLine `
            WARNING: --deploy-url and/or --base-href contain
            unsupported values for ng serve.  Default serve path of '/' used.
            Use --serve-path to override.
          `);
            }
            servePath = defaultServePath || '';
        }
        if (servePath.endsWith('/')) {
            servePath = servePath.substr(0, servePath.length - 1);
        }
        if (!servePath.startsWith('/')) {
            servePath = `/${servePath}`;
        }
        return servePath;
    }
    _findDefaultServePath(baseHref, deployUrl) {
        if (!baseHref && !deployUrl) {
            return '';
        }
        if (/^(\w+:)?\/\//.test(baseHref || '') || /^(\w+:)?\/\//.test(deployUrl || '')) {
            // If baseHref or deployUrl is absolute, unsupported by ng serve
            return null;
        }
        // normalize baseHref
        // for ng serve the starting base is always `/` so a relative
        // and root relative value are identical
        const baseHrefParts = (baseHref || '')
            .split('/')
            .filter(part => part !== '');
        if (baseHref && !baseHref.endsWith('/')) {
            baseHrefParts.pop();
        }
        const normalizedBaseHref = baseHrefParts.length === 0 ? '/' : `/${baseHrefParts.join('/')}/`;
        if (deployUrl && deployUrl[0] === '/') {
            if (baseHref && baseHref[0] === '/' && normalizedBaseHref !== deployUrl) {
                // If baseHref and deployUrl are root relative and not equivalent, unsupported by ng serve
                return null;
            }
            return deployUrl;
        }
        // Join together baseHref and deployUrl
        return `${normalizedBaseHref}${deployUrl || ''}`;
    }
    _getBrowserOptions(options) {
        const architect = this.context.architect;
        const [project, target, configuration] = options.browserTarget.split(':');
        const overrides = Object.assign({ 
            // Override browser build watch setting.
            watch: options.watch }, (options.optimization !== undefined ? { optimization: options.optimization } : {}), (options.aot !== undefined ? { aot: options.aot } : {}), (options.sourceMap !== undefined ? { sourceMap: options.sourceMap } : {}), (options.evalSourceMap !== undefined ? { evalSourceMap: options.evalSourceMap } : {}), (options.vendorChunk !== undefined ? { vendorChunk: options.vendorChunk } : {}), (options.commonChunk !== undefined ? { commonChunk: options.commonChunk } : {}), (options.baseHref !== undefined ? { baseHref: options.baseHref } : {}), (options.progress !== undefined ? { progress: options.progress } : {}), (options.poll !== undefined ? { poll: options.poll } : {}));
        const browserTargetSpec = { project, target, configuration, overrides };
        const builderConfig = architect.getBuilderConfiguration(browserTargetSpec);
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(browserDescription => architect.validateBuilderOptions(builderConfig, browserDescription)), operators_1.map(browserConfig => browserConfig.options));
    }
}
exports.ElectronDevServerBuilder = ElectronDevServerBuilder;
exports.default = ElectronDevServerBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiL1VzZXJzL2FzaGthbi9Qcm9qZWN0cy9hc2hrYW4vbmctZWxlY3Ryb24tZGV2a2l0LyIsInNvdXJjZXMiOlsic3JjL2Rldi1zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFRSCxpRUFBd0U7QUFDeEUsK0NBQXFGO0FBQ3JGLDJCQUE4QztBQUU5Qyw2QkFBNkI7QUFDN0IsK0JBQThDO0FBQzlDLDhDQUFxRDtBQUNyRCwyQkFBMkI7QUFDM0IsbUNBQW1DO0FBRW5DLHlHQUFxRztBQUNyRyx1RUFBZ0g7QUFDaEgsMENBQXNEO0FBR3RELG1FQUFzRztBQUN0RyxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7QUFHM0I7SUFFRSxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTREO1FBQzlELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELE1BQU0sSUFBSSxHQUFHLElBQUksZ0JBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFnQyxDQUFDLENBQUM7UUFDcEYsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLHVDQUF1QixtQkFBTSxJQUFJLENBQUMsT0FBTyxJQUFFLElBQUksSUFBRyxDQUFDO1FBQ3ZGLElBQUksY0FBb0MsQ0FBQztRQUN6QyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxVQUFrQixDQUFDO1FBRXZCLE9BQU8sc0JBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFF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QUFDLEVBQUUsQ0FBQyxFQUMvRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUN0RSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUN0RSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUM5RCxDQUFDO1FBRUYsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxDQUFDO1FBQ3hFLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyx1QkFBdUIsQ0FDckQsaUJBQWlCLENBQUMsQ0FBQztRQUVyQixPQUFPLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQ3hELHFCQUFTLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUM3QixTQUFTLENBQUMsc0JBQXNCLENBQUMsYUFBYSxFQUFFLGtCQUFrQixDQUFDLENBQUMsRUFDdEUsZUFBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUM1QyxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBcldELDREQXFXQztBQUVELGtCQUFlLHdCQUF3QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgV2VicGFja0RldlNlcnZlckJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCByZXNvbHZlLCB0YWdzLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCAqIGFzIFdlYnBhY2tEZXZTZXJ2ZXIgZnJvbSAnd2VicGFjay1kZXYtc2VydmVyJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvY2hlY2stcG9ydCc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsIGdldEJyb3dzZXJMb2dnaW5nQ2IgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci9zcmMvYnJvd3Nlcic7XG5pbXBvcnQgeyBFbGVjdHJvblJlbmRlcmVyQnVpbGRlciB9IGZyb20gJy4uL3JlbmRlcmVyJztcbmltcG9ydCB7IERldlNlcnZlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXIvc3JjL2Rldi1zZXJ2ZXInO1xuaW1wb3J0IHsgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci9zcmMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgYWRkRmlsZVJlcGxhY2VtZW50cywgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyL3NyYy91dGlscyc7XG5jb25zdCBvcG4gPSByZXF1aXJlKCdvcG4nKTtcblxuXG5leHBvcnQgY2xhc3MgRWxlY3Ryb25EZXZTZXJ2ZXJCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucz4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPERldlNlcnZlckJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+KTtcbiAgICBjb25zdCB3ZWJwYWNrRGV2U2VydmVyQnVpbGRlciA9IG5ldyBXZWJwYWNrRGV2U2VydmVyQnVpbGRlcih7IC4uLnRoaXMuY29udGV4dCwgaG9zdCB9KTtcbiAgICBsZXQgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuICAgIGxldCBmaXJzdCA9IHRydWU7XG4gICAgbGV0IG9wbkFkZHJlc3M6IHN0cmluZztcblxuICAgIHJldHVybiBjaGVja1BvcnQob3B0aW9ucy5wb3J0LCBvcHRpb25zLmhvc3QpLnBpcGUoXG4gICAgICB0YXAoKHBvcnQpID0+IG9wdGlvbnMucG9ydCA9IHBvcnQpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHRoaXMuX2dldEJyb3dzZXJPcHRpb25zKG9wdGlvbnMpKSxcbiAgICAgIHRhcCgob3B0cykgPT4gYnJvd3Nlck9wdGlvbnMgPSBvcHRzKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBhZGRGaWxlUmVwbGFjZW1lbnRzKHJvb3QsIGhvc3QsIGJyb3dzZXJPcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgICBicm93c2VyT3B0aW9ucy5hc3NldHMsIGhvc3QsIHJvb3QsIHByb2plY3RSb290LCBidWlsZGVyQ29uZmlnLnNvdXJjZVJvb3QpKSxcbiAgICAgIC8vIFJlcGxhY2UgdGhlIGFzc2V0cyBpbiBvcHRpb25zIHdpdGggdGhlIG5vcm1hbGl6ZWQgdmVyc2lvbi5cbiAgICAgIHRhcCgoYXNzZXRQYXR0ZXJuT2JqZWN0cyA9PiBicm93c2VyT3B0aW9ucy5hc3NldHMgPSBhc3NldFBhdHRlcm5PYmplY3RzKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4ge1xuICAgICAgICBjb25zdCBicm93c2VyQnVpbGRlciA9IG5ldyBFbGVjdHJvblJlbmRlcmVyQnVpbGRlcih0aGlzLmNvbnRleHQpO1xuICAgICAgICBjb25zdCB3ZWJwYWNrQ29uZmlnID0gYnJvd3NlckJ1aWxkZXIuYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgICAgICAgIHJvb3QsIHByb2plY3RSb290LCBob3N0LCBicm93c2VyT3B0aW9ucyBhcyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEpO1xuXG4gICAgICAgIGxldCB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnOiBXZWJwYWNrRGV2U2VydmVyLkNvbmZpZ3VyYXRpb247XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2VicGFja0RldlNlcnZlckNvbmZpZyA9IHRoaXMuX2J1aWxkU2VydmVyQ29uZmlnKFxuICAgICAgICAgICAgcm9vdCwgcHJvamVjdFJvb3QsIG9wdGlvbnMsIGJyb3dzZXJPcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc29sdmUgcHVibGljIGhvc3QgYW5kIGNsaWVudCBhZGRyZXNzLlxuICAgICAgICBsZXQgY2xpZW50QWRkcmVzcyA9IGAke29wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJ306Ly8wLjAuMC4wOjBgO1xuICAgICAgICBpZiAob3B0aW9ucy5wdWJsaWNIb3N0KSB7XG4gICAgICAgICAgbGV0IHB1YmxpY0hvc3QgPSBvcHRpb25zLnB1YmxpY0hvc3Q7XG4gICAgICAgICAgaWYgKCEvXlxcdys6XFwvXFwvLy50ZXN0KHB1YmxpY0hvc3QpKSB7XG4gICAgICAgICAgICBwdWJsaWNIb3N0ID0gYCR7b3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLyR7cHVibGljSG9zdH1gO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBjbGllbnRVcmwgPSB1cmwucGFyc2UocHVibGljSG9zdCk7XG4gICAgICAgICAgb3B0aW9ucy5wdWJsaWNIb3N0ID0gY2xpZW50VXJsLmhvc3Q7XG4gICAgICAgICAgY2xpZW50QWRkcmVzcyA9IHVybC5mb3JtYXQoY2xpZW50VXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc29sdmUgc2VydmUgYWRkcmVzcy5cbiAgICAgICAgY29uc3Qgc2VydmVyQWRkcmVzcyA9IHVybC5mb3JtYXQoe1xuICAgICAgICAgIHByb3RvY29sOiBvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCcsXG4gICAgICAgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdCA9PT0gJzAuMC4wLjAnID8gJ2xvY2FsaG9zdCcgOiBvcHRpb25zLmhvc3QsXG4gICAgICAgICAgcG9ydDogb3B0aW9ucy5wb3J0LnRvU3RyaW5nKCksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBsaXZlIHJlbG9hZCBjb25maWcuXG4gICAgICAgIGlmIChvcHRpb25zLmxpdmVSZWxvYWQpIHtcbiAgICAgICAgICB0aGlzLl9hZGRMaXZlUmVsb2FkKG9wdGlvbnMsIGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnLCBjbGllbnRBZGRyZXNzKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybignTGl2ZSByZWxvYWQgaXMgZGlzYWJsZWQuIEhNUiBvcHRpb24gaWdub3JlZC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghb3B0aW9ucy53YXRjaCkge1xuICAgICAgICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAgICAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgICAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy51bnNoaWZ0KHtcbiAgICAgICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgICAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgnYW5ndWxhci1jbGknLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4geyB9IH07XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pIHtcbiAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgVGhpcyBpcyBhIHNpbXBsZSBzZXJ2ZXIgZm9yIHVzZSBpbiB0ZXN0aW5nIG9yIGRlYnVnZ2luZyBBbmd1bGFyIGFwcGxpY2F0aW9ucyBsb2NhbGx5LlxuICAgICAgICAgICAgSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICAgICAgRE9OJ1QgVVNFIElUIEZPUiBQUk9EVUNUSU9OIVxuICAgICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgIGApO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHRhZ3Mub25lTGluZWBcbiAgICAgICAgICAqKlxuICAgICAgICAgIEFuZ3VsYXIgTGl2ZSBEZXZlbG9wbWVudCBTZXJ2ZXIgaXMgbGlzdGVuaW5nIG9uICR7b3B0aW9ucy5ob3N0fToke29wdGlvbnMucG9ydH0sXG4gICAgICAgICAgb3BlbiB5b3VyIGJyb3dzZXIgb24gJHtzZXJ2ZXJBZGRyZXNzfSR7d2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRofVxuICAgICAgICAgICoqXG4gICAgICAgIGApO1xuXG4gICAgICAgIG9wbkFkZHJlc3MgPSBzZXJ2ZXJBZGRyZXNzICsgd2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRoO1xuICAgICAgICB3ZWJwYWNrQ29uZmlnLmRldlNlcnZlciA9IHdlYnBhY2tEZXZTZXJ2ZXJDb25maWc7XG5cbiAgICAgICAgcmV0dXJuIHdlYnBhY2tEZXZTZXJ2ZXJCdWlsZGVyLnJ1bldlYnBhY2tEZXZTZXJ2ZXIoXG4gICAgICAgICAgd2VicGFja0NvbmZpZywgdW5kZWZpbmVkLCBnZXRCcm93c2VyTG9nZ2luZ0NiKGJyb3dzZXJPcHRpb25zLnZlcmJvc2UpLFxuICAgICAgICApO1xuICAgICAgfSksXG4gICAgICBtYXAoYnVpbGRFdmVudCA9PiB7XG4gICAgICAgIGlmIChmaXJzdCAmJiBvcHRpb25zLm9wZW4pIHtcbiAgICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgICAgIG9wbihvcG5BZGRyZXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBidWlsZEV2ZW50O1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGJ1aWxkV2VicGFja0NvbmZpZyhcbiAgICByb290OiBQYXRoLFxuICAgIHByb2plY3RSb290OiBQYXRoLFxuICAgIGhvc3Q6IHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPixcbiAgICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICkge1xuICAgIGNvbnN0IGJyb3dzZXJCdWlsZGVyID0gbmV3IEVsZWN0cm9uUmVuZGVyZXJCdWlsZGVyKHRoaXMuY29udGV4dCk7XG4gICAgY29uc3Qgd2VicGFja0NvbmZpZyA9IGJyb3dzZXJCdWlsZGVyLmJ1aWxkV2VicGFja0NvbmZpZyhcbiAgICAgIHJvb3QsIHByb2plY3RSb290LCBob3N0LCBicm93c2VyT3B0aW9ucyBhcyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEpO1xuXG4gICAgcmV0dXJuIHdlYnBhY2tDb25maWc7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNlcnZlckNvbmZpZyhcbiAgICByb290OiBQYXRoLFxuICAgIHByb2plY3RSb290OiBQYXRoLFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgKSB7XG4gICAgY29uc3Qgc3lzdGVtUm9vdCA9IGdldFN5c3RlbVBhdGgocm9vdCk7XG4gICAgaWYgKG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV0FSTklORzogUnVubmluZyBhIHNlcnZlciB3aXRoIC0tZGlzYWJsZS1ob3N0LWNoZWNrIGlzIGEgc2VjdXJpdHkgcmlzay5cbiAgICAgICAgU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGFcbiAgICAgICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICBgKTtcbiAgICB9XG5cbiAgICBjb25zdCBzZXJ2ZVBhdGggPSB0aGlzLl9idWlsZFNlcnZlUGF0aChvcHRpb25zLCBicm93c2VyT3B0aW9ucyk7XG5cbiAgICBjb25zdCBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbiA9IHtcbiAgICAgIGhvc3Q6IG9wdGlvbnMuaG9zdCxcbiAgICAgIHBvcnQ6IG9wdGlvbnMucG9ydCxcbiAgICAgIGhlYWRlcnM6IHsgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyB9LFxuICAgICAgaGlzdG9yeUFwaUZhbGxiYWNrOiA8YW55PntcbiAgICAgICAgaW5kZXg6IGAke3NlcnZlUGF0aH0vJHtwYXRoLmJhc2VuYW1lKGJyb3dzZXJPcHRpb25zLmluZGV4KX1gLFxuICAgICAgICBkaXNhYmxlRG90UnVsZTogdHJ1ZSxcbiAgICAgICAgaHRtbEFjY2VwdEhlYWRlcnM6IFsndGV4dC9odG1sJywgJ2FwcGxpY2F0aW9uL3hodG1sK3htbCddLFxuICAgICAgfSxcbiAgICAgIHN0YXRzOiAnbm9uZScsXG4gICAgICBjb21wcmVzczogYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICAgIHBvbGw6IGJyb3dzZXJPcHRpb25zLnBvbGwsXG4gICAgICB9LFxuICAgICAgaHR0cHM6IG9wdGlvbnMuc3NsLFxuICAgICAgb3ZlcmxheToge1xuICAgICAgICBlcnJvcnM6ICFicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24sXG4gICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBwdWJsaWM6IG9wdGlvbnMucHVibGljSG9zdCxcbiAgICAgIGRpc2FibGVIb3N0Q2hlY2s6IG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjayxcbiAgICAgIHB1YmxpY1BhdGg6IHNlcnZlUGF0aCxcbiAgICAgIGhvdDogb3B0aW9ucy5obXIsXG4gICAgfTtcblxuICAgIGlmIChvcHRpb25zLnNzbCkge1xuICAgICAgdGhpcy5fYWRkU3NsQ29uZmlnKHN5c3RlbVJvb3QsIG9wdGlvbnMsIGNvbmZpZyk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMucHJveHlDb25maWcpIHtcbiAgICAgIHRoaXMuX2FkZFByb3h5Q29uZmlnKHN5c3RlbVJvb3QsIG9wdGlvbnMsIGNvbmZpZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbmZpZztcbiAgfVxuXG4gIHByaXZhdGUgX2FkZExpdmVSZWxvYWQoXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICAgIHdlYnBhY2tDb25maWc6IGFueSwgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcbiAgICBjbGllbnRBZGRyZXNzOiBzdHJpbmcsXG4gICkge1xuICAgIC8vIFRoaXMgYWxsb3dzIGZvciBsaXZlIHJlbG9hZCBvZiBwYWdlIHdoZW4gY2hhbmdlcyBhcmUgbWFkZSB0byByZXBvLlxuICAgIC8vIGh0dHBzOi8vd2VicGFjay5qcy5vcmcvY29uZmlndXJhdGlvbi9kZXYtc2VydmVyLyNkZXZzZXJ2ZXItaW5saW5lXG4gICAgbGV0IHdlYnBhY2tEZXZTZXJ2ZXJQYXRoO1xuICAgIHRyeSB7XG4gICAgICB3ZWJwYWNrRGV2U2VydmVyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgnd2VicGFjay1kZXYtc2VydmVyL2NsaWVudCcpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgXCJ3ZWJwYWNrLWRldi1zZXJ2ZXJcIiBwYWNrYWdlIGNvdWxkIG5vdCBiZSBmb3VuZC4nKTtcbiAgICB9XG4gICAgY29uc3QgZW50cnlQb2ludHMgPSBbYCR7d2VicGFja0RldlNlcnZlclBhdGh9PyR7Y2xpZW50QWRkcmVzc31gXTtcbiAgICBpZiAob3B0aW9ucy5obXIpIHtcbiAgICAgIGNvbnN0IHdlYnBhY2tIbXJMaW5rID0gJ2h0dHBzOi8vd2VicGFjay5qcy5vcmcvZ3VpZGVzL2hvdC1tb2R1bGUtcmVwbGFjZW1lbnQnO1xuXG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIHRhZ3Mub25lTGluZWBOT1RJQ0U6IEhvdCBNb2R1bGUgUmVwbGFjZW1lbnQgKEhNUikgaXMgZW5hYmxlZCBmb3IgdGhlIGRldiBzZXJ2ZXIuYCk7XG5cbiAgICAgIGNvbnN0IHNob3dXYXJuaW5nID0gb3B0aW9ucy5obXJXYXJuaW5nO1xuICAgICAgaWYgKHNob3dXYXJuaW5nKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyh0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICAgICBUaGUgcHJvamVjdCB3aWxsIHN0aWxsIGxpdmUgcmVsb2FkIHdoZW4gSE1SIGlzIGVuYWJsZWQsXG4gICAgICAgICAgYnV0IHRvIHRha2UgYWR2YW50YWdlIG9mIEhNUiBhZGRpdGlvbmFsIGFwcGxpY2F0aW9uIGNvZGUgaXMgcmVxdWlyZWQnXG4gICAgICAgICAgKG5vdCBpbmNsdWRlZCBpbiBhbiBBbmd1bGFyIENMSSBwcm9qZWN0IGJ5IGRlZmF1bHQpLidcbiAgICAgICAgICBTZWUgJHt3ZWJwYWNrSG1yTGlua31cbiAgICAgICAgICBmb3IgaW5mb3JtYXRpb24gb24gd29ya2luZyB3aXRoIEhNUiBmb3IgV2VicGFjay5gLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgICAgdGFncy5vbmVMaW5lYFRvIGRpc2FibGUgdGhpcyB3YXJuaW5nIHVzZSBcImhtcldhcm5pbmc6IGZhbHNlXCIgdW5kZXIgXCJzZXJ2ZVwiXG4gICAgICAgICAgIG9wdGlvbnMgaW4gXCJhbmd1bGFyLmpzb25cIi5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgZW50cnlQb2ludHMucHVzaCgnd2VicGFjay9ob3QvZGV2LXNlcnZlcicpO1xuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2gobmV3IHdlYnBhY2suSG90TW9kdWxlUmVwbGFjZW1lbnRQbHVnaW4oKSk7XG4gICAgICBpZiAoYnJvd3Nlck9wdGlvbnMuZXh0cmFjdENzcykge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYE5PVElDRTogKEhNUikgZG9lcyBub3QgYWxsb3cgZm9yIENTUyBob3QgcmVsb2FkXG4gICAgICAgICAgICAgICAgd2hlbiB1c2VkIHRvZ2V0aGVyIHdpdGggJy0tZXh0cmFjdC1jc3MnLmApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXdlYnBhY2tDb25maWcuZW50cnkubWFpbikgeyB3ZWJwYWNrQ29uZmlnLmVudHJ5Lm1haW4gPSBbXTsgfVxuICAgIHdlYnBhY2tDb25maWcuZW50cnkubWFpbi51bnNoaWZ0KC4uLmVudHJ5UG9pbnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2FkZFNzbENvbmZpZyhcbiAgICByb290OiBzdHJpbmcsXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgY29uZmlnOiBXZWJwYWNrRGV2U2VydmVyLkNvbmZpZ3VyYXRpb24sXG4gICkge1xuICAgIGxldCBzc2xLZXk6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBsZXQgc3NsQ2VydDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChvcHRpb25zLnNzbEtleSkge1xuICAgICAgY29uc3Qga2V5UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnNzbEtleSBhcyBzdHJpbmcpO1xuICAgICAgaWYgKGV4aXN0c1N5bmMoa2V5UGF0aCkpIHtcbiAgICAgICAgc3NsS2V5ID0gcmVhZEZpbGVTeW5jKGtleVBhdGgsICd1dGYtOCcpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAob3B0aW9ucy5zc2xDZXJ0KSB7XG4gICAgICBjb25zdCBjZXJ0UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnNzbENlcnQgYXMgc3RyaW5nKTtcbiAgICAgIGlmIChleGlzdHNTeW5jKGNlcnRQYXRoKSkge1xuICAgICAgICBzc2xDZXJ0ID0gcmVhZEZpbGVTeW5jKGNlcnRQYXRoLCAndXRmLTgnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25maWcuaHR0cHMgPSB0cnVlO1xuICAgIGlmIChzc2xLZXkgIT0gbnVsbCAmJiBzc2xDZXJ0ICE9IG51bGwpIHtcbiAgICAgIGNvbmZpZy5odHRwcyA9IHtcbiAgICAgICAga2V5OiBzc2xLZXksXG4gICAgICAgIGNlcnQ6IHNzbENlcnQsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2FkZFByb3h5Q29uZmlnKFxuICAgIHJvb3Q6IHN0cmluZyxcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbixcbiAgKSB7XG4gICAgbGV0IHByb3h5Q29uZmlnID0ge307XG4gICAgY29uc3QgcHJveHlQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMucHJveHlDb25maWcgYXMgc3RyaW5nKTtcbiAgICBpZiAoZXhpc3RzU3luYyhwcm94eVBhdGgpKSB7XG4gICAgICBwcm94eUNvbmZpZyA9IHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbWVzc2FnZSA9ICdQcm94eSBjb25maWcgZmlsZSAnICsgcHJveHlQYXRoICsgJyBkb2VzIG5vdCBleGlzdC4nO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgIH1cbiAgICBjb25maWcucHJveHkgPSBwcm94eUNvbmZpZztcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2VydmVQYXRoKG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLCBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEpIHtcbiAgICBsZXQgc2VydmVQYXRoID0gb3B0aW9ucy5zZXJ2ZVBhdGg7XG4gICAgaWYgKCFzZXJ2ZVBhdGggJiYgc2VydmVQYXRoICE9PSAnJykge1xuICAgICAgY29uc3QgZGVmYXVsdFNlcnZlUGF0aCA9XG4gICAgICAgIHRoaXMuX2ZpbmREZWZhdWx0U2VydmVQYXRoKGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmLCBicm93c2VyT3B0aW9ucy5kZXBsb3lVcmwpO1xuICAgICAgY29uc3Qgc2hvd1dhcm5pbmcgPSBvcHRpb25zLnNlcnZlUGF0aERlZmF1bHRXYXJuaW5nO1xuICAgICAgaWYgKGRlZmF1bHRTZXJ2ZVBhdGggPT0gbnVsbCAmJiBzaG93V2FybmluZykge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICAgICAgV0FSTklORzogLS1kZXBsb3ktdXJsIGFuZC9vciAtLWJhc2UtaHJlZiBjb250YWluXG4gICAgICAgICAgICB1bnN1cHBvcnRlZCB2YWx1ZXMgZm9yIG5nIHNlcnZlLiAgRGVmYXVsdCBzZXJ2ZSBwYXRoIG9mICcvJyB1c2VkLlxuICAgICAgICAgICAgVXNlIC0tc2VydmUtcGF0aCB0byBvdmVycmlkZS5cbiAgICAgICAgICBgKTtcbiAgICAgIH1cbiAgICAgIHNlcnZlUGF0aCA9IGRlZmF1bHRTZXJ2ZVBhdGggfHwgJyc7XG4gICAgfVxuICAgIGlmIChzZXJ2ZVBhdGguZW5kc1dpdGgoJy8nKSkge1xuICAgICAgc2VydmVQYXRoID0gc2VydmVQYXRoLnN1YnN0cigwLCBzZXJ2ZVBhdGgubGVuZ3RoIC0gMSk7XG4gICAgfVxuICAgIGlmICghc2VydmVQYXRoLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgICAgc2VydmVQYXRoID0gYC8ke3NlcnZlUGF0aH1gO1xuICAgIH1cblxuICAgIHJldHVybiBzZXJ2ZVBhdGg7XG4gIH1cblxuICBwcml2YXRlIF9maW5kRGVmYXVsdFNlcnZlUGF0aChiYXNlSHJlZj86IHN0cmluZywgZGVwbG95VXJsPzogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKCFiYXNlSHJlZiAmJiAhZGVwbG95VXJsKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgaWYgKC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoYmFzZUhyZWYgfHwgJycpIHx8IC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoZGVwbG95VXJsIHx8ICcnKSkge1xuICAgICAgLy8gSWYgYmFzZUhyZWYgb3IgZGVwbG95VXJsIGlzIGFic29sdXRlLCB1bnN1cHBvcnRlZCBieSBuZyBzZXJ2ZVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gbm9ybWFsaXplIGJhc2VIcmVmXG4gICAgLy8gZm9yIG5nIHNlcnZlIHRoZSBzdGFydGluZyBiYXNlIGlzIGFsd2F5cyBgL2Agc28gYSByZWxhdGl2ZVxuICAgIC8vIGFuZCByb290IHJlbGF0aXZlIHZhbHVlIGFyZSBpZGVudGljYWxcbiAgICBjb25zdCBiYXNlSHJlZlBhcnRzID0gKGJhc2VIcmVmIHx8ICcnKVxuICAgICAgLnNwbGl0KCcvJylcbiAgICAgIC5maWx0ZXIocGFydCA9PiBwYXJ0ICE9PSAnJyk7XG4gICAgaWYgKGJhc2VIcmVmICYmICFiYXNlSHJlZi5lbmRzV2l0aCgnLycpKSB7XG4gICAgICBiYXNlSHJlZlBhcnRzLnBvcCgpO1xuICAgIH1cbiAgICBjb25zdCBub3JtYWxpemVkQmFzZUhyZWYgPSBiYXNlSHJlZlBhcnRzLmxlbmd0aCA9PT0gMCA/ICcvJyA6IGAvJHtiYXNlSHJlZlBhcnRzLmpvaW4oJy8nKX0vYDtcblxuICAgIGlmIChkZXBsb3lVcmwgJiYgZGVwbG95VXJsWzBdID09PSAnLycpIHtcbiAgICAgIGlmIChiYXNlSHJlZiAmJiBiYXNlSHJlZlswXSA9PT0gJy8nICYmIG5vcm1hbGl6ZWRCYXNlSHJlZiAhPT0gZGVwbG95VXJsKSB7XG4gICAgICAgIC8vIElmIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmwgYXJlIHJvb3QgcmVsYXRpdmUgYW5kIG5vdCBlcXVpdmFsZW50LCB1bnN1cHBvcnRlZCBieSBuZyBzZXJ2ZVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRlcGxveVVybDtcbiAgICB9XG5cbiAgICAvLyBKb2luIHRvZ2V0aGVyIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmxcbiAgICByZXR1cm4gYCR7bm9ybWFsaXplZEJhc2VIcmVmfSR7ZGVwbG95VXJsIHx8ICcnfWA7XG4gIH1cblxuICBwcml2YXRlIF9nZXRCcm93c2VyT3B0aW9ucyhvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucykge1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9IHRoaXMuY29udGV4dC5hcmNoaXRlY3Q7XG4gICAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSBvcHRpb25zLmJyb3dzZXJUYXJnZXQuc3BsaXQoJzonKTtcblxuICAgIGNvbnN0IG92ZXJyaWRlcyA9IHtcbiAgICAgIC8vIE92ZXJyaWRlIGJyb3dzZXIgYnVpbGQgd2F0Y2ggc2V0dGluZy5cbiAgICAgIHdhdGNoOiBvcHRpb25zLndhdGNoLFxuXG4gICAgICAvLyBVcGRhdGUgdGhlIGJyb3dzZXIgb3B0aW9ucyB3aXRoIHRoZSBzYW1lIG9wdGlvbnMgd2Ugc3VwcG9ydCBpbiBzZXJ2ZSwgaWYgZGVmaW5lZC5cbiAgICAgIC4uLihvcHRpb25zLm9wdGltaXphdGlvbiAhPT0gdW5kZWZpbmVkID8geyBvcHRpbWl6YXRpb246IG9wdGlvbnMub3B0aW1pemF0aW9uIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy5hb3QgIT09IHVuZGVmaW5lZCA/IHsgYW90OiBvcHRpb25zLmFvdCB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMuc291cmNlTWFwICE9PSB1bmRlZmluZWQgPyB7IHNvdXJjZU1hcDogb3B0aW9ucy5zb3VyY2VNYXAgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLmV2YWxTb3VyY2VNYXAgIT09IHVuZGVmaW5lZCA/IHsgZXZhbFNvdXJjZU1hcDogb3B0aW9ucy5ldmFsU291cmNlTWFwIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy52ZW5kb3JDaHVuayAhPT0gdW5kZWZpbmVkID8geyB2ZW5kb3JDaHVuazogb3B0aW9ucy52ZW5kb3JDaHVuayB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMuY29tbW9uQ2h1bmsgIT09IHVuZGVmaW5lZCA/IHsgY29tbW9uQ2h1bms6IG9wdGlvbnMuY29tbW9uQ2h1bmsgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLmJhc2VIcmVmICE9PSB1bmRlZmluZWQgPyB7IGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy5wcm9ncmVzcyAhPT0gdW5kZWZpbmVkID8geyBwcm9ncmVzczogb3B0aW9ucy5wcm9ncmVzcyB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMucG9sbCAhPT0gdW5kZWZpbmVkID8geyBwb2xsOiBvcHRpb25zLnBvbGwgfSA6IHt9KSxcbiAgICB9O1xuXG4gICAgY29uc3QgYnJvd3NlclRhcmdldFNwZWMgPSB7IHByb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbiwgb3ZlcnJpZGVzIH07XG4gICAgY29uc3QgYnVpbGRlckNvbmZpZyA9IGFyY2hpdGVjdC5nZXRCdWlsZGVyQ29uZmlndXJhdGlvbjxCcm93c2VyQnVpbGRlclNjaGVtYT4oXG4gICAgICBicm93c2VyVGFyZ2V0U3BlYyk7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihidWlsZGVyQ29uZmlnKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGJyb3dzZXJEZXNjcmlwdGlvbiA9PlxuICAgICAgICBhcmNoaXRlY3QudmFsaWRhdGVCdWlsZGVyT3B0aW9ucyhidWlsZGVyQ29uZmlnLCBicm93c2VyRGVzY3JpcHRpb24pKSxcbiAgICAgIG1hcChicm93c2VyQ29uZmlnID0+IGJyb3dzZXJDb25maWcub3B0aW9ucyksXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFbGVjdHJvbkRldlNlcnZlckJ1aWxkZXI7Il19