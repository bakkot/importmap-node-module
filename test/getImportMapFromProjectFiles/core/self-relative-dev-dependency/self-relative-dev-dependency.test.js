import { assert } from "@jsenv/assert"
import { removeFileSystemNode, resolveUrl, writeSymbolicLink } from "@jsenv/util"

import { getImportMapFromProjectFiles } from "@jsenv/node-module-import-map"

const projectDirectoryUrl = resolveUrl("./root/", import.meta.url)
const testDirectoryUrl = resolveUrl("./dir/", projectDirectoryUrl)

await removeFileSystemNode(`${testDirectoryUrl}/node_modules/siesta`, { allowUseless: true })
await writeSymbolicLink(`${testDirectoryUrl}/node_modules/siesta`, projectDirectoryUrl)

const warnings = []
const importmap = await getImportMapFromProjectFiles({
  projectDirectoryUrl: testDirectoryUrl,
  jsFiles: false,
  dev: true,
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
      "awesome-isomorphic-app/": "./",
      "awesome-isomorphic-app": "./index",
      "siesta": "./node_modules/siesta/index",
    },
    scopes: {
      "./node_modules/siesta/": {
        "siesta/": "./node_modules/siesta/",
      },
    },
  },
}
assert({ actual, expected })
removeFileSystemNode(`${testDirectoryUrl}/node_modules/siesta`)
