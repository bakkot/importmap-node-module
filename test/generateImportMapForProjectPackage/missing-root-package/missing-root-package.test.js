import { assert } from "@dmail/assert"
import { generateImportMapForProjectPackage } from "../../../index.js"
import { importMetaUrlToDirectoryPath } from "../../importMetaUrlToDirectoryPath.js"

const testDirectoryPath = importMetaUrlToDirectoryPath(import.meta.url)

try {
  await generateImportMapForProjectPackage({
    projectDirectoryPath: testDirectoryPath,
    throwUnhandled: false,
  })
  throw new Error("should throw")
} catch (error) {
  const { code, message } = error
  const actual = { code, message }
  const expected = {
    code: "ENOENT",
    message: `ENOENT: no such file or directory, open '${testDirectoryPath}package.json'`,
  }
  assert({ actual, expected })
}
