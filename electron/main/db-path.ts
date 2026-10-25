import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

/**
 * 获取 SQLite 数据库文件路径
 * - 开发环境：项目根目录下的 .localdb/app.db
 * - 生产环境：app.getPath('userData') 下的 app.db
 */
export function getDbPath(): string {
  if (!app.isPackaged) {
    // 开发环境：项目根目录 .localdb/app.db
    const devDbDir = path.join(process.cwd(), '.localdb')
    if (!fs.existsSync(devDbDir)) {
      fs.mkdirSync(devDbDir, { recursive: true })
    }
    return path.join(devDbDir, 'app.db')
  } else {
    // 生产环境：userData 目录
    return path.join(app.getPath('userData'), 'app.db')
  }
}
