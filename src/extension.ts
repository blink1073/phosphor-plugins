/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';

import {
  IDisposable, DisposableDelegate, DisposableSet
} from 'phosphor-disposable';


export
interface IExtensionJSON {
  /**
   * The id of the extension point to which the extension contributes.
   */
  point: string;

  /**
   * The name of the loader function in the plugin `main` module.
   *
   * When the extension is loaded, this function will be called to
   * return a Promise which resolves to the actual extension object
   * to contribute to the extension point.
   */
  loader?: string;

  /**
   * The path to the JSON data file for the extension.
   *
   * Some extension points (like menus and keymaps) can make use of
   * data defined as JSON. This path will be used to load the JSON
   * and provide it to the extension point.
   */
  data?: string;

  /**
   * Extra configuration data for the extension.
   *
   * Some extension points can make use of extra static declarative
   * data associated with an extension. That data goes here in the
   * form of a JSON object.
   */
  config?: any;

  /**
   * The path to the javascript module for the extension.
   *
   * This path is relative to the `package.json`.
   *
   * If not given, it will default to plugin main file.
   */
   module?: string;

  /**
   * The name of the initialization function for the extension.
   *
   * When the extension is loaded, this function will be called to
   * return a Promise<Disposable> object.
   */
  initializer?: string;
}


export
interface IExtensionPointJSON {
  /**
   * The unique id of the extension point.
   *
   * This should be namespaced: "my-plugin:extension-point-name".
   */
  id: string;

  /**
   * The name of the receiver function in the plugin `main` module.
   *
   * When an extension is loaded for this extension point, this
   * function will be invoked with an `IExtension` object.
   */
  receiver: string;

  /**
   * The path to the javascript module for the extension point.
   *
   * This path is relative to the `package.json`.
   *
   * If not given, it will default to plugin main file.
   */
   module?: string;

  /**
   * The name of the initialization function for the extension point.
   *
   * When the extension point is loaded, this function will be called to
   * return a Promise<Disposable> object.
   */
  initializer?: string;
}


export
interface IExtension<T> {
  /**
   * The actual extension object.
   *
   * This is the result of resolving the Promise returned by
   * the loader function specified by the extension JSON.
   *
   * This will be `null` if the extension does not specify a loader.
   */
  object: T;

  /**
   * The loaded JSON specified by the extension.
   *
   * This is the result of calling `JSON.parse` on the data file
   * specified by the extension JSON.
   *
   * This will be `null` if the extension does not specify a data file.
   */
  data: any;

  /**
   * The config specified by the extension.
   *
   * This will be the object representation of the config specified
   * in the extension JSON.
   *
   * This will be `null` if the extension does not specify a data file.
   */
  config: any;
}


/**
 * Implementation of an Extension Point.
 */
export
class ExtensionPoint implements IDisposable {

  /**
   * Validate an options object for consistency with IExtensionPointJSON.
   */
  static validate(name: string, options: IExtensionPointJSON, promises: any[]): boolean {
    if (!(options.hasOwnProperty('id') || options.id)) {
      throw new Error("Plugins: extension point requires `id`");
    }
    if (typeof options.id !== "string") {
      throw new Error("Plugins: extension point `id` must be string");
    }

    if (!(options.hasOwnProperty('receiver') || options.receiver)) {
      return false;
    }
    if (typeof options.receiver !== "string") {
      return false;
    }

    if (options.hasOwnProperty('module') || options.module) {
      if (typeof options.module !== "string") {
        return false;
      }
    }
    var mod = options.module || name;

    if (options.hasOwnProperty('initializer') || options.initializer) {
      if (typeof options.initializer !== "string") {
        return false;
      }

      promises.push(System.import(mod)
        .then(mod => {
          var init = mod[options.initializer];
          if (!(typeof init === 'function')) { throw ""; }
        })
        .catch((error: any) => {
          throw new Error(mod + "Extension point failure, initializer not callable");
        })
      );

    }

    promises.push(System.import(mod)
      .then(mod => {
        var receiver = mod[options.receiver];
        if (!(typeof receiver === 'function')) { throw ""; }
      })
      .catch((error: any) => {
        throw new Error(mod + ": Extension point failure, receiver not callable.");
      })
    );

    var fields = ['id', 'receiver', 'module', 'initializer'];
    for (var item in options) {
      if (fields.indexOf(item) < 0) {
        return false;
      }
    }

  }

  /**
   * Construct a new extension point.
   */
  constructor(options: IExtensionPointJSON) {
    this._id = options.id;
    this._receiver = options.receiver;
    this._module = options.module;
    this._initializer = options.initializer;
    this._disposables = new DisposableSet();
  }

  /**
   * Whether the extension point has been disposed.
   */
  get isDisposed(): boolean {
    return this._disposables.isDisposed;
  }

  /**
   * Dispose of the resources held by the extension point.
   */
  dispose() {
    allExtensionPoints.delete(this._id);
    this._receiverFunc = null;
    this._disposables.dispose();
  }

  /**
   * Connect an extension to the extension point.
   */
  connect(extension: Extension): Promise<void> {
    console.log('connecting to', this._id);
    if (!this._initialized) {
      return this._load().then(() => this._connectExtension(extension));
    } else {
      return this._connectExtension(extension);
    }
  }

  /**
   * Load the extension point.
   */
  private _load(): Promise<void> {
    return System.import(this._module).then(mod => {
      this._receiverFunc = mod[this._receiver].bind(this);
      return this._initialize();
    });
  }

