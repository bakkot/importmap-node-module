import { importMetaURLToFolderPath } from "@jsenv/operating-system-path"
import { assert } from "@dmail/assert"
import { generateImportMapForProjectNodeModules } from "../../index.js"

const testFolderPath = importMetaURLToFolderPath(import.meta.url)
const actual = await generateImportMapForProjectNodeModules({
  projectPath: testFolderPath,
  writeImportMapFile: false,
  scopeOriginRelativePerModule: false,
  remapFolder: false,
})
const expected = {
  imports: {
    "main-undefined": "/node_modules/main-undefined/index.js",
  },
  scopes: {},
}
assert({ actual, expected })
