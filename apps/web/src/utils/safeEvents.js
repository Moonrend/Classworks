/**
 * Vue 组件安全事件处理工具
 * 防止组件卸载时的事件处理错误
 */

import { ref, onBeforeUnmount } from 'vue'
import { on } from '@/utils/socketClient'

/**
 * 创建安全的 Vue 组件混入，用于管理事件监听器
 * @returns {Object} Vue mixin 对象
 */
export function createSafeEventMixin() {
  return {
    data() {
      return {
        _isDestroying: false,
        _eventCleanupFunctions: [],
      }
    },

    methods: {
      /**
       * 安全地注册事件监听器
       * @param {Function} registerFn - 注册事件的函数，返回清理函数
       * @returns {Function} 清理函数
       */
      $safeOn(registerFn) {
        if (this._isDestroying) return () => {}

        try {
          const cleanup = registerFn()
          if (typeof cleanup === 'function') {
            this._eventCleanupFunctions.push(cleanup)
            return cleanup
          }
        } catch (error) {
          console.error('事件注册失败:', error)
        }

        return () => {}
      },

      /**
       * 创建安全的事件处理器
       * @param {Function} handler - 原始事件处理器
       * @returns {Function} 安全的事件处理器
       */
      $safeHandler(handler) {
        return (...args) => {
          if (this._isDestroying || !this.$el) return

          try {
            return handler.apply(this, args)
          } catch (error) {
            console.error('事件处理失败:', error)
          }
        }
      },

      /**
       * 安全地执行 DOM 操作
       * @param {Function} domOperation - DOM 操作函数
       */
      $safeDom(domOperation) {
        if (this._isDestroying || !this.$el) return

        try {
          requestAnimationFrame(() => {
            if (!this._isDestroying && this.$el) {
              domOperation()
            }
          })
        } catch (error) {
          console.error('DOM 操作失败:', error)
        }
      },

      /**
       * 清理所有事件监听器
       */
      $cleanupEvents() {
        this._isDestroying = true

        this._eventCleanupFunctions.forEach((cleanup) => {
          try {
            if (typeof cleanup === 'function') {
              cleanup()
            }
          } catch (error) {
            console.warn('事件清理失败:', error)
          }
        })

        this._eventCleanupFunctions = []
      },
    },

    beforeUnmount() {
      this.$cleanupEvents()
    },
  }
}

/**
 * Socket 事件安全处理混入
 */
export const socketEventMixin = {
  ...createSafeEventMixin(),

  methods: {
    /**
     * 安全地注册 socket 事件监听器
     * @param {string} event - 事件名
     * @param {Function} handler - 事件处理器
     * @returns {Function} 清理函数
     */
    $socketOn(event, handler) {
      return this.$safeOn(() => {
        return on(event, this.$safeHandler(handler))
      })
    },
  },
}

/**
 * 为现有组件添加安全事件处理
 * @param {Object} component - Vue 组件选项
 * @returns {Object} 增强后的组件选项
 */
export function withSafeEvents(component) {
  const safeMixin = createSafeEventMixin()

  return {
    ...component,
    mixins: [...(component.mixins || []), safeMixin],

    // 增强现有的 beforeUnmount
    beforeUnmount() {
      // 调用原有的 beforeUnmount
      if (component.beforeUnmount) {
        try {
          component.beforeUnmount.call(this)
        } catch (error) {
          console.error('原 beforeUnmount 执行失败:', error)
        }
      }

      // 调用安全清理
      if (this.$cleanupEvents) {
        this.$cleanupEvents()
      }
    },
  }
}

/**
 * Composition API 版本的安全事件处理
 */
export function useSafeEvents() {
  const isDestroying = ref(false)
  const cleanupFunctions = ref([])

  const safeOn = (registerFn) => {
    if (isDestroying.value) return () => {}

    try {
      const cleanup = registerFn()
      if (typeof cleanup === 'function') {
        cleanupFunctions.value.push(cleanup)
        return cleanup
      }
    } catch (error) {
      console.error('事件注册失败:', error)
    }

    return () => {}
  }

  const safeHandler = (handler) => {
    return (...args) => {
      if (isDestroying.value) return

      try {
        return handler(...args)
      } catch (error) {
        console.error('事件处理失败:', error)
      }
    }
  }

  const safeDom = (domOperation) => {
    if (isDestroying.value) return

    try {
      requestAnimationFrame(() => {
        if (!isDestroying.value) {
          domOperation()
        }
      })
    } catch (error) {
      console.error('DOM 操作失败:', error)
    }
  }

  const cleanup = () => {
    isDestroying.value = true

    cleanupFunctions.value.forEach((fn) => {
      try {
        if (typeof fn === 'function') {
          fn()
        }
      } catch (error) {
        console.warn('事件清理失败:', error)
      }
    })

    cleanupFunctions.value = []
  }

  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    isDestroying: isDestroying.value,
    safeOn,
    safeHandler,
    safeDom,
    cleanup,
  }
}

export default {
  createSafeEventMixin,
  socketEventMixin,
  withSafeEvents,
  useSafeEvents,
}
