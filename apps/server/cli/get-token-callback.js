#!/usr/bin/env node

/**
 * 回调授权流程 - 命令行工具
 *
 * 用于演示回调授权流程，获取访问令牌
 * 通过启动本地HTTP服务器接收回调来获取令牌
 *
 * 使用方法：
 *   node cli/get-token-callback.js
 *   或配置为可执行：chmod +x cli/get-token-callback.js && ./cli/get-token-callback.js
 */

import http from 'http'
import url from 'url'
import { randomBytes } from 'crypto'
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
  // 本地回调服务器端口
  callbackPort: process.env.CALLBACK_PORT || '8080',
  // 回调路径
  callbackPath: '/callback',
  // 超时时间（秒）
  timeout: 300,
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
  const requestUrl = `${CONFIG.baseUrl}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (CONFIG.siteKey) {
    headers[HEADER_SITE_KEY] = CONFIG.siteKey
  }

  try {
    const response = await fetch(requestUrl, {
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

// 生成随机状态字符串
function generateState() {
  return randomBytes(16).toString('hex')
}

// 获取设备UUID
async function getDeviceUuid() {
  try {
    const deviceInfo = await request('/device/info')
    return deviceInfo.uuid
  } catch (error) {
    // 如果设备不存在，生成新的UUID
    const uuid = randomBytes(16).toString('hex')
    logInfo(`生成新的设备UUID: ${uuid}`)
    return uuid
  }
}

// 创建回调服务器
function createCallbackServer(state) {
  return new Promise((resolve, reject) => {
    let server
    let resolved = false

    const handleRequest = (req, res) => {
      if (resolved) return

      const parsedUrl = url.parse(req.url, true)

      if (parsedUrl.pathname === CONFIG.callbackPath) {
        const { token, error, state: returnedState } = parsedUrl.query

        // 验证状态参数
        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>授权失败</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                .error { color: #d32f2f; }
              </style>
            </head>
            <body>
              <h1 class="error">授权失败</h1>
              <p>状态参数不匹配，可能存在安全风险。</p>
              <p>请重新尝试授权流程。</p>
            </body>
            </html>
          `)
          resolved = true
          server.close()
          reject(new Error('状态参数不匹配'))
          return
        }

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>授权失败</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                .error { color: #d32f2f; }
              </style>
            </head>
            <body>
              <h1 class="error">授权失败</h1>
              <p>${error}</p>
              <p>您可以关闭此页面并重新尝试。</p>
            </body>
            </html>
          `)
          resolved = true
          server.close()
          reject(new Error(error))
          return
        }

        if (token) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>授权成功</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                .success { color: #2e7d32; }
                .token { background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 20px; font-family: monospace; word-break: break-all; }
              </style>
            </head>
            <body>
              <h1 class="success">授权成功！</h1>
              <p>令牌已成功获取，您可以关闭此页面。</p>
              <div class="token">${token}</div>
              <p><small>令牌已自动复制到命令行界面</small></p>
            </body>
            </html>
          `)
          resolved = true
          server.close()
          resolve(token)
          return
        }

        // 如果没有token和error参数
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>无效请求</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">无效请求</h1>
            <p>缺少必要的参数。</p>
            <p>请重新尝试授权流程。</p>
          </body>
          </html>
        `)
        resolved = true
        server.close()
        reject(new Error('缺少必要的参数'))
      } else {
        // 404 for other paths
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      }
    }

    server = http.createServer(handleRequest)

    server.listen(CONFIG.callbackPort, (err) => {
      if (err) {
        reject(err)
      } else {
        logSuccess(
          `回调服务器已启动: http://localhost:${CONFIG.callbackPort}${CONFIG.callbackPath}`,
        )
      }
    })

    // 设置超时
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        server.close()
        reject(new Error('授权超时'))
      }
    }, CONFIG.timeout * 1000)

    server.on('error', (err) => {
      if (!resolved) {
        resolved = true
        reject(err)
      }
    })
  })
}

// 打开浏览器
async function openBrowser(url) {
  const { spawn } = await import('child_process')

  let command
  let args

  if (process.platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', url]
  } else if (process.platform === 'darwin') {
    command = 'open'
    args = [url]
  } else {
    command = 'xdg-open'
    args = [url]
  }

  try {
    spawn(command, args, { detached: true, stdio: 'ignore' })
    logSuccess('已尝试打开浏览器')
  } catch (error) {
    logWarning('无法自动打开浏览器，请手动打开授权链接')
  }
}

