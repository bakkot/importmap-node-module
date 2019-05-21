import { remapResolvedImport } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { importMetaURLToFolderPath } from "../import-meta-url-to-folder-path.js"
import { generateImportMapForProjectNodeModules } from "../../index.js"

const testFolderPath = importMetaURLToFolderPath(import.meta.url)
const importMap = await generateImportMapForProjectNodeModules({
  projectPath: testFolderPath,
  writeImportMapFile: false,
})

const resolve = ({ importer, specifier }) =>
  remapResolvedImport({
    importMap,
    importerHref: `http://example.com/${importer}`,
    resolvedImport: `http://example.com/${specifier}`,
  }).slice("http://example.com/".length)

// import 'bar' inside project
{
  const actual = resolve({ importer: "scoped.js", specifier: "bar" })
  const expected = "node_modules/bar/bar.js"
  assert({ actual, expected })
}

// import 'bar' inside foo
{
  const actual = resolve({ importer: "node_modules/foo/foo.js", specifier: "bar" })
  const expected = "node_modules/foo/node_modules/bar/bar.js"
  assert({ actual, expected })
}
