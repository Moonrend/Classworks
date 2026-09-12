<template>
  <div v-if="visible" class="init-overlay">
    <div class="init-container">
      <div class="init-header">
        <div class="title">欢迎使用 Classworks</div>
        <div class="subtitle">请选择你的使用方式</div>
      </div>

      <!-- 主要选择卡片 -->
      <div class="main-card-row">
        <!-- 初次使用 -->
        <v-card
          class="main-service-card gradient-new clickable"
          elevation="4"
          @click="showGuideDialog = true"
        >
          <v-card-item>
            <div class="card-horizontal-layout">
              <div class="card-icon-wrapper">
                <v-icon color="primary" size="48"> mdi-new-box </v-icon>
              </div>
              <div class="card-content">
                <div class="text-h6 font-weight-bold">初次使用</div>
                <div class="text-body-2 text-medium-emphasis mt-1">
                  了解 Classworks KV 并开始使用
                </div>
              </div>
            </div>
          </v-card-item>
        </v-card>

        <!-- 已注册设备 -->
        <v-card
          class="main-service-card gradient-registered clickable"
          elevation="4"
          @click="showDeviceAuthDialog = true"
        >
          <v-card-item>
            <div class="card-horizontal-layout">
              <div class="card-icon-wrapper">
                <v-icon color="success" size="48"> mdi-account-check </v-icon>
              </div>
              <div class="card-content">
                <div class="text-h6 font-weight-bold">已注册</div>
                <div class="text-body-2 text-medium-emphasis mt-1">使用设备 Namespace 登录</div>
              </div>
            </div>
          </v-card-item>
        </v-card>

        <!-- Classworks KV 控制台 -->
        <v-card class="main-service-card clickable" elevation="4" @click="openClassworksKV">
          <v-card-item>
            <div class="card-horizontal-layout">
              <div class="card-icon-wrapper">
                <v-icon color="info" size="48"> mdi-database-cog </v-icon>
              </div>
              <div class="card-content">
                <div class="text-h6 font-weight-bold">Classworks KV</div>
                <div class="text-body-2 text-medium-emphasis mt-1">打开云端控制台管理数据</div>
              </div>
            </div>
          </v-card-item>
        </v-card>
      </div>

      <div class="options-buttons">
        <v-btn prepend-icon="mdi-laptop" size="small" variant="tonal" @click="useLocalMode">
          使用本地模式
        </v-btn>
        <v-btn prepend-icon="mdi-flash" size="small" variant="tonal" @click="handleAutoAuthorize">
          授权码式授权（弃用）
        </v-btn>
        <v-btn prepend-icon="mdi-key" size="small" variant="tonal" @click="showTokenDialog = true">
          输入 Token
        </v-btn>
        <v-btn
          prepend-icon="mdi-code-tags"
          size="small"
          variant="tonal"
          @click="showAlternativeCodeDialog = true"
        >
          输入替代代码
        </v-btn>
      </div>

      <div class="footer-hint">完成授权后可使用作业同步、考试看板等在线功能。</div>
    </div>

    <!-- 对话框 -->
    <v-dialog v-model="showGuideDialog" max-width="600">
      <FirstTimeGuide @close="showGuideDialog = false" @success="handleGuideSuccess" />
    </v-dialog>

    <v-dialog v-model="showDeviceAuthDialog" eager max-width="500">
      <DeviceAuthDialog
        ref="deviceAuthDialog"
        :preconfig="deviceAuthPreconfig"
        :show-cancel="true"
        @cancel="showDeviceAuthDialog = false"
        @success="handleAuthSuccess"
      />
    </v-dialog>

    <v-dialog v-model="showTokenDialog" max-width="500">
      <TokenInputDialog
        :show-cancel="true"
        @cancel="showTokenDialog = false"
        @success="handleTokenSuccess"
      />
    </v-dialog>

    <v-dialog v-model="showAlternativeCodeDialog" max-width="500">
      <AlternativeCodeDialog
        :show-cancel="true"
        @cancel="showAlternativeCodeDialog = false"
        @submit="handleAlternativeCodeSubmit"
      />
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getSetting, setSetting } from '@/utils/settings'
import DeviceAuthDialog from './auth/DeviceAuthDialog.vue'
import TokenInputDialog from './auth/TokenInputDialog.vue'
import AlternativeCodeDialog from './auth/AlternativeCodeDialog.vue'
import FirstTimeGuide from './auth/FirstTimeGuide.vue'

const props = defineProps({
  preconfig: {
    type: Object,
    default: () => ({
      namespace: null,
      authCode: null,
      autoOpen: false,
      autoExecute: false,
    }),
  },
})

const emit = defineEmits(['done'])

// 控制显示：仅首页且无 kvToken（且 provider 不是 kv-local）显示
const visible = ref(false)

// 对话框控制
const showGuideDialog = ref(false)
const showDeviceAuthDialog = ref(false)
const showTokenDialog = ref(false)
const showAlternativeCodeDialog = ref(false)

// 设备认证对话框引用
const deviceAuthDialog = ref(null)

const provider = computed(() => getSetting('server.provider'))
const isKvProvider = computed(
  () => provider.value === 'kv-server' || provider.value === 'classworkscloud',
)
const kvToken = computed(() => getSetting('server.kvToken'))