// 显示授权信息
function displayAuthInfo(authUrl, deviceUuid, state) {
  console.log('\n' + '='.repeat(60))
  log(`  请访问以下地址完成授权：`, colors.bright)
  console.log('')
  log(`  ${authUrl}`, colors.cyan + colors.bright)
  console.log('')
  log(`  设备UUID: ${deviceUuid}`, colors.green)
  log(`  状态参数: ${state}`, colors.dim)
  console.log('='.repeat(60))
  logInfo(`回调地址: http://localhost:${CONFIG.callbackPort}${CONFIG.callbackPath}`)
  logInfo(`API服务器: ${CONFIG.baseUrl}`)
  logInfo(`超时时间: ${CONFIG.timeout} 秒`)
  console.log('')
}

// 保存令牌到文件
async function saveToken(token) {
  const fs = await import('fs')
  const path = await import('path')
  const os = await import('os')

  const tokenDir = path.join(os.homedir(), '.classworks')
  const tokenFile = path.join(tokenDir, 'token-callback.txt')

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
    '\n' + colors.cyan + colors.bright + '回调授权流程 - 令牌获取工具' + colors.reset + '\n',
  )

  try {
    // 检查配置
    if (!CONFIG.siteKey) {
      logWarning('未设置 SITE_KEY 环境变量，可能需要站点密钥才能访问')
      logInfo('设置方法: export SITE_KEY=your-site-key')
      console.log('')
    }

    // 1. 获取设备UUID
    logInfo('正在获取设备UUID...')
    const deviceUuid = await getDeviceUuid()
    logSuccess(`设备UUID: ${deviceUuid}`)

    // 2. 生成状态参数
    const state = generateState()

    // 3. 构建回调URL
    const callbackUrl = `http://localhost:${CONFIG.callbackPort}${CONFIG.callbackPath}`

    // 4. 构建授权URL
    const authUrl = new URL(CONFIG.authPageUrl)
    authUrl.searchParams.set('app_id', CONFIG.appId)
    authUrl.searchParams.set('mode', 'callback')
    authUrl.searchParams.set('callback_url', callbackUrl)
    authUrl.searchParams.set('state', state)

    // 5. 显示授权信息
    displayAuthInfo(authUrl.toString(), deviceUuid, state)

    // 6. 启动回调服务器
    logInfo('正在启动回调服务器...')
    const serverPromise = createCallbackServer(state)

    // 7. 打开浏览器
    logInfo('正在尝试打开浏览器...')
    await openBrowser(authUrl.toString())

    // 8. 等待授权完成
    logInfo('等待授权完成...\n')
    const token = await serverPromise

    // 9. 显示令牌
    console.log('\n' + '='.repeat(50))
    logSuccess('授权成功！令牌获取完成')
    console.log('='.repeat(50))
    console.log('\n' + colors.bright + '您的访问令牌：' + colors.reset)
    log(token, colors.green)
    console.log('')

    // 10. 保存令牌
    await saveToken(token)

    // 11. 使用示例
    console.log('\n' + colors.bright + '使用示例：' + colors.reset)
    console.log(`  curl -H "Authorization: Bearer ${token}" ${CONFIG.baseUrl}/kv`)
    console.log('')

    process.exit(0)
  } catch (error) {
    console.log('')
    logError(`错误: ${error.message}`)

    // 提供一些常见问题的解决方案
    if (error.message.includes('EADDRINUSE')) {
      logInfo(`端口 ${CONFIG.callbackPort} 已被占用，请尝试设置不同的端口：`)
      logInfo(`CALLBACK_PORT=8081 node cli/get-token-callback.js`)
    } else if (error.message.includes('无法连接到服务器')) {
      logInfo('请检查API服务器是否正在运行')
      logInfo(`当前API地址: ${CONFIG.baseUrl}`)
    } else if (error.message.includes('授权超时')) {
      logInfo(`授权超时（${CONFIG.timeout}秒），请重新尝试`)
      logInfo('您可以设置更长的超时时间：TIMEOUT=600 node cli/get-token-callback.js')
    }

    console.log('')
    process.exit(1)
  }
}

// 运行
main()
