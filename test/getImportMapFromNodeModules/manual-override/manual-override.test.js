import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"
import { getImportMapFromNodeModules } from "@jsenv/node-module-import-map"

const testDirectoryUrl = resolveUrl("./", import.meta.url)

const actual = await getImportMapFromNodeModules({
  projectDirectoryUrl: testDirectoryUrl,
  packagesManualOverrides: {
    bar: {
      main: "bar.js",
      exports: {
        "./": "./",
      },
    },
  },
  packagesSelfReference: false,
})
const expected = {
  imports: {
    "bar/": "./node_modules/bar/",
    "bar": "./node_modules/bar/bar.js",
  },
  scopes: {},
}
assert({ actual, expected })
