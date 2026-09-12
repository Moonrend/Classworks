import { DEFAULT_KV_SERVER } from '@classworks/shared'
import { kvLocalProvider } from './providers/kvLocalProvider'
import { kvServerProvider } from './providers/kvServerProvider'
import { getSetting, setSetting } from './settings'
import { getEffectiveServerUrl } from './serverRotation'
import { createEmptyMeta, bumpClock, mergeValues } from './crdtEngine'
import { getCacheEntry, setCacheEntry, CACHE_PREFIX } from './cacheManager'
import {
  initSmartSync,
  destroySmartSync,
  flushAll,
  triggerSyncAfterSuccess,
} from './smartSyncManager'

export const formatResponse = (data) => data

export const formatError = (message, code = 'UNKNOWN_ERROR') => ({
  success: false,
  error: { code, message },
})

function isServerError(result) {
  return result && result.success === false
}

function isNetworkError(result) {
  return isServerError(result) && result.error?.code === 'NETWORK_ERROR'
}

/**
 * 获取设备 ID，用于 CRDT 向量时钟节点标识
 */
function getDeviceId() {
  return getSetting('device.uuid') || 'unknown'
}

/**
 * 规范化服务器返回的数据
 * 某些端点 (如 Bearer token 认证) 返回 {value: [...]} 包装格式，
 * 统一解包为原始数据，保证缓存比较的一致性。
 * @param {*} data — 服务器返回的原始数据
 * @returns {*} 规范化后的数据
 */
function normalizeServerData(data) {
  if (data && typeof data === 'object' && !Array.isArray(data) && 'value' in data) {
    return data.value
  }
  return data
}

// --- Sync manager: 向后兼容的导出 ---
export const syncManager = {
  init: initSmartSync,
  destroy: destroySmartSync,
  flushNow: flushAll,
}

// Helper: check if we should use the server provider
function useServerProvider() {
  const provider = getSetting('server.provider')
  return provider === 'kv-server' || provider === 'classworkscloud'
}