// 设备认证预配置数据
const deviceAuthPreconfig = computed(() => {
  if (props.preconfig?.namespace) {
    return {
      namespace: props.preconfig.namespace,
      password: props.preconfig.authCode || '',
      autoExecute: props.preconfig.autoExecute || false,
    }
  }
  return null
})

const evaluateVisibility = () => {
  // 父级 shouldShowInit 已限制仅首页渲染本组件，这里只再确认是否仍需授权
  const need = isKvProvider.value && (!kvToken.value || kvToken.value === '')
  visible.value = need
}

// 预配数据可能在异步组件加载前就已解析完毕；此时 immediate watch 会赶上 visible 仍为 false。
// 因此在 visible 变为 true 后再尝试一次自动打开。
const tryAutoOpenDeviceAuth = () => {
  if (!visible.value || showDeviceAuthDialog.value) return
  if (!props.preconfig?.autoOpen || !props.preconfig?.namespace) return
  console.log('检测到预配数据，自动打开设备认证对话框')
  setTimeout(() => {
    showDeviceAuthDialog.value = true
  }, 500)
}

evaluateVisibility()

watch(
  () => props.preconfig,
  () => {
    tryAutoOpenDeviceAuth()
  },
  { immediate: true, deep: true },
)

watch(visible, (isVisible) => {
  if (isVisible) tryAutoOpenDeviceAuth()
})

onMounted(() => {
  evaluateVisibility()
  tryAutoOpenDeviceAuth()
})

const handleAutoAuthorize = () => {
  const authDomain = getSetting('server.authDomain')
  const appId = 'd158067f53627d2b98babe8bffd2fd7d'
  const currentDomain = window.location.origin
  const callbackUrl = encodeURIComponent(`${currentDomain}/authorizecallback`)
  const uuid = getSetting('device.uuid') || '00000000-0000-4000-8000-000000000000'

  let url = `${authDomain}/authorize?app_id=${appId}&mode=callback&callback_url=${callbackUrl}&remark=Classworks 自动授权 来自${window.location.hostname} ${new Date().toLocaleString()}`
  if (uuid !== '00000000-0000-4000-8000-000000000000') {
    url += `&uuid=${encodeURIComponent(uuid)}`
  }
  window.location.href = url
}

const handleGuideSuccess = (tokenData) => {
  showGuideDialog.value = false
  console.log('渐进式注册成功:', tokenData)
  evaluateVisibility()
  emit('done')
}

const handleAuthSuccess = (tokenData) => {
  showDeviceAuthDialog.value = false
  console.log('认证成功:', tokenData)

  // 如果是通过预配数据成功的，显示成功消息
  if (props.preconfig?.namespace) {
    // 可以在这里添加成功提示
    console.log(`预配数据认证成功: ${props.preconfig.namespace}`)
  }

  evaluateVisibility()
  emit('done')
}

const handleTokenSuccess = () => {
  showTokenDialog.value = false
  evaluateVisibility()
  emit('done')
}

const handleAlternativeCodeSubmit = (code) => {
  console.log('替代代码:', code)
  // TODO: 实现替代代码逻辑
  showAlternativeCodeDialog.value = false
}

const useLocalMode = () => {
  setSetting('server.provider', 'kv-local')
  visible.value = false
  // 轻量刷新以让首页数据源切换
  window.location.reload()
  emit('done')
}

const openClassworksKV = () => {
  window.open(getSetting('server.authDomain'), '_blank')
}
</script>

<style scoped>
.init-overlay {
  position: relative;
}

.init-container {
  max-width: 900px;
  margin: 24px auto;
  padding: 8px 16px;
}

.init-header .title {
  font-size: 28px;
  font-weight: 700;
  text-align: left;
  margin-bottom: 8px;
}

.init-header .subtitle {
  font-size: 14px;
  opacity: 0.75;
  text-align: left;
}

/* 主要卡片 */
.main-card-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 32px;
}

.main-service-card {
  min-height: 100px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.main-service-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.main-service-card .v-card-item {
  padding: 20px 24px;
}

.card-horizontal-layout {
  display: flex;
  align-items: center;
  gap: 20px;
}

.card-icon-wrapper {
  flex-shrink: 0;
}

.card-content {
  flex: 1;
  text-align: left;
}

.gradient-new {
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.12), rgba(103, 80, 164, 0.08) 60%);
  border: 2px solid rgba(33, 150, 243, 0.2);
}

.gradient-registered {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.12), rgba(0, 184, 212, 0.08) 60%);
  border: 2px solid rgba(76, 175, 80, 0.2);
}

.gradient-kv {
  background: linear-gradient(135deg, rgba(0, 184, 212, 0.12), rgba(33, 150, 243, 0.08) 60%);
  border: 2px solid rgba(0, 184, 212, 0.2);
}

/* 其他选项 */
.alternative-options {
  margin-top: 40px;
  padding: 20px;
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 12px;
}

.options-title {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.8;
  margin-bottom: 12px;
  text-align: left;
}

.options-buttons {
  margin-top: 24px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.clickable {
  cursor: pointer;
}

.footer-hint {
  margin-top: 24px;
  font-size: 13px;
  opacity: 0.7;
  text-align: left;
}

@media (max-width: 768px) {
  .card-horizontal-layout {
    gap: 16px;
  }

  .card-icon-wrapper .v-icon {
    font-size: 40px !important;
  }

  .options-buttons {
    flex-direction: column;
  }

  .options-buttons .v-btn {
    width: 100%;
  }
}
</style>
