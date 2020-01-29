import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"
import { generateImportMapForProjectPackage } from "../../../index.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)

const importMap = await generateImportMapForProjectPackage({
  projectDirectoryUrl: testDirectoryUrl,
})
const actual = importMap
const expected = {
  imports: {
    foo: "./node_modules/foo/foo.js",
  },
  scopes: {},
}
assert({ actual, expected })
