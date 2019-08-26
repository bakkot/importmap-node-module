import { importMetaURLToFolderPath } from "@jsenv/operating-system-path"
import { assert } from "@dmail/assert"
import { generateImportMapForNodeModules } from "../../index.js"

const testFolderPath = importMetaURLToFolderPath(import.meta.url)
const actual = await generateImportMapForNodeModules({
  projectPath: testFolderPath,
  remapFolder: false,
})
const expected = {
  imports: {
    "main-undefined": "/node_modules/main-undefined/index.js",
  },
  scopes: {},
}
assert({ actual, expected })
