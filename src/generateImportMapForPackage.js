/* eslint-disable import/max-dependencies */
import { basename } from "path"
import { sortImportMap } from "@jsenv/import-map"
import {
  pathToDirectoryUrl,
  directoryUrlToPackageFileUrl,
  fileUrlToDirectoryUrl,
  fileUrlToPath,
  fileUrlToRelativePath,
} from "./internal/urlHelpers.js"
import { readPackageFile } from "./internal/readPackageFile.js"
import { resolveNodeModule } from "./internal/resolveNodeModule.js"
import { resolvePackageMain } from "./internal/resolvePackageMain.js"
import { visitPackageImports } from "./internal/visitPackageImports.js"
import { visitPackageExports } from "./internal/visitPackageExports.js"

export const generateImportMapForPackage = async ({
  logger,
  projectDirectoryPath,
  rootProjectDirectoryPath = projectDirectoryPath,
  includeDevDependencies = false,
  includeExports,
  includeImports,
  packageExportCondition,
}) => {
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
  const rootProjectDirectoryUrl = pathToDirectoryUrl(rootProjectDirectoryPath)
  const projectPackageFileUrl = directoryUrlToPackageFileUrl(projectDirectoryUrl)
  const rootProjectPackageFileUrl = directoryUrlToPackageFileUrl(rootProjectDirectoryUrl)

  const imports = {}
  const scopes = {}
  const seen = {}

  const markPackageAsSeen = (packageFileUrl, importerPackageFileUrl) => {
    if (packageFileUrl in seen) {
      seen[packageFileUrl].push(importerPackageFileUrl)
    } else {
      seen[packageFileUrl] = [importerPackageFileUrl]
    }
  }

  const packageIsSeen = (packageFileUrl, importerPackageFileUrl) => {
    return packageFileUrl in seen && seen[packageFileUrl].includes(importerPackageFileUrl)
  }

  const visit = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    importerPackageFileUrl,
    includeDevDependencies,
  }) => {
    await visitPackage({
      packageFileUrl,
      packageName,
      packageJsonObject,
      importerPackageFileUrl,
    })
    await visitDependencies({
      packageFileUrl,
      packageJsonObject,
      includeDevDependencies,
    })
  }

  const visitPackage = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    importerPackageFileUrl,
  }) => {
    const packageInfo = computePackageInfo({
      packageFileUrl,
      packageName,
      importerPackageFileUrl,
    })

    await visitPackageMain({
      packageFileUrl,
      packageName,
      packageJsonObject,
      packageInfo,
    })

    if (includeImports && "imports" in packageJsonObject) {
      const importsForPackageImports = visitPackageImports({
        packageFileUrl,
        packageName,
        packageJsonObject,
        packageInfo,
      })

      const { packageIsRoot, packageDirectoryRelativePath } = packageInfo
      Object.keys(importsForPackageImports).forEach((from) => {
        const to = importsForPackageImports[from]

        if (packageIsRoot) {
          addImportMapping({ from, to })
        } else {
          const toScoped =
            to[0] === "/"
              ? to
              : `${packageDirectoryRelativePath}${to.startsWith("./") ? to.slice(2) : to}`

          addScopedImportMapping({
            scope: packageDirectoryRelativePath,
            from,
            to: toScoped,
          })

          // when a package says './' maps to './'
          // we must add something to say if we are already inside the package
          // no need to ensure leading slash are scoped to the package
          if (from === "./" && to === "./") {
            addScopedImportMapping({
              scope: packageDirectoryRelativePath,
              from: packageDirectoryRelativePath,
              to: packageDirectoryRelativePath,
            })
          } else if (from === "/" && to === "/") {
            addScopedImportMapping({
              scope: packageDirectoryRelativePath,
              from: packageDirectoryRelativePath,
              to: packageDirectoryRelativePath,
            })
          }
        }
      })
    }

    if (includeExports && "exports" in packageJsonObject) {
      const importsForPackageExports = visitPackageExports({
        packageFileUrl,
        packageName,
        packageJsonObject,
        packageInfo,
        packageExportCondition,
      })

      const {
        importerIsRoot,
        importerRelativePath,
        packageDirectoryUrl,
        packageDirectoryUrlExpected,
      } = packageInfo
      Object.keys(importsForPackageExports).forEach((from) => {
        const to = importsForPackageExports[from]

        if (importerIsRoot) {
          addImportMapping({ from, to })
        } else {
          addScopedImportMapping({ scope: importerRelativePath, from, to })
        }
        if (packageDirectoryUrl !== packageDirectoryUrlExpected) {
          addScopedImportMapping({
            scope: importerRelativePath,
            from,
            to,
          })
        }
      })
    }
  }

  const visitPackageMain = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    packageInfo: {
      importerIsRoot,
      importerRelativePath,
      packageIsRoot,
      packageIsProject,
      packageDirectoryUrl,
      packageDirectoryUrlExpected,
    },
  }) => {
    if (packageIsRoot) return
    if (packageIsProject) return

    const mainFileUrl = await resolvePackageMain({
      packageFileUrl,
      packageJsonObject,
      logger,
    })

    // it's possible to have no main
    // like { main: "" } in package.json
    // or a main that does not lead to an actual file
    if (mainFileUrl === null) return

    const mainFileRelativePath = fileUrlToRelativePath(mainFileUrl, rootProjectDirectoryUrl)
    const from = packageName
    const to = mainFileRelativePath

    if (importerIsRoot) {
      addImportMapping({ from, to })
    } else {
      addScopedImportMapping({ scope: importerRelativePath, from, to })
    }
    if (packageDirectoryUrl !== packageDirectoryUrlExpected) {
      addScopedImportMapping({ scope: importerRelativePath, from, to })
    }
  }

  const visitDependencies = async ({
    packageFileUrl,
    packageJsonObject,
    includeDevDependencies,
  }) => {
    const dependencyMap = {}

    const { dependencies = {} } = packageJsonObject
    Object.keys(dependencies).forEach((dependencyName) => {
      dependencyMap[dependencyName] = {
        type: "dependency",
        versionPattern: dependencies[dependencyName],
      }
    })

    const { peerDependencies = {} } = packageJsonObject
    Object.keys(peerDependencies).forEach((dependencyName) => {
      dependencyMap[dependencyName] = {
        type: "peerDependency",
        versionPattern: peerDependencies[dependencyName],
      }
    })

    const isProjectPackage = packageFileUrl === projectPackageFileUrl
    if (includeDevDependencies && isProjectPackage) {
      const { devDependencies = {} } = packageJsonObject
      Object.keys(devDependencies).forEach((dependencyName) => {
        if (!dependencyMap.hasOwnProperty(dependencyName)) {
          dependencyMap[dependencyName] = {
            type: "devDependency",
            versionPattern: devDependencies[dependencyName],
          }
        }
      })
    }

    await Promise.all(
      Object.keys(dependencyMap).map(async (dependencyName) => {
        const dependency = dependencyMap[dependencyName]
        await visitDependency({
          packageFileUrl,
          packageJsonObject,
          dependencyName,
          dependencyType: dependency.type,
          dependencyVersionPattern: dependency.versionPattern,
        })
      }),
    )
  }

  const visitDependency = async ({
    packageFileUrl,
    packageJsonObject,
    dependencyName,
    dependencyType,
    dependencyVersionPattern,
  }) => {
    const dependencyData = await findDependency({
      packageFileUrl,
      packageJsonObject,
      dependencyName,
      dependencyType,
      dependencyVersionPattern,
    })
    if (!dependencyData) {
      return
    }

    const {
      packageFileUrl: dependencyPackageFileUrl,
      packageJsonObject: dependencyPackageJsonObject,
    } = dependencyData

    if (packageIsSeen(dependencyPackageFileUrl, packageFileUrl)) {
      return
    }
    markPackageAsSeen(dependencyPackageFileUrl, packageFileUrl)
    await visit({
      packageFileUrl: dependencyPackageFileUrl,
      packageName: dependencyName,
      packageJsonObject: dependencyPackageJsonObject,
      importerPackageFileUrl: packageFileUrl,
    })
  }

  const computePackageInfo = ({ packageFileUrl, packageName, importerPackageFileUrl }) => {
    const importerIsRoot = importerPackageFileUrl === rootProjectPackageFileUrl

    const importerIsProject = importerPackageFileUrl === projectPackageFileUrl

    const importerPackageDirectoryUrl = fileUrlToDirectoryUrl(importerPackageFileUrl)

    const importerRelativePath = importerIsRoot
      ? `./${basename(rootProjectDirectoryUrl)}/`
      : fileUrlToRelativePath(importerPackageDirectoryUrl, rootProjectDirectoryUrl)

    const packageIsRoot = packageFileUrl === rootProjectPackageFileUrl

    const packageIsProject = packageFileUrl === projectPackageFileUrl

    const packageDirectoryUrl = fileUrlToDirectoryUrl(packageFileUrl)

    let packageDirectoryUrlExpected
    if (packageIsProject && !packageIsRoot) {
      packageDirectoryUrlExpected = importerPackageDirectoryUrl
    } else {
      packageDirectoryUrlExpected = `${importerPackageDirectoryUrl}node_modules/${packageName}/`
    }

    const packageDirectoryRelativePath = fileUrlToRelativePath(
      packageDirectoryUrl,
      rootProjectDirectoryUrl,
    )

    return {
      importerIsRoot,
      importerIsProject,
      importerRelativePath,
      packageIsRoot,
      packageIsProject,
      packageDirectoryUrl,
      packageDirectoryUrlExpected,
      packageDirectoryRelativePath,
    }
  }

  const addImportMapping = ({ from, to }) => {
    // we could think it's useless to remap from with to
    // however it can be used to ensure a weaker remapping
    // does not win over this specific file or folder
    if (from === to) {
      /**
       * however remapping '/' to '/' is truly useless
       * moreover it would make wrapImportMap create something like
       * {
       *   imports: {
       *     "/": "/.dist/best/"
       *   }
       * }
       * that would append the wrapped folder twice
       * */
      if (from === "/") return
    }

    imports[from] = to
  }

  const addScopedImportMapping = ({ scope, from, to }) => {
    scopes[scope] = {
      ...(scopes[scope] || {}),
      [from]: to,
    }
  }

  const dependenciesCache = {}
  const findDependency = ({
    packageFileUrl,
    packageJsonObject,
    dependencyName,
    dependencyType,
    dependencyVersionPattern,
  }) => {
    if (packageFileUrl in dependenciesCache === false) {
      dependenciesCache[packageFileUrl] = {}
    }
    if (dependencyName in dependenciesCache[packageFileUrl]) {
      return dependenciesCache[packageFileUrl][dependencyName]
    }
    const dependencyPromise = resolveNodeModule({
      rootProjectDirectoryUrl,
      packageFileUrl,
      packageJsonObject,
      dependencyName,
      dependencyType,
      dependencyVersionPattern,
      logger,
    })
    dependenciesCache[packageFileUrl][dependencyName] = dependencyPromise
    return dependencyPromise
  }

  const projectPackageJsonObject = await readPackageFile(fileUrlToPath(projectPackageFileUrl))

  const packageFileUrl = projectPackageFileUrl
  const importerPackageFileUrl = projectPackageFileUrl
  markPackageAsSeen(packageFileUrl, importerPackageFileUrl)
  await visit({
    packageFileUrl,
    packageName: projectPackageJsonObject.name,
    packageJsonObject: projectPackageJsonObject,
    importerPackageFileUrl,
    includeDevDependencies,
  })

  return sortImportMap({ imports, scopes })
}
