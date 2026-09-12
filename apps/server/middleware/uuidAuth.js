/**
 * UUID+密码/JWT混合认证中间件
 *
 * 1. 必须提供UUID，读取设备信息并存储到res.locals
 * 2. 验证密码或账户JWT（二选一）
 * 3. 适用于需要设备上下文的接口
 */
import errors from '../utils/errors.js'
import { verifyToken as verifyAccountJWT } from '../utils/jwt.js'
import { verifyDevicePassword } from '../utils/crypto.js'
import { prisma } from '../utils/prisma.js'
import { HEADER_DEVICE_UUID, HEADER_DEVICE_PASSWORD } from '@classworks/shared'

/**
 * UUID+密码/JWT混合认证中间件
 */
export const uuidAuth = async (req, res, next) => {
  try {
    // 1. 获取UUID（必需）
    const uuid = extractUuid(req)
    if (!uuid) {
      return next(errors.createError(400, '需要提供设备UUID'))
    }

    // 2. 查找设备并存储到locals
    const device = await prisma.device.findUnique({
      where: { uuid },
    })

    if (!device) {
      return next(errors.createError(404, '设备不存在'))
    }

    // 存储设备信息到locals
    res.locals.device = device
    res.locals.deviceId = device.id

    // 3. 验证密码或JWT（二选一）
    const password = extractPassword(req)
    const jwt = extractJWT(req)

    if (jwt) {
      // 验证账户JWT
      try {
        const accountPayload = await verifyAccountJWT(jwt)
        const account = await prisma.account.findUnique({
          where: { id: accountPayload.accountId },
          include: {
            devices: {
              where: { uuid },
              select: { id: true },
            },
          },
        })

        if (!account) {
          return next(errors.createError(401, '账户不存在'))
        }

        // 检查设备是否绑定到此账户
        if (account.devices.length === 0) {
          return next(errors.createError(403, '设备未绑定到此账户'))
        }

        res.locals.account = account
        res.locals.isAccountOwner = true // 标记为账户拥有者
        return next()
      } catch (error) {
        return next(errors.createError(401, '无效的JWT token'))
      }
    } else if (password) {
      // 验证设备密码
      if (!device.password) {
        return next() // 如果设备未设置密码，允许无密码访问
      }

      const isValid = await verifyDevicePassword(password, device.password)
      if (!isValid) {
        return next(errors.createError(401, '密码错误'))
      }

      return next()
    } else {
      // 如果设备未设置密码，允许无密码访问
      if (!device.password) {
        return next()
      }
      return next(errors.createError(401, '需要提供密码或JWT token'))
    }
  } catch (error) {
    next(error)
  }
}
export const extractDeviceInfo = async (req, res, next) => {
  var uuid = extractUuid(req)

  if (!uuid) {
    throw errors.createError(400, '需要提供设备UUID')
  }
  const device = await prisma.device.findUnique({
    where: { uuid },
  })
  if (!device) {
    throw errors.createError(404, '设备不存在')
  }
  res.locals.device = device
  res.locals.deviceId = device.id
  next()
}

/**
 * 从请求中提取UUID
 */
function extractUuid(req) {
  return (
    req.headers[HEADER_DEVICE_UUID] ||
    req.query.uuid ||
    req.params.uuid ||
    req.params.deviceUuid ||
    (req.body && req.body.uuid) ||
    (req.body && req.body.deviceUuid)
  )
}

/**
 * 从请求中提取密码
 */
function extractPassword(req) {
  return req.headers[HEADER_DEVICE_PASSWORD] || req.query.password || req.query.currentPassword
}

/**
 * 从请求中提取JWT
 */
function extractJWT(req) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}
