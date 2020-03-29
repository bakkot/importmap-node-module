import { assert } from "@jsenv/assert"
import { resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { generateImportMapForProjectPackage } from "../../../index.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const packageFileUrl = resolveUrl("./package.json", testDirectoryUrl)

try {
  await generateImportMapForProjectPackage({
    projectDirectoryUrl: testDirectoryUrl,
    updateProcessExitCode: false,
  })
  throw new Error("should throw")
} catch (error) {
  const { code, message } = error
  const actual = { code, message }
  const expected = {
    code: "ENOENT",
    message: `ENOENT: no such file or directory, open '${urlToFileSystemPath(packageFileUrl)}'`,
  }
  assert({ actual, expected })
}
