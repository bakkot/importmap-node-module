import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"
import { generateImportMapForProjectPackage } from "../../../index.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)

const actual = await generateImportMapForProjectPackage({
  projectDirectoryUrl: testDirectoryUrl,
})
const expected = {
  imports: {
    "@dmail/yo": "./node_modules/@dmail/yo/index.js",
    "root/": "./",
    "bar": "./node_modules/bar/bar.js",
    "foo": "./node_modules/foo/foo.js",
  },
  scopes: {
    "./node_modules/foo/node_modules/bar/": {
      "bar/": "./node_modules/foo/node_modules/bar/",
    },
    "./node_modules/@dmail/yo/": {
      "@dmail/yo/": "./node_modules/@dmail/yo/",
    },
    "./node_modules/bar/": {
      "bar/": "./node_modules/bar/",
    },
    "./node_modules/foo/": {
      "foo/": "./node_modules/foo/",
      "bar": "./node_modules/foo/node_modules/bar/index.js",
    },
  },
}
assert({ actual, expected })
