# Angular 6 cli devkit for electron
Allows targeting electron renderer in Angular 6 applications.

## Installation
npm install ng-electron-devkit --save-dev

## Configuration

1. Install electron and cpx in your project
```sh 
npm install electron --save
npm install cpx --save-dev
```

2. Create electron main application (src/electron/index.ts)
```typescript
import {app, BrowserWindow, ipcMain} from 'electron';

if (process.mas) app.setName('Angular 6 / Electron Demo')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  console.log('activated');
  if (mainWindow === null) {
    createWindow()
  }
})
```

3. Create tsconfig.json for electron main application (src/electron/tsconfig.json). Note: outDir must resolve to the same path that outputPath does in step #10  
```json
{
  "compilerOptions": {
    "target": "es6",
    "module": "commonjs",
    "outDir": "../../dist/electron",
    "strict": false,
    "esModuleInterop": true
  }
}
```

4. Add isElectron: false value to src/environments/environment.ts and src/environments/environment.prod.ts

5. Add default electron environment (src/environments/environment.electron.ts)
```typescript
// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  isElectron: true
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
import 'zone.js/dist/zone-error';  // Included with Angular CLI.
```

6. Add production electron environment (src/environments/environment.electron-prod.ts)
```typescript
export const environment = {
  production: true,
  isElectron: true
};
```

7. Electron does not support reloading html5 routes. Check to see if we are running in electron and set routing to use hash. Update src/app/app-routing.module.ts
```typescript
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { environment } from '../environments/environment';

const routes: Routes = [];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: environment.isElectron })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

8. Create new electron specific polyfill file (src/polyfills-electron.ts)
```typescript
/**
 * This file includes polyfills needed by Angular and is loaded before the app.
 * You can add your own extra polyfills to this file.
 *
 * This file is divided into 2 sections:
 *   1. Browser polyfills. These are applied before loading ZoneJS and are sorted by browsers.
 *   2. Application imports. Files imported after ZoneJS that should be loaded before your main
 *      file.
 *
 * The current setup is for so-called "evergreen" browsers; the last versions of browsers that
 * automatically update themselves. This includes Safari >= 10, Chrome >= 55 (including Opera),
 * Edge >= 13 on the desktop, and iOS 10 and Chrome on mobile.
 *
 * Learn more in https://angular.io/docs/ts/latest/guide/browser-support.html
 */

/***************************************************************************************************
 * BROWSER POLYFILLS
 */

/** IE9, IE10 and IE11 requires all of the following polyfills. **/
// import 'core-js/es6/symbol';
// import 'core-js/es6/object';
// import 'core-js/es6/function';
// import 'core-js/es6/parse-int';
// import 'core-js/es6/parse-float';
// import 'core-js/es6/number';
// import 'core-js/es6/math';
// import 'core-js/es6/string';
// import 'core-js/es6/date';
// import 'core-js/es6/array';
// import 'core-js/es6/regexp';
// import 'core-js/es6/map';
// import 'core-js/es6/weak-map';
// import 'core-js/es6/set';

/** Evergreen browsers require these. **/
// Used for reflect-metadata in JIT. If you use AOT (and only Angular decorators), you can remove.
import 'core-js/es7/reflect';


/**
 * Web Animations `@angular/platform-browser/animations`
 * Only required if AnimationBuilder is used within the application and using IE/Edge or Safari.
 * Standard animation support in Angular DOES NOT require any polyfills (as of Angular 6.0).
 **/
// import 'web-animations-js';  // Run `npm install --save web-animations-js`.

/**
 * By default, zone.js will patch all possible macroTask and DomEvents
 * user can disable parts of macroTask/DomEvents patch by setting following flags
 */

 // (window as any).__Zone_disable_requestAnimationFrame = true; // disable patch requestAnimationFrame
 // (window as any).__Zone_disable_on_property = true; // disable patch onProperty such as onclick
 // (window as any).__zone_symbol__BLACK_LISTED_EVENTS = ['scroll', 'mousemove']; // disable patch specified eventNames

 /*
 * in IE/Edge developer tools, the addEventListener will also be wrapped by zone.js
 * with the following flag, it will bypass `zone.js` patch for IE/Edge
 */
