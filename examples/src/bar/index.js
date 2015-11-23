/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';

var css = require('./index.css');


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
  node.className = 'barContent';
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
