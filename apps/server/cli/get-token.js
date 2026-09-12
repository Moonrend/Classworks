#!/usr/bin/env node

/**
 * 设备授权流程 - 命令行工具
 *
 * 用于演示设备授权流程，获取访问令牌
 *
 * 使用方法：
 *   node cli/get-token.js
 *   或配置为可执行：chmod +x cli/get-token.js && ./cli/get-token.js
 */

import { DEFAULT_LOCAL_SERVER, HEADER_SITE_KEY } from '@classworks/shared'

// 配置
const CONFIG = {
  // API服务器地址
  baseUrl: process.env.API_BASE_URL || DEFAULT_LOCAL_SERVER,
  // 站点密钥
  siteKey: process.env.SITE_KEY || '',
  // 应用ID
  appId: process.env.APP_ID || '1',
  // 授权页面地址（Classworks前端）
  authPageUrl: process.env.FRONTEND_URL,
  // 轮询间隔（秒）
  pollInterval: 3,
  // 最大轮询次数
  maxPolls: 100,
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green)
}

function logError(message) {
  log(`✗ ${message}`, colors.red)
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan)
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow)
}

// HTTP请求封装
async function request(path, options = {}) {
  const url = `${CONFIG.baseUrl}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (CONFIG.siteKey) {
    headers[HEADER_SITE_KEY] = CONFIG.siteKey
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`)
    }

    return data
  } catch (error) {
    if (error.message.includes('fetch')) {
      throw new Error(`无法连接到服务器: ${CONFIG.baseUrl}`)
    }
    throw error
  }
}

// 生成设备代码
async function generateDeviceCode() {
  logInfo('正在生成设备授权码...')
  const data = await request('/auth/device/code', {
    method: 'POST',
  })
  return data
}

// 轮询获取令牌
async function pollForToken(deviceCode) {
  let polls = 0

  return new Promise((resolve, reject) => {
    const poll = async () => {
      polls++

      if (polls > CONFIG.maxPolls) {
        reject(new Error('轮询超时，请重试'))
        return
      }

      try {
        const data = await request(`/auth/device/token?device_code=${deviceCode}`)

        if (data.status === 'success') {
          resolve(data.token)
        } else if (data.status === 'expired') {
          reject(new Error('设备代码已过期'))
        } else if (data.status === 'pending') {
          // 继续轮询
          log(`等待授权... (${polls}/${CONFIG.maxPolls})`, colors.dim)
          setTimeout(poll, CONFIG.pollInterval * 1000)
        }
      } catch (error) {
        reject(error)
      }
    }

    // 开始轮询
    poll()
  })
}

// 显示设备代码和授权链接
function displayDeviceCode(deviceCode, expiresIn) {
  console.log('\n' + '='.repeat(60))
  log(`  请访问以下地址完成授权：`, colors.bright)
  console.log('')

  // 构建授权URL
  const authUrl = `${CONFIG.authPageUrl}?app_id=${CONFIG.appId}&mode=devicecode&devicecode=${deviceCode}`
  log(`  ${authUrl}`, colors.cyan + colors.bright)
  console.log('')
  log(`  设备授权码: ${deviceCode}`, colors.green + colors.bright)
  console.log('='.repeat(60))
  logInfo(`授权码有效期: ${Math.floor(expiresIn / 60)} 分钟`)
  logInfo(`API服务器: ${CONFIG.baseUrl}`)
  console.log('')
}

// 保存令牌到文件
async function saveToken(token) {
  const fs = await import('fs')
  const path = await import('path')
  const os = await import('os')

  const tokenDir = path.join(os.homedir(), '.classworks')
  const tokenFile = path.join(tokenDir, 'token.txt')

  try {
    // 确保目录存在
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true })
    }

    // 写入令牌
    fs.writeFileSync(tokenFile, token, 'utf8')
    logSuccess(`令牌已保存到: ${tokenFile}`)
  } catch (error) {
    logWarning(`无法保存令牌到文件: ${error.message}`)
    logInfo('您可以手动保存令牌')
  }
}

// 主函数
async function main() {
  console.log(
    '\n' + colors.cyan + colors.bright + '设备授权流程 - 令牌获取工具' + colors.reset + '\n',
  )

  try {
    // 检查配置
    if (!CONFIG.siteKey) {
      logWarning('未设置 SITE_KEY 环境变量，可能需要站点密钥才能访问')
      logInfo('设置方法: export SITE_KEY=your-site-key')
      console.log('')
    }

    // 1. 生成设备代码
    const { device_code, expires_in } = await generateDeviceCode()
    logSuccess('设备授权码生成成功！')

    // 2. 显示设备代码和授权链接
    displayDeviceCode(device_code, expires_in)

    // 3. 提示用户授权
    logInfo('请在浏览器中打开上述地址，或在授权页面手动输入设备代码')
    logInfo('等待授权中...\n')

    // 4. 轮询获取令牌
    const token = await pollForToken(device_code)

    // 5. 显示令牌
    console.log('\n' + '='.repeat(50))
    logSuccess('授权成功！令牌获取完成')
    console.log('='.repeat(50))
    console.log('\n' + colors.bright + '您的访问令牌：' + colors.reset)
    log(token, colors.green)
    console.log('')

    // 6. 保存令牌
    await saveToken(token)

    // 7. 使用示例
    console.log('\n' + colors.bright + '使用示例：' + colors.reset)
    console.log(`  curl -H "Authorization: Bearer ${token}" ${CONFIG.baseUrl}/kv`)
    console.log('')

    process.exit(0)
  } catch (error) {
    console.log('')
    logError(`错误: ${error.message}`)
    console.log('')
    process.exit(1)
  }
}

// 运行
main()
