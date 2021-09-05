import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/filesystem"

import { getImportMapFromProjectFiles } from "@jsenv/importmap-node-module"

const testDirectoryUrl = resolveUrl("./root/", import.meta.url)

const actual = await getImportMapFromProjectFiles({
  projectDirectoryUrl: testDirectoryUrl,
  jsFilesParsing: true,
})
const expected = {
  imports: {
    "whatever": "./index.js",
    "foo/": "./node_modules/foo/",
  },
  scopes: {},
}
assert({ actual, expected })
