import {
  AssetPattern,
  Budget,
  ExtraEntryPoint,
  FileReplacements,
  OutputHashing,
  StylePreprocessorOptions
} from '@angular-devkit/build-angular/src/browser/schema';

export interface ElectronBuilderSchema {
  /**
   * List of static application assets.
   */
  assets: AssetPattern[];

  /**
   * Replace files with other files in the build.
   */
  fileReplacements: FileReplacements[];

  /**
   * Path where output will be placed.
   */
  outputPath: string;

  /**
   * Adds more details to output logging.
   */
  verbose: boolean;

  /**
   * Log progress to the console while building.
   */
  progress: boolean;

  /**
   * Run build when files change.
   */
  watch: boolean;

  /**
   * Enable and define the file watching poll time period in milliseconds.
   */
  poll?: number;

  /**
   * Delete the output path before building.
   */
  deleteOutputPath: boolean;

  /**
   * Extract all licenses in a separate file, in the case of production builds only.
   */
  extractLicenses: boolean;

  /**
   * Show circular dependency warnings on builds.
   */
  showCircularDependencies: boolean;

  /**
   * Generates a 'stats.json' file which can be analyzed using tools
   * such as: #webpack-bundle-analyzer' or https: //webpack.github.io/analyse.
   */
  statsJson: boolean;

  /**
   * Electron renderer config.
   */
  renderer: RendererBuilderSchema;

  /**
   * Electron main config.
   */
  main: MainBuilderSchema;  
}

export interface RendererBuilderSchema {

  /**
   * The name of the main entry-point file.
   */
  main: string;

  /**
   * The name of the polyfills file.
   */
  polyfills?: string;

  /**
   * The name of the TypeScript configuration file.
   */
  tsConfig: string;

  /**
   * Global scripts to be included in the build.
   */
  scripts: ExtraEntryPoint[];

  /**
   * Global styles to be included in the build.
   */
  styles: ExtraEntryPoint[];

  /**
   * Options to pass to style preprocessors.
   */
  stylePreprocessorOptions?: StylePreprocessorOptions;

  /**
   * Defines the optimization level of the build.
   */
  optimization: boolean;

  /**
   * Build using Ahead of Time compilation.
   */
  aot: boolean;

  /**
   * Output sourcemaps.
   */
  sourceMap: boolean;

  /**
   * Resolve vendor packages sourcemaps.
   */
  vendorSourceMap?: boolean;

  /**
   * Output in-file eval sourcemaps.
   */
  evalSourceMap: boolean;

  /**
   * Use a separate bundle containing only vendor libraries.
   */
  vendorChunk: boolean;

  /**
   * Use a separate bundle containing code used across multiple bundles.
   */
  commonChunk: boolean;

  /**
   * Base url for the application being built.
   */
  baseHref?: string;

  /**
   * URL where files will be deployed.
   */
  deployUrl?: string;

  /**
   * Localization file to use for i18n.
   */
  i18nFile?: string;

  /**
   * Format of the localization file specified with --i18n-file.
   */
  i18nFormat?: string;

  /**
   * Locale to use for i18n.
   */
  i18nLocale?: string;

  /**
   * How to handle missing translations for i18n.
   */
  i18nMissingTranslation?: string;

  /**
   * Extract css from global styles onto css files instead of js ones.
   */
  extractCss: boolean;

  /**
   * Define the output filename cache-busting hashing mode.
   */
  outputHashing: OutputHashing;

  /**
   * Do not use the real path when resolving modules.
   */
  preserveSymlinks: boolean;

  /**
   * Enables @angular-devkit/build-optimizer optimizations when using the 'aot' option.
   */
  buildOptimizer: boolean;

  /**
   * Use file name for lazy loaded chunks.
   */
  namedChunks: boolean;

  /**
   * Enables the use of subresource integrity validation.
   */
  subresourceIntegrity: boolean;

  /**
   * Generates a service worker config for production builds.
   */
  serviceWorker: boolean;

  /**
   * Path to ngsw-config.json.
   */
  ngswConfigPath?: string;

  /**
   * Flag to prevent building an app shell.
   */
  skipAppShell: boolean;

  /**
   * The name of the index HTML file.
   */
  index: string;

  /**
   * Run the TypeScript type checker in a forked process.
   */
  forkTypeChecker: boolean;

  /**
   * List of additional NgModule files that will be lazy loaded.
   * Lazy router modules with be discovered automatically.
   */
  lazyModules: string[];

  /**
   * Budget thresholds to ensure parts of your application stay within boundaries which you set.
   */
  budgets: Budget[];
}

export interface MainBuilderSchema {

  /**
   * The name of the main entry-point file.
   */
  main: string;

  /**
   * The name of the TypeScript configuration file.
   */
  tsConfig: string;

  /**
   * Output sourcemaps.
   */
  sourceMap: boolean;

  /**
   * Do not use the real path when resolving modules.
   */
  preserveSymlinks: boolean;

  /**
   * Run the TypeScript type checker in a forked process.
   */
  forkTypeChecker: boolean;
}