// Main data provider with simplified API
export default {
  // Provider API methods
  loadData: async (key) => {
    if (!useServerProvider()) {
      return kvLocalProvider.loadData(key)
    }

    // Server mode: network-first with CRDT-aware cache
    const rawResult = await kvServerProvider.loadData(key)
    // 规范化: 某些端点返回 {value: [...]} 包装格式，统一解包
    const result = normalizeServerData(rawResult)

    if (!isNetworkError(result)) {
      // 服务器返回成功或非网络错误 (如 NOT_FOUND)
      if (result.success !== false) {
        // 有效数据 — 与本地缓存进行 CRDT 比较
        const cacheEntry = await getCacheEntry(key)
        const deviceId = getDeviceId()

        if (cacheEntry) {
          const cachedData = normalizeServerData(cacheEntry.data)
          const localDataStr = JSON.stringify(cachedData)
          const serverDataStr = JSON.stringify(result)
          const lastSyncedStr = JSON.stringify(
            normalizeServerData(cacheEntry.meta.lastSyncedData) ?? null,
          )

          if (serverDataStr === localDataStr) {
            // 数据完全相同 — 无冲突，直接返回本地
            return cachedData
          }

          if (serverDataStr !== lastSyncedStr) {
            // 服务器数据与上次同步快照不同 — 另一台设备写入了新数据
            const localVc = cacheEntry.meta.vc || {}
            const lastSyncedVc = cacheEntry.meta.lastSyncedVc || {}
            const hasLocalChanges = (localVc[deviceId] || 0) > (lastSyncedVc[deviceId] || 0)

            if (hasLocalChanges) {
              // 本地也有未同步的更改 — CRDT 合并
              const serverMeta = createEmptyMeta('server')
              serverMeta.ts = Date.now()

              const merged = mergeValues(cachedData, cacheEntry.meta, result, serverMeta)

              await setCacheEntry(key, merged.data, merged.meta)
              // 推送合并结果到服务器 (fire-and-forget)
              kvServerProvider.saveData(key, merged.data)
              return merged.data
            } else {
              // 本地无未同步更改 — 采用服务器版本
              const meta = createEmptyMeta(deviceId)
              meta.ts = Date.now()
              meta.lastSyncedData = result
              meta.lastSyncedTs = Date.now()
              meta.lastSyncedVc = { ...meta.vc }
              await setCacheEntry(key, result, meta)
              return result
            }
          } else {
            // 服务器数据 === 上次同步快照，但 ≠ 本地数据
            // 说明本地有未推送的更改，返回本地数据
            return cachedData
          }
        } else {
          // 无本地缓存 — 首次获取
          const meta = createEmptyMeta(deviceId)
          meta.ts = Date.now()
          meta.lastSyncedData = result
          meta.lastSyncedTs = Date.now()
          meta.lastSyncedVc = { ...meta.vc }
          await setCacheEntry(key, result, meta)
          return result
        }
      }
      return result
    }

    // 网络错误 — 从缓存兜底
    const cached = await getCacheEntry(key)
    if (cached) {
      const data = normalizeServerData(cached.data)
      // 直接在数据对象上添加 fromCache 标记 (保持数组类型不变)
      if (typeof data === 'object' && data !== null) {
        data.fromCache = true
      }
      return data
    }

    // 兼容旧格式缓存
    const legacyCached = await kvLocalProvider.loadData(CACHE_PREFIX + key)
    if (legacyCached.success !== false) {
      return { ...legacyCached, fromCache: true }
    }

    return result
  },

  saveData: async (key, data) => {
    if (!useServerProvider()) {
      return kvLocalProvider.saveData(key, data)
    }

    const deviceId = getDeviceId()

    // 读取现有缓存条目获取当前向量时钟
    const existingEntry = await getCacheEntry(key)
    let meta

    if (existingEntry) {
      meta = bumpClock(existingEntry.meta, deviceId)
    } else {
      meta = bumpClock(createEmptyMeta(deviceId), deviceId)
    }

    // Write-through: 先写入本地缓存 (含 CRDT metadata)
    await setCacheEntry(key, data, meta)

    const result = await kvServerProvider.saveData(key, data)

    if (result.success !== false) {
      // 服务器保存成功 — 更新 lastSynced 快照
      meta.lastSyncedData = data
      meta.lastSyncedTs = Date.now()
      meta.lastSyncedVc = { ...meta.vc }
      await setCacheEntry(key, data, meta)
      await kvLocalProvider.removeFromSyncQueue(key)

      // 智能同步: 刷新其他队列中的更改
      triggerSyncAfterSuccess()

      return result
    }

    // 服务器保存失败 — 加入同步队列 (含 CRDT metadata)
    await kvLocalProvider.addToSyncQueue({
      key,
      data,
      timestamp: Date.now(),
      meta,
    })
    return { success: true, queuedForSync: true }
  },

  loadKeys: async (options = {}) => {
    if (!useServerProvider()) {
      return kvLocalProvider.loadKeys(options)
    }

    const result = await kvServerProvider.loadKeys(options)

    if (!isNetworkError(result)) {
      return result
    }

    // Network error — fall back to local cache keys
    return kvLocalProvider.loadKeys(options)
  },

  async getKeyCloudUrl(key, options = {}) {
    const { migrateFromLocal = true, autoConfigureCloud = true } = options

    try {
      const provider = getSetting('server.provider')
      let serverUrl

      // Use effective server URL for classworkscloud provider
      if (provider === 'classworkscloud') {
        serverUrl = getEffectiveServerUrl()
      } else {
        serverUrl = getSetting('server.domain')
      }

      let siteKey = getSetting('server.siteKey')
      const machineId = getSetting('device.uuid')
      let configured = false

      // 检查云端配置是否为空或错误，如果是则使用默认配置
      if (!serverUrl || !machineId) {
        if (autoConfigureCloud) {
          // 使用classworksCloudDefaults配置
          const classworksCloudDefaults = {
            'server.domain': import.meta.env.VITE_DEFAULT_KV_SERVER || DEFAULT_KV_SERVER,
            'server.siteKey': '',
          }

          if (!serverUrl) {
            setSetting('server.domain', classworksCloudDefaults['server.domain'])
            serverUrl = classworksCloudDefaults['server.domain']
            configured = true
          }

          if (!siteKey) {
            setSetting('server.siteKey', classworksCloudDefaults['server.siteKey'])
            siteKey = classworksCloudDefaults['server.siteKey']
          }

          // 设置provider为classworkscloud
          setSetting('server.provider', 'classworkscloud')
          // Get effective URL after setting provider
          serverUrl = getEffectiveServerUrl()
        } else {
          return formatError('云端配置无效，请检查服务器域名和设备UUID', 'CONFIG_ERROR')
        }
      }

      let migrated = false

      // 如果需要迁移本地数据到云端
      if (migrateFromLocal) {
        try {
          // 尝试从本地读取数据
          const localData = await kvLocalProvider.loadData(key)

          // 如果本地有数据且不是错误响应
          if (localData && localData.success !== false) {
            // 检查云端是否已有数据
            const cloudData = await kvServerProvider.loadData(key)

            // 如果云端没有数据，则迁移本地数据
            if (cloudData && cloudData.success === false && cloudData.error?.code === 'NOT_FOUND') {
              const saveResult = await kvServerProvider.saveData(key, localData)
              if (saveResult && saveResult.success !== false) {
                migrated = true
                console.log(`已成功将键 ${key} 的数据从本地迁移到云端`)
              }
            }
          }
        } catch (error) {
          console.warn(`迁移键 ${key} 的数据时出错:`, error)
          // 迁移失败不影响URL生成，继续执行
        }
      }
      // 获取认证token
      const authtoken = getSetting('server.kvToken')
      // 构建云端访问URL
      const url = `${serverUrl}/kv/${key}?token=${authtoken}`

      return {
        success: true,
        url,
        migrated,
        configured,
      }
    } catch (error) {
      console.error('获取键云端地址时出错:', error)
      return formatError(error.message || '获取键云端地址失败', 'CLOUD_URL_ERROR')
    }
  },
}

export const ErrorCodes = {
  NOT_FOUND: '数据不存在',
  NETWORK_ERROR: '网络连接失败',
  SERVER_ERROR: '服务器错误',
  SAVE_ERROR: '保存失败',
  CONFIG_ERROR: '配置错误',
  PERMISSION_DENIED: '无权限访问',
  UNAUTHORIZED: '认证失败',
  CLOUD_URL_ERROR: '云端地址获取失败',
  UNKNOWN_ERROR: '未知错误',
}
