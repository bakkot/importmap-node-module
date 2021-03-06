import { resolveUrl, readFileSystemNodeStat, urlToBasename, urlToExtension } from "@jsenv/util"
import { firstOperationMatching } from "@jsenv/cancellation"

export const resolveFile = async (fileUrl, { magicExtensions }) => {
  const fileStat = await readFileSystemNodeStat(fileUrl, {
    nullIfNotFound: true,
  })

  // file found
  if (fileStat && fileStat.isFile()) {
    return fileUrl
  }

  // directory found
  if (fileStat && fileStat.isDirectory()) {
    const indexFileSuffix = fileUrl.endsWith("/") ? "index" : "/index"
    const indexFileUrl = `${fileUrl}${indexFileSuffix}`
    const extensionLeadingToAFile = await findExtensionLeadingToFile(indexFileUrl, magicExtensions)
    if (extensionLeadingToAFile === null) {
      return null
    }
    return `${indexFileUrl}.${extensionLeadingToAFile}`
  }

  // file not found and it has an extension
  const extension = urlToExtension(fileUrl)
  if (extension !== "") {
    return null
  }

  const extensionLeadingToAFile = await findExtensionLeadingToFile(fileUrl, magicExtensions)
  // magic extension not found
  if (extensionLeadingToAFile === null) {
    return null
  }

  // magic extension worked
  return `${fileUrl}.${extensionLeadingToAFile}`
}

const findExtensionLeadingToFile = async (fileUrl, magicExtensions) => {
  const fileDirectoryUrl = resolveUrl("./", fileUrl)
  const fileBasename = urlToBasename(fileUrl)
  const extensionLeadingToFile = await firstOperationMatching({
    array: magicExtensions,
    start: async (extensionCandidate) => {
      const filePathCandidate = `${fileDirectoryUrl}/${fileBasename}.${extensionCandidate}`
      const stats = await readFileSystemNodeStat(filePathCandidate, { nullIfNotFound: true })
      return stats && stats.isFile() ? extensionCandidate : null
    },
    predicate: (extension) => Boolean(extension),
  })
  return extensionLeadingToFile || null
}
