import { writeFile } from "fs"
import {
  createCancellationTokenForProcessSIGINT,
  catchAsyncFunctionCancellation,
} from "@jsenv/cancellation"
import { createLogger } from "@jsenv/logger"
import { resolveUrl, urlToFilePath } from "./internal/urlUtils.js"
import { importMapToVsCodeConfigPaths } from "./internal/importMapToVsCodeConfigPaths.js"
import { normalizeDirectoryUrl } from "./internal/normalizeDirectoryUrl.js"
import { generateImportMapForPackage } from "./generateImportMapForPackage.js"

export const generateImportMapForProjectPackage = async ({
  // nothing is actually listening for this cancellationToken for now
  // it's not very important but it would be better to register on it
  // an stops what we are doing if asked to do so
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel,
  projectDirectoryUrl,

  manualOverrides,
  includeDevDependencies = process.env.NODE_ENV !== "production",
  includeExports = true,
  favoredExports = ["default"],
  includeImports = true,
  importMapFile = false,
  importMapFileRelativeUrl = "./importMap.json",
  importMapFileLog = true,
  jsConfigFile = false,
  jsConfigFileLog = true,
  jsConfigLeadingSlash = false,
}) =>
  catchAsyncFunctionCancellation(async () => {
    projectDirectoryUrl = normalizeDirectoryUrl(projectDirectoryUrl)

    const logger = createLogger({ logLevel })
    const importMap = await generateImportMapForPackage({
      cancellationToken,
      logger,

      projectDirectoryUrl,
      manualOverrides,
      includeDevDependencies,
      includeExports,
      includeImports,
      favoredExports,
    })

    if (importMapFile) {
      const importMapFileUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)
      const importMapFilePath = urlToFilePath(importMapFileUrl)
      await writeFileContent(importMapFilePath, JSON.stringify(importMap, null, "  "))
      if (importMapFileLog) {
        logger.info(`-> ${importMapFilePath}`)
      }
    }
    if (jsConfigFile) {
      const jsConfigFileUrl = resolveUrl("./jsconfig.json", projectDirectoryUrl)
      const jsConfigFilePath = urlToFilePath(jsConfigFileUrl)
      try {
        const jsConfig = {
          compilerOptions: {
            baseUrl: ".",
            paths: {
              ...(jsConfigLeadingSlash ? { "/*": ["./*"] } : {}),
              ...importMapToVsCodeConfigPaths(importMap),
            },
          },
        }
        await writeFileContent(jsConfigFilePath, JSON.stringify(jsConfig, null, "  "))
        if (jsConfigFileLog) {
          logger.info(`-> ${jsConfigFilePath}`)
        }
      } catch (e) {
        if (e.code !== "ENOENT") {
          throw e
        }
      }
    }

    return importMap
  })

const writeFileContent = (path, content) =>
  new Promise((resolve, reject) => {
    writeFile(path, content, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
