#!/usr/bin/env node
import { execSync } from 'child_process'
import dotenv from 'dotenv'

dotenv.config()

function run(command, failMessage) {
  try {
    execSync(command, { stdio: 'inherit' })
  } catch (error) {
    console.error(failMessage, error.message)
    process.exit(1)
  }
}

function runDatabaseMigration() {
  console.log('🔄 执行数据库迁移...')
  run('npx prisma migrate deploy', '❌ 数据库迁移失败:')
  console.log('✅ 数据库迁移完成')
}

function startServer() {
  console.log('🚀 启动服务...')
  run(`${process.execPath} ./bin/www`, '❌ 服务启动失败:')
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === 'prisma') {
    run(`npx prisma ${args.slice(1).join(' ')}`, '❌ Prisma 命令执行失败:')
    return
  }

  runDatabaseMigration()

  // 镜像构建阶段已 generate；本地直接跑入口时补一次
  if (!process.env.SKIP_PRISMA_GENERATE) {
    run('npx prisma generate', '❌ Prisma 客户端生成失败:')
  }

  startServer()
}

main().catch((error) => {
  console.error('❌ 脚本执行失败:', error)
  process.exit(1)
})
