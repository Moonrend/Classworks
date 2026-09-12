<template>
  <v-app-bar class="no-select">
    <v-app-bar-title>
      {{ titleText }}
    </v-app-bar-title>

    <v-spacer />

    <template #append>
      <!-- 只读 Token 警告 -->
      <v-chip
        v-if="tokenDisplayInfo.readonly"
        class="mx-2"
        color="warning"
        prepend-icon="mdi-lock-alert"
        variant="tonal"
      >
        只读
      </v-chip>

      <!-- 学生名称显示 chip（始终蓝色） -->
      <v-chip
        v-if="tokenDisplayInfo.show"
        :style="{ cursor: tokenDisplayInfo.disabled ? 'default' : 'pointer' }"
        class="mx-2"
        color="primary"
        prepend-icon="mdi-account"
        variant="tonal"
        @click="handleTokenChipClick"
      >
        {{ tokenDisplayInfo.text }}
      </v-chip>

      <v-btn
        v-if="shouldShowUrgentTestButton"
        prepend-icon="mdi-chat"
        variant="tonal"
        @click="urgentTestDialog = true"
      >
        发送通知
      </v-btn>
      <v-btn icon="mdi-chat" variant="text" @click="isChatOpen = true" />
      <v-btn
        :badge="unreadCount || undefined"
        :badge-color="unreadCount ? 'error' : undefined"
        icon="mdi-bell"
        variant="text"
        @click="$refs.messageLog.drawer = true"
      />
      <v-btn icon="mdi-cog" variant="text" @click="$router.push('/settings')" />
    </template>
  </v-app-bar>
  <!-- 初始化选择卡片，仅在首页且需要授权时显示；不影响顶栏 -->
  <init-service-chooser v-if="shouldShowInit" :preconfig="preconfigData" @done="settingsTick++" />

  <!-- 学生姓名管理组件 -->
  <StudentNameManager
    v-if="!shouldShowInit"
    ref="studentNameManager"
    @token-info-updated="updateTokenDisplayInfo"
  />

  <!-- 首屏骨架屏（数据加载中显示） -->
  <HomeSkeleton v-if="!shouldShowInit && !dataReady" />

  <div v-if="!shouldShowInit && dataReady" class="d-flex">
    <!-- 主要内容区域 -->
    <v-container class="main-window flex-grow-1 no-select bloom-container" fluid>
      <!-- 常驻通知区域 -->
      <v-row v-if="persistentNotifications.length > 0" class="mb-4">
        <v-col cols="12">
          <v-card
            v-for="notification in persistentNotifications"
            :key="notification.id"
            :color="notification.isUrgent ? 'error' : 'primary'"
            class="mb-2 cursor-pointer"
            variant="tonal"
            @click="showNotificationDetail(notification)"
          >
            <v-card-text class="d-flex align-center py-3">
              <span class="text-h6 text-truncate font-weight-bold">{{ notification.message }}</span>
              <v-spacer />
              <v-btn icon="mdi-chevron-right" variant="text" />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 通知详情对话框 -->
      <v-dialog v-model="notificationDetailDialog" max-width="700" scrollable>
        <v-card v-if="currentNotification" class="rounded-xl">
          <v-card-title class="d-flex align-center pa-4 text-h5">
            <span
              :class="currentNotification.isUrgent ? 'text-error' : ''"
              class="font-weight-bold"
            >
              {{ currentNotification.isUrgent ? '强调通知' : '通知详情' }}
            </span>
            <v-spacer />
            <v-btn icon="mdi-close" variant="text" @click="notificationDetailDialog = false" />
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-6">
            <div class="text-h4 font-weight-medium mb-4" style="line-height: 1.5">
              {{ currentNotification.message }}
            </div>
            <div class="text-subtitle-1 text-grey">
              发布时间：{{ formatTime(currentNotification.timestamp) }}
            </div>
          </v-card-text>

          <v-divider />

          <v-card-actions class="pa-4">
            <v-btn
              color="error"
              prepend-icon="mdi-delete"
              size="x-large"
              variant="tonal"
              class="px-6"
              @click="removePersistentNotification(currentNotification.id)"
            >
              删除通知
            </v-btn>
            <v-spacer />
            <v-btn
              color="primary"
              size="x-large"
              variant="elevated"
              class="px-8"
              @click="notificationDetailDialog = false"
            >
              关闭
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <homework-grid
        :sorted-items="sortedItems"
        :unused-subjects="unusedSubjects"
        :empty-subject-display="emptySubjectDisplay"
        :is-mobile="isMobile"
        :is-editing-disabled="isEditingDisabled"
        :content-style="state.contentStyle"
        :highlighted-cards="highlightedCards"
        @open-dialog="openDialog"
        @open-attendance="setAttendanceArea"
        @disabled-click="handleDisabledClick"
        @open-exam-detail="openExamDetail"
      />

      <home-actions
        :synced="state.synced"
        :loading-upload="loading.upload"
        :show-random-picker-button="showRandomPickerButton"
        :show-exam-schedule-button="showExamScheduleButton"
        :show-list-card-button="showListCardButton"
        :show-fullscreen-button="showFullscreenButton"
        :is-fullscreen="state.isFullscreen"
        :show-anti-screen-burn-card="showAntiScreenBurnCard"
        :show-test-card-button="showTestCardButton"
        :show-uaf-transfer-button="showUafTransferButton"
        :uaf-transfer-loading="loading.exportUaf"
        @upload="manualUpload"
        @show-sync-message="showSyncMessage"
        @open-random-picker="openRandomPicker"
        @toggle-fullscreen="toggleFullscreen"
        @add-test-card="addTestCard"
        @add-exam-card="showAddExamDialog = true"
        @open-uaf-export="openUafTransfer('export')"
        @open-uaf-import="openUafTransfer('import')"
      />

      <uaf-transfer-dialog
        v-model="uafTransfer.show"
        :mode="uafTransfer.mode"
        :current-date="state.dateString"
        :current-items="sortedItems"
        :current-board-data="state.boardData"
        :subjects="state.availableSubjects"
        @success="handleUafSuccess"
        @error="handleUafError"
        @imported="handleUafImported"
      />

      <pwa-install-card />

      <!-- 推荐添加考试提示 -->
      <v-alert
        v-if="upcomingExams.length > 0 && !hasExamCard"
        class="mt-4"
        color="info"
        variant="tonal"
        closable
        icon="mdi-calendar-clock"
        title="近期有考试安排"
      >
        <div class="d-flex align-center flex-wrap">
          <span class="mr-2">检测到未来两天内有以下考试：</span>
          <v-chip
            v-for="exam in upcomingExams"
            :key="exam.id"
            size="small"
            class="mr-1 mb-1"
            color="primary"
          >
            {{ exam.examName }}
          </v-chip>
        </div>
        <template #append>
          <v-btn color="primary" variant="text" @click="addAllUpcomingExams"> 一键添加 </v-btn>
        </template>
      </v-alert>
    </v-container>

    <!-- 出勤统计区域 -->
    <attendance-sidebar
      v-if="!isMobile"
      :student-list="state.studentList"
      :attendance="state.boardData.attendance"
      :is-editing-disabled="isEditingDisabled"
      @click="setAttendanceArea"
      @disabled-click="handleDisabledClick"
    />
  </div>

  <homework-edit-dialog
    v-model="state.dialogVisible"
    :auto-save="autoSave"
    :initial-content="state.textarea"
    :title="state.dialogTitle"
    :is-editing-past-data="isEditingPastData"
    :current-date-string="state.dateString"
    @save="handleHomeworkSave"
  />

  <v-snackbar v-model="state.snackbar" :timeout="2000">
    {{ state.snackbarText }}
  </v-snackbar>

  <attendance-management-dialog
    v-model="state.attendanceDialog"
    :student-list="state.studentList"
    :attendance="state.boardData.attendance"
    :date-string="state.dateString"
    @save="saveAttendance"
    @change="handleAttendanceChange"
  />

  <message-log ref="messageLog" />

  <!-- 添加悬浮工具栏 -->
  <floating-toolbar
    :is-today="isToday"
    :loading="loading.download"
    :copy-to-today-loading="loading.copyToToday"
    :selected-date="state.selectedDateObj"
    :unread-count="unreadCount"
    @refresh="downloadData"
    @zoom="zoom"
    @open-messages="$refs.messageLog.drawer = true"
    @open-settings="$router.push('/settings')"
    @date-select="handleDateSelect"
    @prev-day="navigateDay(-1)"
    @next-day="navigateDay(1)"
    @copy-to-today="copyHomeworkToToday"
  />

  <!-- 添加ICP备案悬浮组件 -->
  <FloatingICP />

  <!-- 设备聊天室（右下角浮窗） -->
  <ChatWidget v-model="isChatOpen" :show-button="false" />

  <!-- 紧急通知测试对话框 -->
  <UrgentTestDialog v-model="urgentTestDialog" />

  <!-- 添加确认对话框 -->
  <v-dialog v-model="confirmDialog.show" max-width="400">
    <v-card>
      <v-card-title class="text-h6"> 确认保存 </v-card-title>
      <v-card-text> 您正在修改 {{ state.dateString }} 的数据，确定要保存吗？ </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="grey" variant="text" @click="confirmDialog.reject"> 取消 </v-btn>
        <v-btn color="primary" @click="confirmDialog.resolve"> 确认保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- 添加随机点名组件 -->
  <random-picker
    ref="randomPicker"
    :attendance="state.boardData.attendance"
    :student-list="state.studentList"
  />

  <!-- 添加URL配置确认对话框 -->
  <v-dialog v-model="urlConfigDialog.show" max-width="500">
    <v-card>
      <v-card-title class="text-h6"> 确认应用URL配置 </v-card-title>
      <v-card-text>
        <p>以下配置将应用于当前班级：</p>
        <v-list density="compact">
          <v-list-item v-for="change in urlConfigDialog.changes" :key="change.key">
            <template #prepend>
              <v-icon :icon="change.icon" class="mr-2" size="small" />
            </template>
            <v-list-item-title class="d-flex align-center">
              <span class="text-subtitle-1">{{ change.name }}</span>
              <v-tooltip activator="parent" location="top">
                {{ change.description || change.key }}
              </v-tooltip>
            </v-list-item-title>
            <v-list-item-subtitle>
              <span class="text-grey-darken-1">{{ change.oldValue }}</span>
              <v-icon class="mx-1" icon="mdi-arrow-right" size="small" />
              <span class="text-primary font-weight-medium">{{ change.newValue }}</span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="grey" variant="text" @click="urlConfigDialog.cancelHandler"> 取消 </v-btn>
        <v-btn color="primary" @click="urlConfigDialog.confirmHandler"> 确认应用 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- 考试详情/编辑对话框 -->
  <v-dialog v-model="showExamDetailDialog" persistent fullscreen>
    <v-card v-if="selectedExamId">
      <v-card-title class="d-flex align-center pa-4">
        编辑考试配置
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="showExamDetailDialog = false" />
      </v-card-title>
      <v-card-text class="pa-4" style="max-height: 70vh; overflow-y: auto">
        <exam-config-editor
          :config-id="selectedExamId"
          :dialog-mode="true"
          @saved="onExamConfigSaved"
          @deleted="onExamConfigDeleted"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4">
        <v-btn
          color="error"
          prepend-icon="mdi-delete"
          variant="tonal"
          @click="removeCurrentExamCard"
        >
          移除卡片
        </v-btn>
        <v-spacer />
        <v-btn color="primary" variant="text" @click="showExamDetailDialog = false"> 关闭 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- 添加考试卡片对话框 -->
  <v-dialog v-model="showAddExamDialog" max-width="500">
    <v-card>
      <v-card-title class="text-h6"> 考试看板 </v-card-title>
      <v-card-text>
        <v-list>
          <v-list-item
            active
            color="green"
            append-icon="mdi-arrow-right"
            @click="$router.push('/examschedule')"
          >
            打开考试看板
          </v-list-item>
        </v-list>
        <v-list v-if="examStore.examList.length > 0">
          <v-list-item
            v-for="exam in examStore.examList"
            :key="exam.id"
            :title="examStore.exams[exam.id]?.examName || exam.id"
            :subtitle="exam.id"
            @click="addExamCard(exam.id)"
          >
            <template #prepend>
              <v-icon color="primary"> mdi-calendar-text </v-icon>
            </template>
            <template #append>
              <v-btn
                :icon="isExamCardAdded(exam.id) ? 'mdi-check' : 'mdi-plus'"
                :color="isExamCardAdded(exam.id) ? 'success' : 'grey'"
                variant="text"
              />
            </template>
          </v-list-item>
        </v-list>
        <div v-else class="text-center py-4 text-grey">暂无考试配置</div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="text" @click="showAddExamDialog = false"> 关闭 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <!-- 通知详情对话框 -->
  <v-dialog v-model="notificationDetailDialog" max-width="600">
    <v-card v-if="currentNotification">
      <v-card-title
        class="headline"
        :class="currentNotification.isUrgent ? 'text-error' : 'text-primary'"
      >
        {{ currentNotification.isUrgent ? '强调通知' : '通知详情' }}
      </v-card-title>
      <v-card-text class="text-h5 py-4">
        {{ currentNotification.message }}
      </v-card-text>
      <v-card-actions>
        <v-btn
          color="error"
          variant="text"
          @click="removePersistentNotification(currentNotification.id)"
        >
          删除
        </v-btn>
        <v-spacer />
        <v-btn color="primary" @click="notificationDetailDialog = false"> 关闭 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <br /><br /><br />
