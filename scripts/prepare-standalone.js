const fs = require('fs')
const path = require('path')

const projectRoot = process.cwd()
const standaloneRoot = path.join(projectRoot, '.next', 'standalone')

function copyIfExists(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  const sourcePath = path.join(projectRoot, sourceRelativePath)
  const targetPath = path.join(standaloneRoot, targetRelativePath)

  if (!fs.existsSync(sourcePath) || !fs.existsSync(standaloneRoot)) {
    return
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.cpSync(sourcePath, targetPath, { recursive: true, force: true })
  console.log(`Copied ${sourceRelativePath} -> ${path.relative(projectRoot, targetPath)}`)
}

copyIfExists(path.join('.next', 'static'))
copyIfExists('public')
