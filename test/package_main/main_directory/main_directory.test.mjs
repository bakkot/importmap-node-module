import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/filesystem"

import { writeImportMapFiles } from "@jsenv/importmap-node-module"

const testDirectoryUrl = resolveUrl("./root/", import.meta.url)
const importmaps = await writeImportMapFiles({
  projectDirectoryUrl: testDirectoryUrl,
  importMapFiles: {
    "test.importmap": {
      mappingsForNodeResolution: true,
      removeUnusedMappings: true,
    },
  },
  writeFiles: false,
})

const actual = importmaps["test.importmap"]
const expected = {
  imports: {
    "main-directory": "./node_modules/main-directory/lib/index.js",
  },
  scopes: {},
}
assert({ actual, expected })