</template>

<script>
import { defineAsyncComponent } from 'vue'
import AsyncLoadingPlaceholder from '@/components/common/AsyncLoadingPlaceholder.vue'

// ===== 首屏核心组件（同步加载）=====
import HomeworkGrid from '@/components/home/HomeworkGrid.vue'
import HomeActions from '@/components/home/HomeActions.vue'
import FloatingICP from '@/components/FloatingICP.vue'
import HitokotoCard from '@/components/HitokotoCard.vue'
import HomeSkeleton from '@/components/common/HomeSkeleton.vue'

// ===== 非首屏 / 条件渲染组件（异步懒加载）=====
const MessageLog = defineAsyncComponent({
  loader: () => import('@/components/MessageLog.vue'),
  loadingComponent: AsyncLoadingPlaceholder,
  delay: 200,
})
const RandomPicker = defineAsyncComponent({
  loader: () => import('@/components/RandomPicker.vue'),
  delay: 0,
})
const FloatingToolbar = defineAsyncComponent({
  loader: () => import('@/components/FloatingToolbar.vue'),
  delay: 200,
})
const ChatWidget = defineAsyncComponent({
  loader: () => import('@/components/ChatWidget.vue'),
  delay: 0,
})
const HomeworkEditDialog = defineAsyncComponent({
  loader: () => import('@/components/HomeworkEditDialog.vue'),
  delay: 0,
})
const UafTransferDialog = defineAsyncComponent({
  loader: () => import('@/components/home/UafTransferDialog.vue'),
  delay: 0,
})
const InitServiceChooser = defineAsyncComponent({
  loader: () => import('@/components/InitServiceChooser.vue'),
  loadingComponent: AsyncLoadingPlaceholder,
  delay: 200,
})
const StudentNameManager = defineAsyncComponent({
  loader: () => import('@/components/StudentNameManager.vue'),
  delay: 200,
})
const UrgentTestDialog = defineAsyncComponent({
  loader: () => import('@/components/UrgentTestDialog.vue'),
  delay: 0,
})
const AttendanceSidebar = defineAsyncComponent({
  loader: () => import('@/components/attendance/AttendanceSidebar.vue'),
  loadingComponent: AsyncLoadingPlaceholder,
  delay: 200,
})
const AttendanceManagementDialog = defineAsyncComponent({
  loader: () => import('@/components/attendance/AttendanceManagementDialog.vue'),
  delay: 0,
})
const PwaInstallCard = defineAsyncComponent({
  loader: () => import('@/components/PwaInstallCard.vue'),
  delay: 200,
})
const ExamScheduleCard = defineAsyncComponent({
  loader: () => import('@/components/home/ExamScheduleCard.vue'),
  loadingComponent: AsyncLoadingPlaceholder,
  delay: 200,
})
const ExamConfigEditor = defineAsyncComponent({
  loader: () => import('@/components/ExamConfigEditor.vue'),
  delay: 0,
})
import dataProvider, { syncManager } from '@/utils/dataProvider'
import { useExamStore } from '@/stores/examStore'
import { getSetting, watchSettings, setSetting, settingsDefinitions } from '@/utils/settings'
import { kvServerProvider } from '@/utils/providers/kvServerProvider'
import { useDisplay } from 'vuetify'
import { debounce, throttle } from '@/utils/debounce'
import { Base64 } from 'js-base64'
import {
  getSocket,
  on as socketOn,
  joinToken,
  leaveAll,
  onConnect as onSocketConnect,
} from '@/utils/socketClient'
import { createDeviceEventHandler } from '@/utils/deviceEvents'
import axios from '@/axios/axios'

