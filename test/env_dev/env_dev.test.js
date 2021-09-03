import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/filesystem"

import { getImportMapFromProjectFiles } from "@jsenv/importmap-node-module"

const testDirectoryUrl = resolveUrl("./root/", import.meta.url)

const warnings = []
const importmap = await getImportMapFromProjectFiles({
  projectDirectoryUrl: testDirectoryUrl,
  jsFilesParsing: true,
  initialImportMap: {
    imports: {
      "#env": "./env.dev.js",
    },
  },
  onWarn: (warning) => {
    warnings.push(warning)
  },
})
const actual = {
  warnings,
  importmap,
}
const expected = {
  warnings: [],
  importmap: {
    imports: {
      "whatever": "./index.js",
      "#env": "./env.dev.js",
    },
    scopes: {},
  },
}
assert({ actual, expected })
