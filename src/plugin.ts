/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';

import {
  IDisposable, DisposableSet
} from 'phosphor-disposable';

import {
  IExtensionJSON, IExtensionPointJSON, loadExtension, loadExtensionPoint
} from './extension';


export
interface IPluginJSON {
  /**
   * The path to the javascript module for the plugin.
   *
   * This path is relative to the `package.json`.
   *
   * If not given, it will default to the top-level `package.json` main.
   */
  module?: string;

  /**
   * The name of the initialization function in the plugin `main` module.
   *
   * When the plugin is loaded, this function will be called to
   * return a Promise<Disposable> object.
   */
  initializer?: string;

  /**
   * The extension points provided by the plugin.
   *
   * Other plugins may contribute extensions to these extension points.
   */
  extensionPoints?: IExtensionPointJSON[];

  /**
   * The extensions provided by the plugin.
   *
   * These are contributions to extension points of other plugins.
   */
  extensions?: IExtensionJSON[];
}


/**
 * Implementation of a Plugin.
 */
class Plugin implements IDisposable {

  /**
   * Construct a new plugin.
   */
  constructor(name: string, options: IPluginJSON) {
    this._module = name + '/' + options.module;
    this._name = name;
    this._initializer = options.initializer;
    if (options.extensionPoints) {
      this._extensionPoints = options.extensionPoints.slice();
    }
    if (options.extensions) {
      this._extensions = options.extensions.slice();
    }
    this._disposables = new DisposableSet();
  }

  /**
   * Whether the plugin has been disposed.
   */
  get isDisposed(): boolean {
    return this._disposables.isDisposed;
  }

  /**
   * Dispose of the resources held by the plugin.
   */
  dispose() {
    this._extensions = null;
    this._extensionPoints = null;
    this._disposables.dispose();
  }

  /**
   * Load the plugin.
   */
  load(): Promise<void> {
    var promises: Promise<void>[] = []
    if (this._extensionPoints) {
      this._extensionPoints.map(point => {
        promises.push(this._loadExtensionPoint(point));
      });
    }
    if (this._extensions) {
      this._extensions.map(ext => {
        promises.push(this._loadExtension(ext));
      });
    }
    return Promise.all(promises).then(() => this._initialize.bind(this));
  }

  /**
   * Load an extension point.
   */
  private _loadExtensionPoint(point: IExtensionPointJSON): Promise<void> {
     if (point.hasOwnProperty('module') || (point.module)) {
      point.module = this._name + '/' + point.module;
    } else {
      point.module = this._module;
    }
    return loadExtensionPoint(point).then(result => {
      if (result.hasOwnProperty('dispose')) {
        this._disposables.add(result);
      }
    }).catch((error: any) => { console.error(error); });
  }

  /**
   * Load an extension.
   */
  private _loadExtension(extension: IExtensionJSON): Promise<void> {
    if (extension.hasOwnProperty('module') || (extension.module)) {
      extension.module = this._name + '/' + extension.module;
    } else {
      extension.module = this._module;
    }
    if (extension.hasOwnProperty('data') || (extension.data)) {
      extension.data = this._name + '/' + extension.data;
    }
    return loadExtension(extension).then(result => {
      if (result.hasOwnProperty('dispose')) {
        this._disposables.add(result);
      }
    }).catch((error: any) => { console.error(error); });
  }

  /**
   * Initialize the plugin.
   */
  private _initialize(): Promise<void> {
    this._extensionPoints = [];
    this._extensions = [];
    if (this._initializer) {
      return System.import(this._module).then(mod => {
        var initializer = mod[this._initializer];
        var disposable = initializer();
        if (disposable.hasOwnProperty('dispose')) {
          this._disposables.add(disposable);
        }
      }).catch((error: any) => { console.error(error); });
    } else {
      return Promise.resolve(void 0);
    }
  }

  private _name = '';
  private _module = '';
  private _initializer = '';
  private _extensionPoints: IExtensionPointJSON[] = null;
  private _extensions: IExtensionJSON[] = null;
  private _disposables: DisposableSet = null;
}


/**
 * Get a list of available plugin names.
 */
export
function listPlugins(): string[] {
  return Object.keys(availablePlugins);
}


/**
 * Fetch the available plugins.
 *
 * Can be called more than once to update the available plugins.
 */
export
function fetchPlugins(): Promise<void> {
  if (Object.keys(availablePlugins).length) {
    System.delete('package.json!npm');
    return System.import('package.json!npm').then(gatherPlugins);
  } else {
    availablePlugins = { };
    return gatherPlugins();
  };
}

/**
 * Load a plugin by name.
 *
 * Load all extension points and extensions, then call `initialize`.
 *
 * Throws an error if the plugin is not in the registry.
 */
export
function loadPlugin(name: string): Promise<void> {
  var plugin = availablePlugins[name];
  if (!plugin) throw Error('Plugin not in registry');
  delete availablePlugins[name];
  loadedPlugins[name] = plugin;
  return plugin.load();
}


/**
 * Unload a plugin by name, disposing of its resources.
 *
 * This is a no-op if the plugin has not been loaded or has already
 * been unloaded.
 */
export
function unloadPlugin(name: string): void {
  var plugin = loadedPlugins[name];
  if (plugin) plugin.dispose();
}


/**
 * Gather all available plugins.
 *
 * This is a no-op if the plugins have already been gathered.
 */
function gatherPlugins(): Promise<void> {
  var promises: Promise<void>[] = [];
  getPluginNames().map(name => {
    promises.push(loadPackage(name));
  });
  return Promise.all(promises).then(() => { });
}


/**
 * Get a list of all plugin names.
 */
function getPluginNames(): string[] {
  var names: string[] = []
  // fetch the metadata about available packages
  Object.keys(System.npm).map((key) => {
    var obj = System.npm[key];
    if ((name in availablePlugins) || (name in loadedPlugins)) {
      return;
    }
    // check for one occurrence of `node_modules` in the fileUrl
    var fileUrl = obj.fileUrl;
    var index = fileUrl.indexOf('node_modules');
    var lastIndex = fileUrl.lastIndexOf('node_modules');
    if (index > 0 && index === lastIndex) {
      names.push(obj.name);
    }
  });
  return names;
}


/**
 * Load a package by name and add to plugin registry if valid plugin.
 */
function loadPackage(name: string): Promise<void> {
  return System.import(name + '/package.json').then(config => {
     addPackage(name, config);
  }).catch((error: any) => { console.error(error); });
}


/**
 * Add a package to the registry if valid.
 */
function addPackage(name: string, config: any) {
  if (config.hasOwnProperty('phosphor-plugin')) {
    var pconfig = config["phosphor-plugin"] as IPluginJSON;
    pconfig.module = pconfig.module || config.main;
    availablePlugins[name] = new Plugin(name, pconfig);
  }
}


// Map of available plugins by name.
var availablePlugins: { [key: string]: Plugin } = { };

// map of loaded plugins by name.
var loadedPlugins: { [key: string]: Plugin } = { };
