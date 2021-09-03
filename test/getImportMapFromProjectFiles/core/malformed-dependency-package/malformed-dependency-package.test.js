import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/filesystem"
import { getImportMapFromProjectFiles } from "@jsenv/importmap-node-module"

const testDirectoryUrl = resolveUrl("./root/", import.meta.url)

const warnings = []
const importMap = await getImportMapFromProjectFiles({
  logLevel: "off",
  projectDirectoryUrl: testDirectoryUrl,
  onWarn: (warning) => {
    warnings.push(warning)
  },
})
const actual = {
  warnings,
  importMap,
}
const expected = {
  warnings: [],
  importMap: {
    imports: {},
    scopes: {},
  },
}
assert({ actual, expected })
