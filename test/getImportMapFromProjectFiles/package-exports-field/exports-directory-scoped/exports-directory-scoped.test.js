import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"
import { getImportMapFromProjectFiles } from "@jsenv/node-module-import-map"

const testDirectoryUrl = resolveUrl("./root/", import.meta.url)

const actual = await getImportMapFromProjectFiles({
  projectDirectoryUrl: testDirectoryUrl,
  jsFiles: false,
})
const expected = {
  imports: {
    "foo/ding": "./node_modules/foo/dong",
    "root/": "./",
    "root": "./index",
    "foo": "./node_modules/foo/index.js",
  },
  scopes: {
    "./node_modules/foo/node_modules/exporting-folder/": {
      "exporting-folder/": "./node_modules/foo/node_modules/exporting-folder/",
    },
    "./node_modules/foo/": {
      "exporting-folder/": "./node_modules/foo/node_modules/exporting-folder/",
      "exporting-folder": "./node_modules/foo/node_modules/exporting-folder/index.js",
      "foo/": "./node_modules/foo/",
    },
  },
}
assert({ actual, expected })
