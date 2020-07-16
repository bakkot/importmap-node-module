import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"
import { generateImportMapForNodeModules } from "../../../index.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)

const actual = await generateImportMapForNodeModules({
  projectDirectoryUrl: testDirectoryUrl,
  packagesSelfImport: false,
})
const expected = {
  imports: {
    foo: "./node_modules/foo/file.js",
  },
  scopes: {},
}
assert({ actual, expected })
