import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"
import { getImportMapFromNodeModules } from "../../../../index.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)

const actual = await getImportMapFromNodeModules({
  projectDirectoryUrl: testDirectoryUrl,
  packagesSelfReference: false,
})
const expected = {
  imports: {
    "main-undefined": "./node_modules/main-undefined/index.js",
  },
  scopes: {},
}
assert({ actual, expected })
