# jsenv-node-module-import-map

[![npm package](https://img.shields.io/npm/v/@jsenv/node-module-import-map.svg)](https://www.npmjs.com/package/@jsenv/node-module-import-map)
[![build](https://travis-ci.com/jsenv/jsenv-node-module-import-map.svg?branch=master)](http://travis-ci.com/jsenv/jsenv-node-module-import-map)
[![codecov](https://codecov.io/gh/jsenv/jsenv-node-module-import-map/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-node-module-import-map)

> convert node_modules into importMap

## Introduction

`jsenv-node-module-import-map` can generate an importMap object from a `package.json` file.<br />

importMap can be used by other tools to know where to find an import like

```js
import whatever from "lodash"
```

without having to use node module resolution.<br />
— see [node module resolution on node.js](https://nodejs.org/api/modules.html#modules_all_together)

## How it works

Reads `package.json` and recursively try to find your dependencies.<br />

It must happen once node modules are on your machine, because it searches dependencies on your filesystem. For that reason, you must use it after `npm install` or anything that is responsible to download node modules to put them on your machine.<br />

## How to use

This section assumes you have a folder with a `package.json` file and you want to generate the corresponding importMap.<br />
This example assumes folder path is `/Users/dmail`. Don't forget to replace it by the actual path on your machine.

1. go to `/Users/dmail/folder/`

```shell
cd /Users/dmail/folder/
```

2. install `@jsenv/node-module-import-map`

```shell
npm install --save-dev @jsenv/node-module-import-map
```

2. create `generate-import-map.js`

```js
const { generateImportMapForProjectNodeModules } = require("@jsenv/node-module-import-map")

generateImportMapForProjectNodeModules({ projectPath: __dirname })
```

3. execute `generate-import-map.js`

```shell
node generate-import-map.js
```

`importMap.json` file will be created in your folder.<br />

## Implementation details

##### A custom node module resolution

This project uses a custom node module resolution.<br />
It behaves as the official one used by node.js `require` with one big change:

> A node module will not be found if it is outside your project folder.

We do this because importMap will be used by browsers. Inside a browser you would be unable to find a file external to your root because you would end up doing this:

```js
new URL("../node_modules/pkg/index.js", "https://example.com/file.js")
```

The url resolution would just ignore `../` and `node_modules/pkg/index.js` would result in a 404 or an unexpected version of that node module.

However, a symbolic link inside projectPath targeting the outside node module location is ok. It means we support `npm link` or other scenario using symbolic links as yarn does.

The thing we don't support is a globally installed node module that is not symlinked in your folder, which should be avoided 99.99% of the time anyway.

## `generateImportMapForNodeModules`

An async function returning an importMap object.

```js
const importMap = await generateImportMapForNodeModules({
  projectPath: __dirname,
})
```

It accepts several options documented below. Each option can be passed like writeImportMapFile is passed in the code above.

### projectPath option

> Path leading to a folder with a package.json.

```js
const projectPath = "/Users/dmail/folder"
```

- This option is **required**.
- On windows you would pass `C:\Users\dmail\folder`, that's fine.
- You can use `__dirname` to provide this option value.<br />
  — see [\_\_dirname documentation on node.js](https://nodejs.org/docs/latest/api/modules.html#modules_dirname)

### importMapRelativePath option

> Relative path where the importMap file is written.

When written, import map file will be at

<!-- prettier-ignore -->
```js
`${projectPath}${importMapRelativePath}`
```

If you don't pass this option, default value is

```js
"/importMap.json"
```

### writeImportMapFile option

> When true, importMap will be written to a file.

If you don't pass this option, default value is

```js
false
```

### logImportMapFilePath option

> When both `writeImportMapFile` and `logImportMapFilePath` are true, the function will log path to the written importMap file in the terminal.

If you don't pass this option, default value is

```js
true
```
