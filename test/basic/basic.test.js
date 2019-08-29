import { importMetaURLToFolderPath } from "@jsenv/operating-system-path"
import { assert } from "@dmail/assert"
import { generateImportMapForNodeModules } from "../../index.js"

const testFolderPath = importMetaURLToFolderPath(import.meta.url)
const actual = await generateImportMapForNodeModules({
  projectPath: testFolderPath,
})
const expected = {
  imports: {
    "@dmail/yo": "/node_modules/@dmail/yo/index.js",
    bar: "/node_modules/bar/bar.js",
    foo: "/node_modules/foo/foo.js",
  },
  scopes: {
    "/node_modules/foo/": {
      bar: "/node_modules/foo/node_modules/bar/index.js",
    },
  },
}
assert({ actual, expected })
