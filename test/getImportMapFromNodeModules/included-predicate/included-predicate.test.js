import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"
import { getImportMapFromNodeModules } from "@jsenv/node-module-import-map"

const testDirectoryUrl = resolveUrl("./", import.meta.url)

const actual = await getImportMapFromNodeModules({
  projectDirectoryUrl: testDirectoryUrl,
  packagesSelfReference: false,
  packageIncludedPredicate: ({ packageName }) => packageName !== "foo",
})
const expected = {
  imports: {
    bar: "./node_modules/bar/index",
  },
  scopes: {},
}
assert({ actual, expected })
