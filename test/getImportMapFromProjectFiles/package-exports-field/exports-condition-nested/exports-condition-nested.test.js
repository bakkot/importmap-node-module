import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/filesystem"
import { getImportMapFromProjectFiles } from "@jsenv/importmap-node-module"

const testDirectoryUrl = resolveUrl("./root/", import.meta.url)

{
  const importMap = await getImportMapFromProjectFiles({
    projectDirectoryUrl: testDirectoryUrl,
    runtime: "node",
    jsFilesParsing: false,
  })
  const actual = importMap
  const expected = {
    imports: {
      "root/": "./",
      "root": "./index",
      "foo": "./node_modules/foo/feature-node.mjs",
    },
    scopes: {
      "./node_modules/foo/": {
        "foo/": "./node_modules/foo/",
      },
    },
  }
  assert({ actual, expected })
}

{
  const importMap = await getImportMapFromProjectFiles({
    projectDirectoryUrl: testDirectoryUrl,
    runtime: "browser",
    jsFilesParsing: false,
  })
  const actual = importMap
  const expected = {
    imports: {
      "root/": "./",
      "root": "./index",
      "foo": "./node_modules/foo/feature.mjs",
    },
    scopes: {
      "./node_modules/foo/": {
        "foo/": "./node_modules/foo/",
      },
    },
  }
  assert({ actual, expected })
}