// (window as any).__Zone_enable_cross_context_check = true;

/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
import 'zone.js/dist/zone-mix';  // Included with Angular CLI.
import 'zone.js/dist/zone-patch-electron';



/***************************************************************************************************
 * APPLICATION IMPORTS
 */
```

9. Update scripts in package.json to build electron project
```json
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "start:electron": "electron dist/electron",
    "build": "ng build",
    "build:electron-main": "tsc -p src/electron",
    "postbuild:electron-main": "cpx package.json dist/electron",
    "build:electron-renderer": "ng build electron",
    "build:electron": "npm run build:electron-renderer && npm run build:electron-main",
    "test": "ng test",
    "lint": "ng lint",
    "e2e": "ng e2e"
  },
```

10. Create a new project config in ***angular.json***. 
    - Copy contents from initial project
    - Rename the project to electron
    - Change ***architect/build/builder*** from ***@angular-devkit/build-angular:browser*** to *ng-electron-devkit:renderer*
    - Change ***architect/build/options/outputPath*** to dist/electron
    - Create default environment for electron project ***architect/build/options/fileReplacements***
    ```json
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.electron.ts"
      }
    ]
    ```
    - Remove serve section / property 
    - (OPTIONAL) If using routing set ***architect/build/options/baseRef*** to an empty string.

Sample angular.json electron project
```json
    "electron": {
      "root": "",
      "sourceRoot": "src",
      "projectType": "application",
      "prefix": "app",
      "schematics": {
        "@schematics/angular:component": {
          "styleext": "scss"
        }
      },
      "architect": {
        "build": {
          "builder": "ng-electron-devkit:renderer",
          "options": {
            "outputPath": "dist/electron",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": "src/polyfills-electron.ts",
            "tsConfig": "src/tsconfig.app.json",
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ],
            "styles": [
              "src/styles.scss"
            ],
            "scripts": [],
            "baseHref": "",
            "fileReplacements": [
              {
                "replace": "src/environments/environment.ts",
                "with": "src/environments/environment.electron.ts"
              },
              {
                "replace": "src/app/ipc.service.ts",
                "with": "src/app/ipc.service-electron.ts"
              }
            ]
          },
          "configurations": {
            "production": {
              "fileReplacements": [
                {
                  "replace": "src/environments/environment.ts",
                  "with": "src/environments/environment.electron-prod.ts"
                }
              ],
              "optimization": true,
              "outputHashing": "all",
              "sourceMap": false,
              "extractCss": true,
              "namedChunks": false,
              "aot": true,
              "extractLicenses": true,
              "vendorChunk": false,
              "buildOptimizer": true
            }
          }
        },
        "extract-i18n": {
          "builder": "@angular-devkit/build-angular:extract-i18n",
          "options": {
            "browserTarget": "sample:build"
          }
        },
        "test": {
          "builder": "@angular-devkit/build-angular:karma",
          "options": {
            "main": "src/test.ts",
            "polyfills": "src/polyfills.ts",
            "tsConfig": "src/tsconfig.spec.json",
            "karmaConfig": "src/karma.conf.js",
            "styles": [
              "src/styles.scss"
            ],
            "scripts": [],
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ]
          }
        },
        "lint": {
          "builder": "@angular-devkit/build-angular:tslint",
          "options": {
            "tsConfig": [
              "src/tsconfig.app.json",
              "src/tsconfig.spec.json"
            ],
            "exclude": [
              "**/node_modules/**"
            ]
          }
        }
      }
    }
```

11. Add main property to package.json
```json
"main": "index.js"
```

12. Build your project
```sh
npm run build:electron
```

12. Launch your electron application!!!!
```sh
npm run start:electron
```

## Sample Application

Close this repository and checkout the [sample](./sample)