  /**
   * Initialize the extension point.
   */
  private _initialize(): Promise<void> {
    if ((this._initialized) || (!this._initializer)) {
      this._initialized = true;
      return Promise.resolve(void 0);
    }
    this._initialized = true;
    return System.import(this._module).then(mod => {
      return mod[this._initializer]().then((result: IDisposable) => {
        if (result.hasOwnProperty('dispose')) {
          this._disposables.add(result);
        }
      });
    });
  }

  /**
   * Finish connecting an extension to the extension point.
   */
  private _connectExtension(extension: Extension): Promise<void> {
    var receiver = this._receiverFunc;
    return extension.load().then((result: IExtension<any>) => {
      var disposable = receiver(result);
      if (disposable.hasOwnProperty('dispose')) {
         this._disposables.add(disposable);
      }
      return extension.initialize();
    });
  }

  private _id = '';
  private _receiver = '';
  private _module = '';
  private _initializer = '';
  private _initialized = false;
  private _receiverFunc: (extension: IExtension<any>) => IDisposable = null;
  private _disposables: DisposableSet = null;
}


/**
 * Implementation of an Extension.
 */
export
class Extension implements IDisposable {

  /**
   * Validate an options object for consistency with IExtensionJSON.
   */
  static validate(options: IExtensionJSON): boolean {
    if (!(options.hasOwnProperty('point') || options.point)) {
      return false;
    }
    if (typeof options.point !== "string") {
      return false;
    }

    if (options.hasOwnProperty('loader') || options.loader) {
      if (typeof options.loader !== "string") {
        return false;
      }
    }

    if (options.hasOwnProperty('data') || options.data) {
      if (typeof options.data !== "string") {
        return false;
      }
    }

    if (options.hasOwnProperty('module') || options.module) {
      if (typeof options.module !== "string") {
        return false;
      }
    }

    if (options.hasOwnProperty('initializer') || options.initializer) {
      if (typeof options.initializer !== "string") {
        return false;
      }
    }

    var fields = ['point', 'loader', 'config', 'module', 'data', 'initializer'];
    for (var item in options) {
      if (fields.indexOf(item) < 0) {
        return false;
      }
    }
  }

  /**
   * Construct a new Extension.
   */
  constructor(options: IExtensionJSON) {
    this._point = options.point;
    this._loader = options.loader;
    this._module = options.module;
    this._data = options.data;
    this._extension = { 
      config: options.config,
      data: void 0,
      object: void 0
    };
    this._initializer = options.initializer;
    this._disposables = new DisposableSet();
  }

  /**
   * Whether the extension has been disposed.
   */
  get isDisposed(): boolean {
    return this._disposables.isDisposed;
  }

  /**
   * Dispose of the resources held by the extension.
   */
  dispose() {
    this._extension = null;
    this._disposables.dispose();
  }

  /**
   * Initialize the the extension.
   */
  initialize(): Promise<void> {
    this._extension = null;
    if (this._initializer) {
      return System.import(this._module).then(mod => {
        var initializer = mod[this._initializer];
        return initializer().then((disposable: IDisposable) => {
          if (disposable.hasOwnProperty('dispose')) {
            this._disposables.add(disposable);
          }
        });
      });
    } else {
      return Promise.resolve(void 0);
    }
  }

  /**
   * Load the extension.
   */
  load(): Promise<IExtension<any>> {
    return Promise.all([this._loadData(), this._loadObject()])
      .then(() => { return this._extension; });
  }

  /**
   * Load the data for the extension.
   */
  private _loadData(): Promise<void> {
    if (!this._data) {
      return Promise.resolve(void 0);
    }
    return System.import(this._data).then(data => {
      this._extension.data = data;
    });
  }

  /**
   * Load the object for the extension.
   */
  private _loadObject(): Promise<void> {
    if (!this._loader) {
      return Promise.resolve(void 0);
    }
    return System.import(this._module).then(mod => { 
      var loader = mod[this._loader] as (() => Promise<any>);
      return loader().then((result: any) => {
        this._extension.object = result;
      });
    });
  }

  private _point = '';
  private _loader = '';
  private _module = '';
  private _data = '';
  private _initializer = '';
  private _extension: IExtension<any> = null;
  private _disposables: DisposableSet = null;
}


/**
 * Load an extension point, connecting any existing matching extensions.
 */
export
function loadExtensionPoint(config: IExtensionPointJSON): Promise<IDisposable> {
  var point = new ExtensionPoint(config);
  allExtensionPoints.set(config.id, point);
  var extensions = allExtensions.get(config.id);
  if (!extensions) {
    return Promise.resolve(point);
  }
  allExtensions.delete(config.id);
  var promises: Promise<void>[] = [];
  extensions.map(ext => {
    promises.push(point.connect(ext));
  });
  return Promise.all(promises).then(() => { return point; });
}


/**
 * Load an extension, connecting to the corresponding extension point exists.
 */
export
function loadExtension(config: IExtensionJSON): Promise<IDisposable> {
  var extension = new Extension(config);
  var point = allExtensionPoints.get(config.point);
  if (point) {
    return point.connect(extension).then(() => { return extension; });
  }
  var extensions = allExtensions.get(config.point) || [];
  extensions.push(extension);
  allExtensions.set(config.point, extensions);
  return Promise.resolve(extension);
}


// Map of available extension points by point id.
var allExtensionPoints = new Map<string, ExtensionPoint>();

// Map of available extensions by point id.
var allExtensions = new Map<string, Extension[]>();
