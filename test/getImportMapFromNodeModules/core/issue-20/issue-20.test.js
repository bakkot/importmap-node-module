import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import { resolveUrl } from "@jsenv/util"
import { assert } from "@jsenv/assert"
import { getImportMapFromNodeModules } from "../../../../index.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)

const importMap = await getImportMapFromNodeModules({
  projectDirectoryUrl: testDirectoryUrl,
})
{
  const actual = importMap
  const expected = {
    imports: {
      "root/": "./",
      "lume": "./node_modules/lume/lume.js",
      "root": "./index",
    },
    scopes: {
      "./node_modules/lowclass/": {
        "lowclass/": "./node_modules/lowclass/",
      },
      "./node_modules/lume/": {
        "lowclass": "./node_modules/lowclass/dist/index.js",
        "lume/": "./node_modules/lume/",
      },
    },
  }
  assert({ actual, expected })
}

{
  const importMapNormalized = normalizeImportMap(importMap, "http://example.com")
  const actual = resolveImport({
    specifier: "lowclass",
    importer: `http://example.com/node_modules/lume/index.js`,
    importMap: importMapNormalized,
  })
  const expected = `http://example.com/node_modules/lowclass/dist/index.js`
  assert({ actual, expected })
}
