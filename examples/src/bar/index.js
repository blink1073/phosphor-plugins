/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';


/**
 * Create the receiver for the `my-bar:bar-point` extension point.
 *
 * The returned object must implement the `IReceiver` interface. If an
 * asynchronous task must be run before the receiver can be created, a
 * `Promise` which resolves to a receiver can be returned.
 */
function createBarReceiver() {
  return {
    add: function(extension) {
      console.log('Add to `my-bar:bar-point`:', extension);
    },
    remove: function(id) {
      console.log('Remove from `my-bar:bar-point`:', id);
    },
    dispose: function() {
      console.log('Dispose `my-bar:bar-point`');
    },
  };
}

exports.createBarReceiver = createBarReceiver;


/**
 * Create the contribution for the `my-foo:foo-point` extension point.
 *
 * The returned object must implement the `IContrib` interface. If an
 * asynchronous task must be run before the contrib can be created, a
 * `Promise` which resolves to a contrib can be returned.
 */
function createFooContrib() {
  var node = document.createElement('div');
  node.className = 'bar-content';
  node.textContent = 'Bar Contribution to Foo';
  return {
    item: node,
    dispose: function() {
      console.log('Dispose `my-bar:bar-ext-0`');
      var parent = node.parentNode;
      if (!parent) {
        console.log('Node already disposed');
      } else {
        parent.removeChild(node);
      }
    },
  };
}

exports.createFooContrib = createFooContrib;



function createCSSReceiver() {
    return {
        add: function (extension) {
            var path = '';
            if (extension.item &&
                extension.item.path &&
                extension.item.hasOwnProperty('path')) {
                path = extension.item.path;
            }
            else if (extension.config &&
                extension.config.path &&
                extension.config.hasOwnProperty('path')) {
                path = extension.config.path;
            }
            else if (extension.data &&
                extension.data.path &&
                extension.data.hasOwnProperty('path')) {
                path = extension.data.path;
            }
            if (path)
                System.normalize(path).then(function(newPath) {
                  newPath = newPath.replace('!$css', '');
                  var link = document.createElement('link');
                  link.rel = 'stylesheet';
                  link.href = newPath;
                  document.head.appendChild(link);
                  cssRegistry.set(extension.id, link.href);
                });
        },
        remove: function (id) {
            var path = cssRegistry.get(id);
            console.log(path);
            if (path) {
                removeCSS(path);
                cssRegistry.delete(id);
            }
        },
        dispose: function () {
            cssRegistry.forEach(removeCSS);
            cssRegistry = new Map();
        }
    };
}
exports.createCSSReceiver = createCSSReceiver;
/**
 * Remove CSS from the DOM by `href` path.
 */
function removeCSS(path) {
    var nodes = document.getElementsByTagName('link');
    for (var i = 0; i < nodes.length; i++) {
        console.log(nodes[i].href);
        if (nodes[i].href === path) {
            nodes[i].parentNode.removeChild(nodes[i]);
        }
    }
}
// css registry
var cssRegistry = new Map();
