<template>
  <v-card class="auth-card">
    <v-card-text class="pa-8">
      <div class="text-center mb-6">
        <v-icon class="mb-4" color="success" size="80"> mdi-account-key </v-icon>
        <h2 class="text-h4 mb-3">设备认证</h2>
        <p class="text-body-1 text-medium-emphasis">输入你在 Classworks KV 获取的认证信息</p>
      </div>

      <v-card class="pa-4 mb-6" color="info" variant="tonal">
        <div class="text-body-2">
          <v-icon class="mr-2" size="20"> mdi-information </v-icon>
          对于已有UUID的用户，您应当使用UUID与您的密码登录。
        </div>
      </v-card>

      <div class="form-section">
        <v-text-field
          v-model="form.namespace"
          class="mb-4"
          hide-details="auto"
          label="命名空间"
          prepend-inner-icon="mdi-identifier"
          variant="outlined"
        />

        <v-text-field
          v-model="form.password"
          label="认证码"
          prepend-inner-icon="mdi-lock-outline"
          type="text"
          variant="outlined"
        />

        <v-alert
          v-if="error"
          class="mt-4"
          closable
          type="error"
          variant="tonal"
          @click:close="error = ''"
        >
          {{ error }}
        </v-alert>
      </div>
    </v-card-text>

    <v-card-actions class="pa-6 pt-0">
      <v-btn v-if="showCancel" size="large" variant="text" @click="$emit('cancel')"> 取消 </v-btn>
      <v-spacer />
      <v-btn
        :disabled="!form.namespace || authenticating"
        :loading="authenticating"
        class="px-8"
        color="primary"
        size="x-large"
        variant="elevated"
        @click="authenticate"
      >
        <v-icon size="24" start> mdi-login </v-icon>
        <span class="text-h6">认证并登录</span>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getSetting, setSetting } from '@/utils/settings'
import axios from '@/axios/axios'

const props = defineProps({
  showCancel: {
    type: Boolean,
    default: false,
  },
  preconfig: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['success', 'cancel'])

const form = ref({
  namespace: '',
  password: '',
})
const authenticating = ref(false)
const error = ref('')
let autoExecuteStarted = false

// 监听预配置数据变化
watch(
  () => props.preconfig,
  (newPreconfig) => {
    if (newPreconfig) {
      console.log('应用预配置数据:', newPreconfig)
      form.value.namespace = newPreconfig.namespace || ''
      form.value.password = newPreconfig.password || ''

      // 如果启用自动执行且有命名空间，自动尝试认证
      if (newPreconfig.autoExecute && newPreconfig.namespace && !autoExecuteStarted) {
        autoExecuteStarted = true
        console.log('检测到自动执行标志且有命名空间，自动执行认证')
        // 延迟一下确保UI已更新
        setTimeout(() => {
          authenticate()
        }, 300)
      } else if (newPreconfig.namespace) {
        console.log('预配置数据已填入，等待手动认证')
      }
    }
  },
  { immediate: true, deep: true },
)

const authenticate = async () => {
  if (!form.value.namespace || authenticating.value) return
  error.value = ''
  authenticating.value = true

  try {
    const serverUrl = getSetting('server.domain')
    if (!serverUrl) throw new Error('未配置服务器域名')

    // 验证设备并获取 token
    const response = await axios.post(`${serverUrl}/apps/auth/token`, {
      namespace: form.value.namespace,
      password: form.value.password || undefined,
      appId: 'd158067f53627d2b98babe8bffd2fd7d',
    })

    if (!response.data.success) {
      throw new Error('设备验证失败')
    }

    const tokenData = response.data

    // 保存 Token
    setSetting('server.kvToken', tokenData.token)

    // 如果返回了 device 信息，保存 uuid
    if (tokenData.device?.uuid) {
      setSetting('device.uuid', tokenData.device.uuid)
    }

    emit('success', tokenData)
  } catch (err) {
    const status = err?.response?.status
    if (status === 401 || status === 403) {
      error.value = '密码错误或无权限访问'
    } else if (status === 404) {
      error.value = '设备不存在,请检查 namespace 是否正确'
    } else {
      error.value = err?.response?.data?.error?.message || err?.message || '认证失败,请稍后重试'
    }
  } finally {
    authenticating.value = false
  }
}

// 暴露清空表单的方法
defineExpose({
  reset: () => {
    form.value = { namespace: '', password: '' }
    error.value = ''
  },
})
</script>

<style scoped>
.auth-card {
  max-width: 100%;
  min-height: 500px;
}

.form-section {
  max-width: 600px;
  margin: 0 auto;
}

/* 触屏优化 */
.v-btn {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.v-btn.v-btn--size-x-large {
  min-height: 60px;
}
</style>
