# Jsenv node module import map

[![github package](https://img.shields.io/github/package-json/v/jsenv/jsenv-node-module-import-map.svg?logo=github&label=package)](https://github.com/jsenv/jsenv-node-module-import-map/packages)
[![npm package](https://img.shields.io/npm/v/@jsenv/node-module-import-map.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/node-module-import-map)
[![github ci](https://github.com/jsenv/jsenv-node-module-import-map/workflows/ci/badge.svg)](https://github.com/jsenv/jsenv-node-module-import-map/actions?workflow=ci)
[![codecov coverage](https://codecov.io/gh/jsenv/jsenv-node-module-import-map/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-node-module-import-map)

Generate importMap for a project node modules.

## Table of contents

- [Presentation](#Presentation)
- [How it works](#how-it-works)
- [Code example](#code-example)
- [API](./docs/api.md)
- [Concrete example](#concrete-example)
  - [Step 1 - Setup basic project](#step-1---setup-project)
  - [Step 2 - Generate project importMap](#step-2---generate-project-importMap)
- [Custom node module resolution](#custom-node-module-resolution)
- [Installation](#installation-using-npm)

## Presentation

`@jsenv/node-module-import-map` generates importMap for your project node_modules.<br />
— see [importMap spec](https://github.com/WICG/import-maps)

## How it works

Reads `package.json` and recursively try to find your dependencies.<br />

Be sure node modules are on your filesystem because we'll use the filesystem structure to generate the importMap. For that reason, you must use it after `npm install` or anything that is responsible to generate the node_modules folder and its content on your filesystem.<br />

## Code example

Here is code example using `@jsenv/node-module-import-map` to create an `importMap.json` file.

```js
const { generateImportMapForProjectPackage } = require("@jsenv/node-module-import-map")

generateImportMapForProjectPackage({
  projectDirectoryUrl: "file:///Users/you/folder/",
  includeDevDependencies: true,
  importMapFile: true,
  importMapFileRelativeUrl: "./importMap.json",
})
```

For more information check the [api documentation](./docs/api.md).

## Concrete example

This part explains how to setup a real environment to see `@jsenv/node-module-import-map` in action.
It reuses a preconfigured project where you can generate import map file.

### Step 1 - Setup basic project

```console
git clone https://github.com/jsenv/jsenv-node-module-import-map.git
```

```console
cd ./jsenv-node-module-import-map/docs/basic-project
```

```console
npm install
```

### Step 2 - Generate project importMap

Running command below will generate import map file at `docs/basic-project/importMap.json`.

```console
node ./generate-import-map.js
```

## Custom node module resolution

`@jsenv/node-module-import-map` uses a custom node module resolution.<br />
— see [node module resolution on node.js](https://nodejs.org/api/modules.html#modules_all_together)

It behaves as Node.js with one big change:

> A node module will not be found if it is outside your project folder.

We do this because importMap are used on the web where a file outside project folder would fail.<br/>

And here is why:

You have a server at `https://example.com` serving files inside `/Users/you/project`.<br />
Your project uses a file outside of your project folder like `/Users/you/node_modules/whatever/index.js`.

From a filesystem perspective we could find file using `../node_modules/whatever/index.js`.<br />
For a web client however `../node_modules/whatever/index.js` resolves to `https://example.com/node_modules/whatever/index.js`. Server would be requested at that url searching for `/Users/you/project/node_modules/whatever/index.js` instead of `/Users/you/node_modules/whatever/index.js`.

In practice it does not impact you because node modules are inside your project folder. If not, explicitely write your dependencies in your `package.json` and run `npm install`.

## Installation

If you never installed a jsenv package, read [Installing a jsenv package](https://github.com/jsenv/jsenv-core/blob/master/docs/installing-jsenv-package.md#installing-a-jsenv-package) before going further.

This documentation is up-to-date with a specific version so prefer any of the following commands

```console
npm install --save-dev @jsenv/node-module-import-map@9.0.0
```

```console
yarn add --dev @jsenv/node-module-import-map@9.0.0
```
