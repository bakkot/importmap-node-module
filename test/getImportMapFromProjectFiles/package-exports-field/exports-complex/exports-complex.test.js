import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"
import { getImportMapFromProjectFiles } from "@jsenv/node-module-import-map"

const testDirectoryUrl = resolveUrl("./root/", import.meta.url)

const getImportMap = async ({ runtime, moduleFormat } = {}) => {
  return getImportMapFromProjectFiles({
    projectDirectoryUrl: testDirectoryUrl,
    jsFiles: false,
    moduleFormat,
    runtime,
  })
}

{
  const actual = await getImportMap({
    runtime: "node",
  })
  const expected = {
    imports: {
      "foo/dist/": "./node_modules/foo/dist/",
      "whatever": "./index",
      "foo": "./node_modules/foo/dist/rollup.mjs",
    },
    scopes: {},
  }
  assert({ actual, expected })
}

{
  const actual = await getImportMap({
    runtime: "node",
    moduleFormat: "cjs",
  })
  const expected = {
    imports: {
      "foo/dist/": "./node_modules/foo/dist/",
      "whatever": "./index",
      "foo": "./node_modules/foo/dist/rollup.js",
    },
    scopes: {},
  }
  assert({ actual, expected })
}

{
  const actual = await getImportMap({
    runtime: "node",
    moduleFormat: "other",
  })
  const expected = {
    imports: {
      "foo/dist/": "./node_modules/foo/dist/",
      "whatever": "./index",
      "foo": "./node_modules/foo/dist/rollup.browser.mjs",
    },
    scopes: {},
  }
  assert({ actual, expected })
}

{
  const actual = await getImportMap()
  const expected = {
    imports: {
      "foo/dist/": "./node_modules/foo/dist/",
      "whatever": "./index",
      "foo": "./node_modules/foo/dist/rollup.browser.mjs",
    },
    scopes: {},
  }
  assert({ actual, expected })
}