export default {
  name: 'Classworks 作业板',
  components: {
    MessageLog,
    RandomPicker,
    FloatingToolbar,
    FloatingICP,
    HomeworkEditDialog,
    InitServiceChooser,
    ChatWidget,
    StudentNameManager,
    UrgentTestDialog,
    AttendanceSidebar,
    AttendanceManagementDialog,
    HomeworkGrid,
    HomeActions,
    PwaInstallCard,
    ExamScheduleCard,
    ExamConfigEditor,
    HomeSkeleton,
    UafTransferDialog,
  },
  setup() {
    const { mobile } = useDisplay()
    const examStore = useExamStore()
    return { mobile, examStore }
  },
  data() {
    const defaultSubjects = [
      { name: '语文', order: 0 },
      { name: '数学', order: 1 },
      { name: '英语', order: 2 },
      { name: '物理', order: 3 },
      { name: '化学', order: 4 },
      { name: '生物', order: 5 },
      { name: '政治', order: 6 },
      { name: '历史', order: 7 },
      { name: '地理', order: 8 },
      { name: '其他', order: 9 },
    ]

    return {
      // examCards: [], // Removed
      showAddExamDialog: false,
      showExamDetailDialog: false,
      selectedExamId: null,
      upcomingExams: [],
      dataKey: '',
      provider: '',
      useDisplay: useDisplay,
      state: {
        classNumber: '',
        // 当前命名空间/设备信息（从云端加载）
        namespaceInfo: null,
        deviceName: '',
        studentList: [],
        boardData: {
          homework: {},
          attendance: {
            absent: [],
            late: [],
            exclude: [],
          },
        },
        dialogVisible: false,
        dialogTitle: '',
        textarea: '',
        dateString: '',
        synced: false,
        attendDialogVisible: false,
        contentStyle: { 'font-size': `${getSetting('font.size')}px` },
        uploadLoading: false,
        downloadLoading: false,
        snackbar: false,
        snackbarText: '',
        fontSize: getSetting('font.size'),
        datePickerDialog: false,
        selectedDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
        selectedDateObj: new Date(),
        refreshInterval: null,
        showNoDataMessage: false,
        noDataMessage: '',
        isToday: false,
        attendanceDialog: false,
        availableSubjects: defaultSubjects,
        isFullscreen: false,
      },
      loading: {
        download: false,
        upload: false,
        students: false,
        copyToToday: false,
        exportUaf: false,
      },
      uafTransfer: {
        show: false,
        mode: 'export',
      },
      dataReady: false,
      debouncedUpload: null,
      debouncedAttendanceSave: null,
      throttledReflow: null,
      sortedItemsCache: {
        key: '',
        value: [],
      },
      confirmDialog: {
        show: false,
        resolve: null,
        reject: null,
      },
      urlConfigDialog: {
        show: false,
        config: null,
        changes: [],
        validSettings: {},
        confirmHandler: null,
        cancelHandler: null,
        icons: {},
      },
      settingsTick: 0,
      isChatOpen: false,
      highlightedCards: {}, // 记录哪些卡片需要高亮
      // Token 显示信息（统一显示 token 信息和学生姓名）
      tokenDisplayInfo: {
        show: false,
        readonly: false, // 是否是只读 token
        text: '',
        color: 'primary',
        variant: 'tonal',
        icon: 'mdi-account',
        disabled: false,
      },
      // 实时刷新信息
      realtimeInfo: {
        show: false,
        time: '',
        key: '',
      },
      $offKvChanged: null,
      $offConnect: null,
      debouncedRealtimeRefresh: null,
      // 预配数据
      preconfigData: {
        namespace: null,
        authCode: null,
        autoOpen: false,
        autoExecute: false,
      },
      // 紧急通知测试对话框
      urgentTestDialog: false,
      // 令牌信息
      tokenInfo: null,

      // 常驻通知
      persistentNotifications: [],
      notificationDetailDialog: false,
      currentNotification: null,
    }
  },

  computed: {
    isMobile() {
      // 如果启用了强制一体机UI模式，返回false（使用桌面UI）
      const forceDesktopMode = getSetting('display.forceDesktopMode')
      if (forceDesktopMode) {
        return false
      }
      return this.mobile
    },
    titleText() {
      const provider = getSetting('server.provider')
      const isOnline = provider === 'kv-server' || provider === 'classworkscloud'

      let displayName
      if (isOnline && this.state.namespaceInfo) {
        // 非离线模式：优先使用自动获取的命名空间名称
        displayName =
          this.state.namespaceInfo?.name ||
          this.state.namespaceInfo?.device?.name ||
          this.state.classNumber ||
          '高三八班'
      } else {
        // 离线模式：使用本地设置的班级编号
        displayName = this.state.classNumber || '高三八班'
      }

      const today = this.getToday()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const currentDateStr = this.state.dateString
      const todayStr = this.formatDate(today)
      const yesterdayStr = this.formatDate(yesterday)

      if (currentDateStr === todayStr) {
        return displayName + ' - 今天的作业'
      } else if (currentDateStr === yesterdayStr) {
        return displayName + ' - 昨天的作业'
      } else {
        return `${displayName} - ${currentDateStr}的作业`
      }
    },
    sortedItems() {
      const items = []

      // 如果是移动端，添加出勤卡片
      if (this.isMobile) {
        items.push({
          key: 'attendance-card',
          name: '出勤统计',
          type: 'attendance',
          data: {
            total: this.state.studentList.length,
            absent: this.state.boardData.attendance.absent,
            late: this.state.boardData.attendance.late,
            exclude: this.state.boardData.attendance.exclude,
          },
        })
      }

      // 添加考试卡片
      for (const key in this.state.boardData.homework) {
        if (key.startsWith('exam-')) {
          const card = this.state.boardData.homework[key]
          items.push({
            key: key,
            name: '考试安排',
            type: 'exam',
            data: {
              examId: card.examId,
            },
            order: -100, // Ensure they appear at the top
            rowSpan: 200, // Estimated height
          })
        }
      }

      // 添加作业卡片
      for (const subject of this.state.availableSubjects) {
        const subjectKey = subject.name
        const subjectData = this.state.boardData.homework[subjectKey]

        if (subjectData && subjectData.content) {
          const lineCount = subjectData.content.split('\n').filter((line) => line.trim()).length
          // Estimate height in pixels: title(64) + padding(32) + lines * line-height(24) + extra
          const estimatedHeight = 100 + lineCount * 24

          items.push({
            key: subjectKey,
            name: subjectKey,
            type: 'homework',
            content: subjectData.content,
            tags: Array.isArray(subjectData.tags) ? subjectData.tags : [],
            order: subject.order,
            rowSpan: estimatedHeight, // Used for sorting only
          })
        }
      }

      // 添加时间卡片
      if (getSetting('timeCard.enabled')) {
        items.push({
          key: 'time-card',
          name: '时间',
          type: 'time',
          order: 9997,
          rowSpan: 150,
        })
      }

      // 添加一言卡片
      if (getSetting('hitokoto.enabled')) {
        items.push({
          key: 'hitokoto-card',
          name: '一言',
          type: 'hitokoto',
          order: 9998,
          rowSpan: 150, // Default estimated height
        })
      }

      // 添加自定义卡片
      for (const key in this.state.boardData.homework) {
        if (key.startsWith('custom-')) {
          const card = this.state.boardData.homework[key]
          const lineCount = card.content.split('\n').filter((line) => line.trim()).length
          const estimatedHeight = 100 + lineCount * 24

          items.push({
            key: key,
            name: card.name,
            type: 'custom',
            content: card.content,
            tags: Array.isArray(card.tags) ? card.tags : [],
            order: 9999, // Put at the end
            rowSpan: estimatedHeight, // Used for sorting only
          })
        }
      }

      // 按照顺序排序
      items.sort((a, b) => a.order - b.order)

      return items
    },
    unusedSubjects() {
      const usedKeys = Object.keys(this.state.boardData.homework).filter((key) =>
        this.state.boardData.homework[key].content?.trim(),
      )
      return this.state.availableSubjects
        .filter((subject) => !usedKeys.includes(subject.name))
        .sort((a, b) => a.order - b.order)
    },
    emptySubjects() {
      if (this.emptySubjectDisplay !== 'button') return []
      return this.unusedSubjects
    },
    autoSave() {
      return getSetting('edit.autoSave')
    },
    blockNonTodayAutoSave() {
      return getSetting('edit.blockNonTodayAutoSave')
    },
    isToday() {
      const today = (() => {
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        return `${yyyy}${mm}${dd}`
      })()
      return this.state.dateString === today
    },
    canAutoSave() {
      return this.autoSave && (!this.blockNonTodayAutoSave || this.isToday)
    },
    needConfirmSave() {
      return !this.isToday && this.confirmNonTodaySave
    },
    shouldShowBlockedMessage() {
      return !this.isToday && this.autoSave && this.blockNonTodayAutoSave
    },
    refreshBeforeEdit() {
      return getSetting('edit.refreshBeforeEdit')
    },
    emptySubjectDisplay() {
      return getSetting('display.emptySubjectDisplay')
    },
    dynamicSort() {
      return getSetting('display.dynamicSort')
    },
    isEditingDisabled() {
      // 检查是否禁用编辑：加载中、没有编辑权限、或被配置禁止编辑过往数据
      if (this.state.uploadLoading || this.state.downloadLoading) return true

      // 检查是否是只读 token
      const manager = this.$refs.studentNameManager
      if (manager?.isReadOnly) return true

      // 检查是否禁止编辑过往数据
      if (!this.canEditCurrentDate) return true

      return false
    },
    unreadCount() {
      return this.$refs.messageLog?.unreadCount || 0
    },
    showRandomPickerButton() {
      return getSetting('randomPicker.enabled')
    },
    showListCardButton() {
      return getSetting('display.showListCard')
    },
    confirmNonTodaySave() {
      return getSetting('edit.confirmNonTodaySave')
    },
    blockPastDataEdit() {
      return getSetting('edit.blockPastDataEdit')
    },
    shouldShowSaveConfirm() {
      return !this.isToday && this.confirmNonTodaySave
    },
    shouldBlockAutoSave() {
      return !this.isToday && this.autoSave && this.blockNonTodayAutoSave
    },
    canEditCurrentDate() {
      // 检查是否可以编辑当前日期的数据
      if (this.isToday) return true
      if (this.blockPastDataEdit) return false
      return true
    },
    isEditingPastData() {
      // 是否正在编辑过往数据（非今日数据）
      return !this.isToday
    },
    showFullscreenButton() {
      return getSetting('display.showFullscreenButton')
    },
    showExamScheduleButton() {
      return getSetting('display.showExamScheduleButton')
    },
    showAntiScreenBurnCard() {
      return getSetting('display.showAntiScreenBurnCard')
    },
    showTestCardButton() {
      return getSetting('developer.enabled')
    },
    showUafTransferButton() {
      return getSetting('display.showUafTransfer')
    },
    shouldShowInit() {
      const provider = getSetting('server.provider')
      const isKv = provider === 'kv-server' || provider === 'classworkscloud'
      const token = getSetting('server.kvToken')
      // 仅首页
      const onHome = this.$route?.path === '/'
      // 依赖 settingsTick 使其在设置变更时重新计算
      void this.settingsTick
      return onHome && isKv && (!token || token === '')
    },
    // 是否显示紧急通知测试按钮（仅教师和课堂令牌）
    hasExamCard() {
      for (const key in this.state.boardData.homework) {
        if (key.startsWith('exam-')) return true
      }
      return false
    },

    shouldShowUrgentTestButton() {
      // 检查是否使用 KV 服务器
      const provider = getSetting('server.provider')
      const isKv = provider === 'kv-server' || provider === 'classworkscloud'
      if (!isKv) return false

      // 检查是否有令牌
      const kvToken = getSetting('server.kvToken')
      if (!kvToken) return false

      // 检查令牌信息是否已加载
      if (!this.tokenInfo) return false

      // 只有 teacher 或 classroom 类型的令牌才显示
      return this.tokenInfo.deviceType === 'teacher' || this.tokenInfo.deviceType === 'classroom'
    },

    subjectOrder() {
      return [...this.state.availableSubjects]
        .sort((a, b) => a.order - b.order)
        .map((subject) => subject.name)
    },
  },

  watch: {
    homeworkData: {
      handler() {
        this.$nextTick(() => {
          if (this.$refs.waterfall) {
            this.$refs.waterfall.reflow()
          }
        })
      },
      deep: true,
    },
    '$vuetify.display.width': {
      handler() {
        this.throttledReflow()
      },
      deep: true,
    },
    'state.attendanceDialog': {
      handler(newValue) {
        this.handleAttendanceDialogClose(newValue)
      },
    },
  },

  created() {
    // 尽早解析预配 query，避免异步 InitServiceChooser 挂载时还读到空数据
    this.parsePreconfigData()
    this.debouncedUpload = debounce(this.uploadData, 2000)
    this.debouncedAttendanceSave = debounce(async () => {
      if (this.autoSave) {
        await this.trySave(true)
      }
    }, 2000)
    this.throttledReflow = throttle(() => {
      if (this.$refs.gridContainer) {
        this.optimizeGridLayout(this.sortedItems)
      }
    }, 200)
  },

  async mounted() {
    try {
      this.updateBackendUrl()
      await this.initializeData()
      this.dataReady = true
      // 拉取设备/命名空间信息用于标题显示
      await this.loadDeviceInfo()
      this.setupAutoRefresh()
      this.unwatchSettings = watchSettings(() => {
        this.updateSettings()
      })

      // 连接学生姓名管理组件（支持学生和教师）
      this.$nextTick(() => {
        const studentNameManager = this.$refs.studentNameManager
        if (studentNameManager) {
          // 优先使用学生名称，如果不是学生则使用教师名称
          this.studentNameInfo.name =
            studentNameManager.currentStudentName || studentNameManager.currentTeacherName || ''
          this.studentNameInfo.isStudent = studentNameManager.isStudentToken
          this.studentNameInfo.isTeacher = studentNameManager.isTeacherToken
          this.studentNameInfo.openDialog = () => studentNameManager.openDialog()

          // 监听学生姓名变化
          this.$watch(
            () => studentNameManager.currentStudentName,
            (newName) => {
              this.studentNameInfo.name = newName
              this.updateTokenDisplayInfo()
            },
          )
          // 监听教师姓名变化
          this.$watch(
            () => studentNameManager.currentTeacherName,
            (newName) => {
              if (studentNameManager.isTeacherToken) {
                this.studentNameInfo.name = newName
                this.updateTokenDisplayInfo()
              }
            },
          )
          this.$watch(
            () => studentNameManager.isStudentToken,
            (isStudent) => {
              this.studentNameInfo.isStudent = isStudent
              this.updateTokenDisplayInfo()
            },
          )
          this.$watch(
            () => studentNameManager.isTeacherToken,
            (isTeacher) => {
              this.studentNameInfo.isTeacher = isTeacher
              this.updateTokenDisplayInfo()
            },
          )
        }
      })

      document.addEventListener('fullscreenchange', this.fullscreenChangeHandler)
      document.addEventListener('webkitfullscreenchange', this.fullscreenChangeHandler)
      document.addEventListener('mozfullscreenchange', this.fullscreenChangeHandler)
      document.addEventListener('MSFullscreenChange', this.fullscreenChangeHandler)

      this.checkHashForRandomPicker()

      window.addEventListener('hashchange', this.checkHashForRandomPicker)

      // 实时频道：加入设备房间并监听键变化
      this.setupRealtimeChannel()

      // 初始化离线同步管理器
      syncManager.init()

      // 初始化 Token 显示信息
      this.$nextTick(() => {
        this.updateTokenDisplayInfo()
      })

      // 获取令牌信息
      await this.loadTokenInfo()

      // 加载常驻通知
      this.loadPersistentNotifications()
    } catch (err) {
      console.error('初始化失败:', err)
      this.showError('初始化失败，请刷新页面重试')
    }
  },

  beforeUnmount() {
    syncManager.destroy()
    if (this.unwatchSettings) {
      this.unwatchSettings()
    }
    if (this.state.refreshInterval) {
      clearInterval(this.state.refreshInterval)
    }

    document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler)
    document.removeEventListener('webkitfullscreenchange', this.fullscreenChangeHandler)
    document.removeEventListener('mozfullscreenchange', this.fullscreenChangeHandler)
    document.removeEventListener('MSFullscreenChange', this.fullscreenChangeHandler)

    window.removeEventListener('hashchange', this.checkHashForRandomPicker)

    // 退出设备房间并清理监听
    try {
      if (this.$offKvChanged && typeof this.$offKvChanged === 'function') {
        this.$offKvChanged()
        this.$offKvChanged = null
      }
      if (this.$offDeviceEvent && typeof this.$offDeviceEvent === 'function') {
        this.$offDeviceEvent()
        this.$offDeviceEvent = null
      }
      if (this.$offConnect && typeof this.$offConnect === 'function') {
        this.$offConnect()
        this.$offConnect = null
      }
      leaveAll()
    } catch (e) {
      console.warn('主页面事件清理失败:', e)
    }
  },

  methods: {
    // 加载设备/命名空间信息（仅云端模式）
    async loadDeviceInfo() {
      try {
        const provider = getSetting('server.provider')
        const useServer = provider === 'kv-server' || provider === 'classworkscloud'
        if (!useServer) return

        const res = await kvServerProvider.loadNamespaceInfo()
        if (res && res.success === false) return // 忽略错误

        this.state.namespaceInfo = res || null
        // 兜底填充设备名，避免重复解析
        this.state.deviceName = res?.account?.deviceName || ''
      } catch (e) {
        console.warn('加载设备信息失败:', e)
      }
    },

    // 获取令牌信息
    async loadTokenInfo() {
      try {
        const provider = getSetting('server.provider')
        const isKv = provider === 'kv-server' || provider === 'classworkscloud'
        if (!isKv) return

        const kvToken = getSetting('server.kvToken')
        if (!kvToken) return

        const serverUrl = getSetting('server.domain')
        if (!serverUrl) return

        // 获取 Token 信息
        const tokenResponse = await axios.get(`${serverUrl}/kv/_token`, {
          headers: {
            Authorization: `Bearer ${kvToken}`,
          },
        })

        this.tokenInfo = tokenResponse.data
        console.log('Token info loaded:', this.tokenInfo)
      } catch (error) {
        console.warn('Failed to load token info:', error)
        this.tokenInfo = null
      }
    },

    // 更新 Token 显示信息
    updateTokenDisplayInfo() {
      const manager = this.$refs.studentNameManager
      if (!manager || !manager.hasToken) {
        this.tokenDisplayInfo.show = false
        this.tokenDisplayInfo.readonly = false
        return
      }

      const displayName = manager.displayName
      const isReadOnly = manager.isReadOnly
      const isStudent = manager.isStudentToken
      const isTeacher = manager.isTeacherToken

      // 设置只读状态（对所有类型的 token 都显示）
      this.tokenDisplayInfo.readonly = isReadOnly

      // 学生和教师都显示名称 chip
      if (!isStudent && !isTeacher) {
        this.tokenDisplayInfo.show = false
        return
      }

      // 设置名称显示（始终蓝色）
      this.tokenDisplayInfo.text = displayName
      this.tokenDisplayInfo.color = 'primary'
      // 学生用人头图标，教师用学校图标
      this.tokenDisplayInfo.icon = isTeacher ? 'mdi-school' : 'mdi-account'
      this.tokenDisplayInfo.disabled = isReadOnly // 只读时不可点击
      this.tokenDisplayInfo.show = true
    },

    // 处理 Token Chip 点击（学生和教师都支持）
    handleTokenChipClick() {
      console.log('Token chip clicked')
      const manager = this.$refs.studentNameManager
      console.log('Manager:', manager)
      console.log('Is student token:', manager?.isStudentToken)
      console.log('Is teacher token:', manager?.isTeacherToken)

      if (manager && (manager.isStudentToken || manager.isTeacherToken)) {
        console.log('Opening dialog...')
        manager.openDialog()
      } else {
        console.log('Cannot open dialog - conditions not met')
      }
    },

    ensureDate(dateInput) {
      if (dateInput instanceof Date) {
        return dateInput
      }
      if (typeof dateInput === 'string') {
        const date = new Date(dateInput)
        if (!isNaN(date.getTime())) {
          return date
        }
      }
      return new Date()
    },

    formatDate(dateInput) {
      const date = this.ensureDate(dateInput)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    },

    formatTime(timestamp) {
      if (!timestamp) return ''
      return new Date(timestamp).toLocaleString()
    },

    getToday() {
      return new Date()
    },

    async initializeData() {
      const configApplied = await this.parseUrlConfig()

      const urlParams = new URLSearchParams(window.location.search)
      const dateFromUrl = urlParams.get('date')
      const today = this.getToday()

      let currentDate = today
      if (dateFromUrl) {
        if (/^\d{8}$/.test(dateFromUrl)) {
          const year = dateFromUrl.substring(0, 4)
          const month = dateFromUrl.substring(4, 6)
          const day = dateFromUrl.substring(6, 8)
          currentDate = new Date(`${year}-${month}-${day}`)
        } else {
          currentDate = new Date(dateFromUrl)
        }
        if (isNaN(currentDate.getTime())) {
          currentDate = today
        }
      }

      this.state.dateString = this.formatDate(currentDate)
      this.state.selectedDate = this.state.dateString
      this.state.selectedDateObj = currentDate
      this.state.isToday = this.formatDate(currentDate) === this.formatDate(today)
      if (!configApplied) {
        this.provider = getSetting('server.provider')
        const classNum = getSetting('server.classNumber')

        this.state.classNumber = classNum
      }
      await Promise.all([this.downloadData(), this.loadConfig()])

      // Load exam data
      await this.examStore.fetchExamList()
      // Preload details for list items to show names in dialog
      for (const exam of this.examStore.examList) {
        this.examStore.fetchExam(exam.id)
      }

      this.checkUpcomingExams()
      // this.loadExamCards(); // Removed
    },

    async checkUpcomingExams() {
      this.upcomingExams = await this.examStore.getUpcomingExams()
    },

    loadExamCards() {
      // No longer needed as exam cards are part of boardData
    },

    saveExamCards() {
      // No longer needed
    },

    addExamCard(examId, forceAdd = false, skipSave = false) {
      const key = `exam-${examId}`
      if (!forceAdd && this.state.boardData.homework[key]) {
        delete this.state.boardData.homework[key]
      } else {
        this.state.boardData.homework[key] = {
          type: 'exam',
          examId: examId,
          name: '考试安排',
          content: '', // Placeholder
        }
      }
      this.state.synced = false
      if (!skipSave) {
        this.trySave(true)
      }
    },

    openExamDetail(examId) {
      this.selectedExamId = examId
      this.showExamDetailDialog = true
    },

    removeCurrentExamCard() {
      if (this.selectedExamId) {
        this.addExamCard(this.selectedExamId) // Toggle off
        this.showExamDetailDialog = false
      }
    },

    async onExamConfigSaved() {
      if (this.selectedExamId) {
        // Force refresh the exam data in store
        // We need to clear the cache first or force fetch
        // The store implementation checks loadingDetails[id] but not if it's already loaded?
        // Actually fetchExam checks if (this.exams[id]) return this.exams[id]
        // So we need to manually clear it or add a force parameter to fetchExam

        // Simple hack: clear the entry in store
        delete this.examStore.exams[this.selectedExamId]
        await this.examStore.fetchExam(this.selectedExamId)
        this.$message.success('保存成功', '考试配置已更新')
      }
    },

    onExamConfigDeleted() {
      this.removeCurrentExamCard()
      this.$message.success('删除成功', '考试配置已删除')
    },

    isExamCardAdded(examId) {
      return !!this.state.boardData.homework[`exam-${examId}`]
    },

    removeExamCard(index) {
      // Deprecated
    },

    addAllUpcomingExams() {
      let addedCount = 0
      for (const exam of this.upcomingExams) {
        if (!this.isExamCardAdded(exam.id)) {
          this.addExamCard(exam.id, true, true) // skipSave = true
          addedCount++
        }
      }
      if (addedCount > 0) {
        this.trySave(true) // 统一保存一次
        this.$message.success('添加成功', `已添加 ${addedCount} 个考试安排`)
      } else {
        this.$message.info('提示', '所有考试已添加')
      }
    },

    async downloadData(forceClear = false) {
      if (this.loading.download) return

      try {
        this.loading.download = true
        const response = await dataProvider.loadData('classworks-data-' + this.state.dateString)

        if (response.success == false) {
          if (response.error.code === 'NOT_FOUND') {
            this.state.showNoDataMessage = true
            this.state.noDataMessage = response.error.message
            // 如果强制清空或当前没有数据时才设置为空
            if (
              forceClear ||
              !this.state.boardData ||
              (!this.state.boardData.homework && !this.state.boardData.attendance)
            ) {
              this.state.boardData = {
                homework: {},
                attendance: { absent: [], late: [], exclude: [] },
              }
            }
          } else {
            throw new Error(response.error.message)
          }
        } else {
          this.state.boardData = {
            homework: response.homework || {},
            attendance: {
              absent: response.attendance?.absent || [],
              late: response.attendance?.late || [],
              exclude: response.attendance?.exclude || [],
            },
          }
          this.state.synced = true
          this.state.showNoDataMessage = false
          if (response.fromCache) {
            this.$message.warning('离线模式', '显示缓存数据，联网后将自动同步')
          } else {
            this.$message.success('下载成功', '数据已更新')
          }
        }
      } catch (error) {
        // 数据加载失败时的处理
        console.error('数据加载失败:', error)
        this.$message.error('下载失败', error.message)
        // 如果强制清空或当前没有任何数据，才初始化为空数据
        if (
          forceClear ||
          !this.state.boardData ||
          (!this.state.boardData.homework && !this.state.boardData.attendance)
        ) {
          this.state.boardData = {
            homework: {},
            attendance: { absent: [], late: [], exclude: [] },
          }
        }
      } finally {
        this.loading.download = false
      }
    },

    async trySave(isAutoSave = false) {
      if (isAutoSave && !this.canAutoSave) {
        if (this.shouldShowBlockedMessage) {
          this.showMessage('需要手动保存', '已禁止自动保存非当天数据', 'warning')
        }
        return false
      }

      if (!isAutoSave && this.needConfirmSave) {
        try {
          await this.showConfirmDialog()
        } catch {
          return false
        }
      }

      try {
        await this.uploadData()
        return true
      } catch (error) {
        this.$message.error('保存失败', error.message || '请重试')
        return false
      }
    },

    async handleClose() {
      if (!this.currentEditSubject) return

      const content = this.state.textarea.trim()
      const originalContent = this.state.boardData.homework[this.currentEditSubject]?.content || ''

      if (content !== originalContent.trim()) {
        // 如果内容为空且是自定义卡片，则删除该卡片
        if (!content && this.currentEditSubject.startsWith('custom-')) {
          delete this.state.boardData.homework[this.currentEditSubject]
          this.state.synced = false
          if (this.autoSave) {
            await this.trySave(true)
          }
          this.state.dialogVisible = false
          return
        }
        // 如果是自定义卡片，保留其他属性
        if (this.state.boardData.homework[this.currentEditSubject].type === 'custom') {
          this.state.boardData.homework[this.currentEditSubject].content = content
        } else {
          this.state.boardData.homework[this.currentEditSubject] = {
            ...this.state.boardData.homework[this.currentEditSubject],
            content: content,
          }
        }

        this.state.synced = false

        if (this.autoSave) {
          await this.trySave(true)
        }
      }

      this.state.dialogVisible = false
    },

    async uploadData() {
      if (this.loading.upload) return

      try {
        this.loading.upload = true
        const response = await dataProvider.saveData(
          'classworks-data-' + this.state.dateString,
          this.state.boardData,
        )
        if (response.success == false) {
          throw new Error(response.error.message)
        }

        this.state.synced = true
        if (response.queuedForSync) {
          this.$message.warning('已保存到本地', '网络恢复后将自动同步到服务器')
        } else {
          this.$message.success(response.message || '保存成功')
        }
      } finally {
        this.loading.upload = false
      }
    },

    async loadConfig() {
      try {
        // 加载学生列表
        try {
          const response = await dataProvider.loadData('classworks-list-main')

          if (response.success != false && Array.isArray(response)) {
            this.state.studentList = response.map((student) => student.name)
          }
        } catch (error) {
          console.warn(
            'Failed to load student list from dedicated key, falling back to config',
            error,
          )
        }

        await this.loadSubjects()
      } catch (error) {
        console.error('加载配置失败:', error)
        this.$message.error('加载配置失败', error.message)
      }
    },

    async loadSubjects() {
      try {
        const subjectsResponse = await dataProvider.loadData('classworks-config-subject')
        if (subjectsResponse && Array.isArray(subjectsResponse)) {
          // 更新科目列表
          this.state.availableSubjects = subjectsResponse
        }
      } catch (error) {
        console.warn('Failed to load subject configuration:', error)
        // 保持默认科目列表
      }
    },

    showSyncMessage() {
      this.$message.success('数据已同步', '数据已完成与服务器同步')
    },

    async openDialog(subject) {
      // 检查编辑权限
      if (this.isEditingDisabled) {
        const manager = this.$refs.studentNameManager
        if (manager?.isReadOnly) {
          this.$message.warning('无法编辑', '当前使用的是只读令牌')
        } else if (!this.canEditCurrentDate) {
          this.$message.warning('无法编辑', '已禁止编辑过往数据')
        } else {
          this.$message.warning('无法编辑', '数据加载中，请稍候')
        }
        return
      }

      // 如果是自定义卡片
      if (subject.startsWith('custom-')) {
        this.currentEditSubject = subject
        this.state.dialogTitle = this.state.boardData.homework[subject].name
        this.state.textarea = this.state.boardData.homework[subject].content
        this.state.dialogVisible = true
        return
      }

      if (this.refreshBeforeEdit) {
        try {
          await this.downloadData()
        } catch (err) {
          console.error('刷新数据失败:', err)
          this.$message.error('刷新数据失败，可能显示的不是最新数据')
        }
      }

      this.currentEditSubject = subject
      if (!this.state.boardData.homework[subject]) {
        this.state.boardData.homework[subject] = {
          content: '',
        }
      }
      this.state.dialogTitle =
        this.state.availableSubjects.find((s) => s.name === subject)?.name || subject
      this.state.textarea = this.state.boardData.homework[subject].content
      this.state.dialogVisible = true
    },

    async handleHomeworkSave(content) {
      if (!this.currentEditSubject) return

      // 如果是自定义卡片，保留其他属性
      if (this.state.boardData.homework[this.currentEditSubject].type === 'custom') {
        this.state.boardData.homework[this.currentEditSubject].content = content
      } else {
        this.state.boardData.homework[this.currentEditSubject] = {
          ...this.state.boardData.homework[this.currentEditSubject],
          content: content,
        }
      }

      this.state.synced = false

      if (this.autoSave) {
        await this.trySave(true)
      }
    },

    setAttendanceArea() {
      // 检查编辑权限
      if (this.isEditingDisabled) {
        this.handleDisabledClick()
        return
      }
      this.state.attendanceDialog = true
    },

    handleDisabledClick() {
      // 处理点击禁用卡片/区域的情况
      const manager = this.$refs.studentNameManager
      if (manager?.isReadOnly) {
        this.$message.warning('无法编辑', '当前使用的是只读令牌')
      } else if (!this.canEditCurrentDate) {
        this.$message.warning('无法编辑', '已禁止编辑过往数据')
      } else {
        this.$message.warning('无法编辑', '数据加载中，请稍候')
      }
    },

    zoom(direction) {
      const step = 2
      if (direction === 'up' && this.state.fontSize < 100) {
        this.state.fontSize += step
      } else if (direction === 'out' && this.state.fontSize > 16) {
        this.state.fontSize -= step
      }
      this.state.contentStyle = {
        'font-size': `${this.state.fontSize}px`,
      }
      setSetting('font.size', this.state.fontSize)
    },

    updateBackendUrl() {
      const provider = getSetting('server.provider')
      const classNum = getSetting('server.classNumber')

      this.provider = provider

      this.state.classNumber = classNum
    },

    setupAutoRefresh() {
      const autoRefresh = getSetting('refresh.auto')
      const interval = getSetting('refresh.interval')
      if (this.state.refreshInterval) {
        clearInterval(this.state.refreshInterval)
      }
      if (autoRefresh) {
        this.state.refreshInterval = setInterval(() => {
          if (!this.shouldSkipRefresh()) {
            this.downloadData()
            this.loadPersistentNotifications()
          }
        }, interval * 1000)
      }
    },

    shouldSkipRefresh() {
      if (this.state.dialogVisible) return true

      if (this.state.attendanceDialog) return true

      if (this.confirmDialog.show) return true

      if (this.state.datePickerDialog) return true

      if (this.loading.upload || this.loading.download) return true

      if (!this.state.synced) return true

      return false
    },

    updateSettings() {
      this.state.fontSize = getSetting('font.size')
      this.state.contentStyle = { 'font-size': `${this.state.fontSize}px` }
      this.setupAutoRefresh()
      this.updateBackendUrl()
      // 设置更新时尝试刷新设备名称（例如 Token 或域名变更）
      this.loadDeviceInfo()
      // 重新加载令牌信息（Token 可能已变更）
      this.loadTokenInfo()
      // 触发依赖刷新（例如 shouldShowInit）
      this.settingsTick++
    },

    async handleDateSelect(newDate) {
      if (!newDate) return

      try {
        const selectedDate = this.ensureDate(newDate)
        const dateStr = this.formatDate(selectedDate)

        if (dateStr === this.state.dateString) return

        this.state.dateString = dateStr
        this.state.selectedDate = dateStr
        this.state.selectedDateObj = selectedDate
        this.state.isToday = dateStr === this.formatDate(this.getToday())

        // Load both data and subjects in parallel, force clear data when switching dates
        await Promise.all([this.downloadData(true), this.loadSubjects()])
      } catch (error) {
        console.error('Date processing error:', error)
        this.$message.error('日期处理错误', '请重新选择日期')
      }
    },

    // 实时频道：加入设备房间并监听键变化
    setupRealtimeChannel() {
      try {
        const token = getSetting('server.kvToken')
        if (!token) {
          console.warn('未配置 KV Token，无法加入实时频道')
          return
        }

        // Ensure socket created
        getSocket()
        joinToken(token)

        // Re-join on reconnect
        this.$offConnect = onSocketConnect(() => joinToken(token))

        // Debounce refresh to avoid storms
        if (!this.debouncedRealtimeRefresh) {
          this.debouncedRealtimeRefresh = debounce(async () => {
            const oldHomework = JSON.parse(JSON.stringify(this.state.boardData.homework))
            await this.downloadData()
            const now = new Date()
            const hh = String(now.getHours()).padStart(2, '0')
            const mm = String(now.getMinutes()).padStart(2, '0')
            const ss = String(now.getSeconds()).padStart(2, '0')

            // 使用消息记录工具发送通知
            this.$message?.info('数据已更新', `已于 ${hh}:${mm}:${ss} 自动刷新`) // 检测哪些科目发生了变化
            const changed = {}
            for (const key in this.state.boardData.homework) {
              const oldContent = oldHomework[key]?.content || ''
              const newContent = this.state.boardData.homework[key]?.content || ''
              if (oldContent !== newContent) {
                changed[key] = true
              }
            }
            // 删除的科目也算变化
            for (const key in oldHomework) {
              if (!this.state.boardData.homework[key]) {
                changed[key] = true
              }
            }

            // 设置高亮
            this.highlightedCards = changed
            // 3秒后移除高亮
            setTimeout(() => {
              this.highlightedCards = {}
            }, 10000)
          }, 800)
        }

        const handler = (msg) => {
          // Expect msg = { uuid, key, action, created?, updatedAt?, deletedAt?, batch? }
          if (!msg) return

          // 检查是否是通知列表更新
          if (msg.key === 'notification-list') {
            this.loadPersistentNotifications()
            return
          }

          // We only care about current date key changes
          const expectedKey = `classworks-data-${this.state.dateString}`
          if (msg.key !== expectedKey) return
          if (msg.action !== 'upsert' && msg.action !== 'delete') return
          // Trigger a debounced refresh
          this.debouncedRealtimeRefresh?.(msg.key)
        }

        // 监听 KV 变化事件（支持新旧格式）
        const kvHandler = (eventData) => {
          let msg = eventData

          // 新格式：直接事件数据
          if (eventData.content && eventData.timestamp) {
            msg = {
              uuid: eventData.senderId || 'realtime',
              key: eventData.content.key,
              action: eventData.content.action,
              created: eventData.content.created,
              updatedAt: eventData.content.updatedAt || eventData.timestamp,
              deletedAt: eventData.content.deletedAt,
              batch: eventData.content.batch,
            }
          }

          handler(msg)
        }

        this.$offKvChanged = socketOn('kv-key-changed', kvHandler)

        // 保留设备事件监听（为未来扩展）
        this.deviceEventHandler = createDeviceEventHandler({
          onKvChanged: handler,
          enableLegacySupport: true,
        })
        this.$offDeviceEvent = socketOn('device-event', this.deviceEventHandler)
      } catch (e) {
        console.warn('实时频道初始化失败', e)
      }
    },

    async saveAttendance() {
      try {
        await this.trySave(true)
        this.state.attendanceDialog = false
      } catch (error) {
        console.error('保存出勤状态失败:', error)
        this.$message.error('保存失败', '请重试')
      }
    },

    showMessage(title, content = '', type = 'success') {
      this.$message[type](title, content)
    },

    updateSortedItemsCache(key, value) {
      this._sortedItemsCache = {
        key,
        value,
      }
    },

    addTestCard() {
      const id = Date.now().toString()
      this.state.boardData.homework[`custom-${id}`] = {
        name: '测试卡片',
        content: '这是一个测试卡片\n可以用来测试布局',
        type: 'custom',
      }
      this.state.synced = false
    },

    openUafTransfer(mode) {
      this.uafTransfer.mode = mode
      this.uafTransfer.show = true
    },

    handleUafSuccess(title, content) {
      this.$message.success(title, content)
    },

    handleUafError(title, content) {
      this.$message.error(title, content)
    },

    async handleUafImported(result) {
      if (result.savedDates.includes(this.state.dateString)) {
        await this.downloadData(true)
      }
    },

    showConfirmDialog() {
      return new Promise((resolve, reject) => {
        this.confirmDialog = {
          show: true,
          resolve: () => {
            this.confirmDialog.show = false
            resolve()
          },
          reject: () => {
            this.confirmDialog.show = false
            reject(new Error('用户取消保存'))
          },
        }
      })
    },

    confirmSave() {
      this.confirmDialog.show = false
      if (this.confirmDialog.resolve) {
        this.confirmDialog.resolve(true)
      }
    },

    cancelSave() {
      this.confirmDialog.show = false
      if (this.confirmDialog.reject) {
        this.confirmDialog.reject(new Error('用户取消保存'))
      }
    },

    async manualUpload() {
      return this.trySave(false)
    },

    handleAttendanceChange() {
      this.state.synced = false
      this.debouncedAttendanceSave()
    },

    async handleAttendanceDialogClose(newValue) {
      if (!newValue && !this.state.synced) {
        await this.trySave(true)
      }
    },

    toggleFullscreen() {
      if (!this.state.isFullscreen) {
        this.enterFullscreen()
      } else {
        this.exitFullscreen()
      }
    },

    enterFullscreen() {
      const docElm = document.documentElement

      if (docElm.requestFullscreen) {
        docElm.requestFullscreen()
      } else if (docElm.webkitRequestFullScreen) {
        docElm.webkitRequestFullScreen()
      } else if (docElm.mozRequestFullScreen) {
        docElm.mozRequestFullScreen()
      } else if (docElm.msRequestFullscreen) {
        docElm.msRequestFullscreen()
      }
    },

    exitFullscreen() {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      }
    },

    fullscreenChangeHandler() {
      this.state.isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )
    },

    openRandomPicker() {
      if (this.$refs.randomPicker) {
        this.$refs.randomPicker.open()
      }
    },

    checkHashForRandomPicker() {
      if (window.location.hash === '#random-picker') {
        this.$nextTick(() => {
          console.log('打开随机点名')
          window.location.hash = ''
          this.openRandomPicker()
        })
      }
    },

    parseUrlConfig() {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const configParam = urlParams.get('config')

        if (!configParam) return false

        try {
          const binaryString = atob(configParam)
          const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0))
          const decodedString = new TextDecoder().decode(bytes)
          const decodedConfig = JSON.parse(decodedString)
          console.log('从URL读取配置:', decodedConfig)

          const changes = []
          const validSettings = {}
          const icons = {}

          this.processSpecialSettings(decodedConfig, changes, validSettings)

          this.processStandardSettings(decodedConfig, changes, validSettings, icons)

          if (Object.keys(validSettings).length === 0) {
            console.log('URL配置与当前配置相同，无需应用')
            return false
          }

          return new Promise((resolve) => {
            this.urlConfigDialog = {
              show: true,
              config: decodedConfig,
              changes: changes,
              validSettings: validSettings,
              icons: icons,
              confirmHandler: () => {
                this.urlConfigDialog.show = false
                this.applyUrlConfig(validSettings)
                resolve(true)
              },
              cancelHandler: () => {
                this.urlConfigDialog.show = false
                resolve(false)
              },
            }
          })
        } catch (e) {
          console.error('解析URL配置错误:', e)
          this.$message.error('URL配置错误', '无法解析配置数据')
          return false
        }
      } catch (e) {
        console.error('处理URL配置错误:', e)
        return false
      }
    },

    processSpecialSettings(decodedConfig, changes, validSettings) {
      if (decodedConfig.classNumber !== undefined) {
        const current = getSetting('server.classNumber')
        if (decodedConfig.classNumber !== current) {
          changes.push({
            key: 'server.classNumber',
            name: '班级',
            oldValue: current,
            newValue: decodedConfig.classNumber,
            description: settingsDefinitions['server.classNumber']?.description || '班级编号',
            icon: settingsDefinitions['server.classNumber']?.icon || 'mdi-account-group',
          })
          validSettings['server.classNumber'] = decodedConfig.classNumber
        }
      }

      if (decodedConfig.date !== undefined) {
        if (decodedConfig.date !== this.state.dateString) {
          changes.push({
            key: 'date',
            name: '日期',
            oldValue: this.state.dateString,
            newValue: decodedConfig.date,
            description: '查看的日期',
            icon: 'mdi-calendar',
          })
          validSettings.date = decodedConfig.date
        }
      }

      if (decodedConfig.subjects && Array.isArray(decodedConfig.subjects)) {
        changes.push({
          key: 'subjects',
          name: '科目列表',
          oldValue: `${this.state.availableSubjects.length}个科目`,
          newValue: `${decodedConfig.subjects.length}个科目`,
          description: '可用科目列表',
          icon: 'mdi-notebook',
        })
        validSettings.subjects = decodedConfig.subjects
      }
    },

    processStandardSettings(decodedConfig, changes, validSettings, icons) {
      Object.entries(decodedConfig).forEach(([key, value]) => {
        if (['classNumber', 'date', 'subjects'].includes(key)) {
          return
        }

        let settingKey = key
        let definition = settingsDefinitions[key]

        if (!definition && !key.includes('.')) {
          const prefixes = [
            'server.',
            'display.',
            'theme.',
            'edit.',
            'refresh.',
            'font.',
            'randomPicker.',
          ]
          for (const prefix of prefixes) {
            const prefixedKey = `${prefix}${key}`
            if (settingsDefinitions[prefixedKey]) {
              settingKey = prefixedKey
              definition = settingsDefinitions[prefixedKey]
              break
            }
          }
        }

        if (definition) {
          let typedValue = this.convertValueToCorrectType(value, definition.type)

          if (definition.validate && !definition.validate(typedValue)) {
            console.warn(`URL配置项 ${settingKey} 的值无效: ${value}`)
            return
          }

          const currentValue = getSetting(settingKey)
          if (typedValue !== currentValue) {
            changes.push({
              key: settingKey,
              name: this.getSettingDisplayName(settingKey),
              oldValue: this.formatSettingValue(currentValue),
              newValue: this.formatSettingValue(typedValue),
              description: definition.description || settingKey,
              icon: definition.icon || 'mdi-cog',
            })
            validSettings[settingKey] = typedValue
            icons[settingKey] = definition.icon || 'mdi-cog'
          }
        } else {
          changes.push({
            key: key,
            name: this.getSettingDisplayName(key),
            oldValue: '未知',
            newValue: this.formatSettingValue(value),
            description: '自定义配置项',
            icon: 'mdi-cog-outline',
          })
          validSettings[key] = value
          icons[key] = 'mdi-cog-outline'
        }
      })
    },

    convertValueToCorrectType(value, type) {
      if (type === 'boolean') {
        return Boolean(value)
      } else if (type === 'number') {
        return Number(value)
      } else {
        return String(value)
      }
    },

    formatSettingValue(value) {
      if (typeof value === 'boolean') {
        return value ? '开启' : '关闭'
      } else if (value === '' || value === null || value === undefined) {
        return '空'
      }
      return value.toString()
    },

    getSettingDisplayName(key) {
      const parts = key.split('.')
      const lastPart = parts[parts.length - 1]

      const nameMap = {
        provider: '数据提供方',
        domain: '服务器域名',
        classNumber: '班级编号',

        emptySubjectDisplay: '空科目显示方式',
        dynamicSort: '动态排序',
        showRandomButton: '随机按钮',
        showFullscreenButton: '全屏按钮',
        cardHoverEffect: '卡片悬浮效果',
        enhancedTouchMode: '增强触摸模式',
        showAntiScreenBurnCard: '防烧屏卡片',
        showUafTransfer: 'UAF导入导出',

        mode: '主题模式',

        size: '字体大小',

        autoSave: '自动保存',
        blockNonTodayAutoSave: '禁止自动保存非当日',
        refreshBeforeEdit: '编辑前刷新',
        confirmNonTodaySave: '非当日保存确认',

        auto: '自动刷新',
        interval: '刷新间隔',
      }

      return nameMap[lastPart] || lastPart
    },

    safeBase64Decode(base64String) {
      try {
        return Base64.decode(base64String)
      } catch (e) {
        console.error('Base64解码错误:', e)
        throw new Error('无法解码配置数据')
      }
    },

    applyUrlConfig(validSettings) {
      for (const [key, value] of Object.entries(validSettings)) {
        if (key === 'date') {
          this.handleDateSelect(value)
          continue
        }

        if (key === 'subjects') {
          this.state.availableSubjects = value
          continue
        }

        setSetting(key, value)

        if (key === 'server.classNumber') {
          this.state.classNumber = value
        }
      }

      this.updateBackendUrl()
      this.$message.success('URL配置已应用', '已从URL加载配置')
      return true
    },

    navigateDay(offset) {
      const currentDate = new Date(this.state.selectedDateObj)
      currentDate.setDate(currentDate.getDate() + offset)
      this.handleDateSelect(currentDate)
    },

    async copyHomeworkToToday() {
      if (this.loading.copyToToday) return

      try {
        this.loading.copyToToday = true

        // 1. 保存当前选中日期的作业数据
        const sourceDate = this.state.dateString
        const sourceHomework = JSON.parse(JSON.stringify(this.state.boardData.homework))

        // 2. 切换到今天并加载今天的数据（主要是为了获取考勤等其他数据）
        const today = this.getToday()
        const todayString = this.formatDate(today)

        // 临时切换到今天以加载数据
        this.state.dateString = todayString
        await this.downloadData()

        // 3. 直接替换今天的作业数据（删除原有作业，使用源日期的作业）
        // 深拷贝源日期的作业数据
        const newHomework = {}
        for (const key in sourceHomework) {
          if (sourceHomework[key] && sourceHomework[key].content) {
            // 如果是自定义卡片，保留完整结构
            if (sourceHomework[key].type === 'custom') {
              newHomework[key] = JSON.parse(JSON.stringify(sourceHomework[key]))
            } else {
              // 普通作业，只复制内容
              newHomework[key] = {
                content: sourceHomework[key].content,
                tags: Array.isArray(sourceHomework[key].tags) ? [...sourceHomework[key].tags] : [],
              }
            }
          }
        }

        // 直接替换作业数据
        this.state.boardData.homework = newHomework
        this.state.synced = false

        // 4. 保存到今天
        await this.uploadData()

        // 5. 更新视图状态为今天
        this.state.selectedDate = todayString
        this.state.selectedDateObj = today
        this.state.isToday = true

        // 6. 更新URL
        const url = new URL(window.location)
        url.searchParams.delete('date')
        window.history.pushState({}, '', url)

        this.$message.success(
          '复制成功',
          `已将 ${sourceDate} 的作业内容复制到今天（已替换原有作业）`,
        )
      } catch (error) {
        console.error('复制作业失败:', error)
        this.$message.error('复制失败', error.message || '请重试')
      } finally {
        this.loading.copyToToday = false
      }
    },

    // 解析预配数据
    parsePreconfigData() {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const routeQuery = this.$route?.query || {}
        const pickParam = (key) => urlParams.get(key) || routeQuery[key] || null
        const namespace = pickParam('namespace')
        const authCode = pickParam('authCode') || pickParam('auth_code')
        const autoExecute = pickParam('autoExecute') || pickParam('auto_execute')

        if (namespace) {
          this.preconfigData.namespace = namespace
          this.preconfigData.authCode = authCode
          this.preconfigData.autoOpen = true
          // 解析自动执行参数，支持 true/false、1/0、yes/no
          this.preconfigData.autoExecute = this.parseBoolean(autoExecute)

          console.log('检测到预配数据:', {
            namespace: this.preconfigData.namespace,
            hasAuthCode: !!this.preconfigData.authCode,
            autoExecute: this.preconfigData.autoExecute,
          })

          // 清理URL参数，避免重复处理
          this.cleanupUrlParams([
            'namespace',
            'authCode',
            'auth_code',
            'autoExecute',
            'auto_execute',
          ])
        }
      } catch (error) {
        console.error('解析预配数据失败:', error)
      }
    },

    // 解析布尔值参数
    parseBoolean(value) {
      if (!value) return false
      const lowerValue = value.toLowerCase()
      return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes'
    },

    // 清理URL参数
    cleanupUrlParams(params) {
      try {
        const url = new URL(window.location)
        let hasChanged = false

        params.forEach((param) => {
          if (url.searchParams.has(param)) {
            url.searchParams.delete(param)
            hasChanged = true
          }
        })

        if (hasChanged) {
          // 使用 replaceState 避免创建新的历史记录
          window.history.replaceState({}, document.title, url.toString())
        }
      } catch (error) {
        console.error('清理URL参数失败:', error)
      }
    },

    async loadPersistentNotifications() {
      try {
        const res = await dataProvider.loadData('notification-list')
        if (res && Array.isArray(res)) {
          this.persistentNotifications = res
        } else if (res && res.success !== false && Array.isArray(res.data)) {
          this.persistentNotifications = res.data
        } else {
          this.persistentNotifications = []
        }
      } catch (e) {
        console.error('加载常驻通知失败', e)
      }
    },
    showNotificationDetail(notification) {
      this.currentNotification = notification
      this.notificationDetailDialog = true
    },
    async removePersistentNotification(id) {
      this.persistentNotifications = this.persistentNotifications.filter((n) => n.id !== id)
      // 当通知列表为空时，保存空对象 {} 而不是空数组 []，因为后端不接受空数组
      const dataToSave = this.persistentNotifications.length > 0 ? this.persistentNotifications : {}
      await dataProvider.saveData('notification-list', dataToSave)
      this.notificationDetailDialog = false
    },
  },
}
</script>
