<template>
  <div ref="gridContainer" class="grid-masonry">
    <TransitionGroup name="grid">
      <div
        v-for="item in sortedItems"
        :key="item.key"
        ref="items"
        :data-key="item.key"
        :style="{
          order: item.order,
        }"
        class="grid-item"
      >
        <!-- 时间卡片 -->
        <div v-if="item.type === 'time'" style="height: 100%">
          <time-card />
        </div>

        <!-- 一言卡片 -->
        <div v-else-if="item.type === 'hitokoto'" style="height: 100%">
          <hitokoto-card />
        </div>

        <!-- 考试卡片 -->
        <div v-else-if="item.type === 'exam'" style="height: 100%">
          <concise-exam-card
            :exam-id="item.data.examId"
            :content-style="contentStyle"
            @click="$emit('open-exam-detail', item.data.examId)"
          />
        </div>

        <!-- 出勤卡片 -->
        <v-card
          v-else-if="item.type === 'attendance'"
          :class="{
            'glow-highlight': highlightedCards[item.key],
            'cursor-not-allowed': isEditingDisabled,
            'cursor-pointer': !isEditingDisabled,
          }"
          border
          class="glow-track"
          height="100%"
          @click="handleCardClick('attendance', null)"
          @mousemove="handleMouseMove"
          @touchmove="handleTouchMove"
        >
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary" icon="mdi-account-group" />
            出勤统计
          </v-card-title>
          <v-card-text>
            <div class="d-flex justify-space-between align-center mb-2">
              <span>应到/实到</span>
              <span class="text-h6">
                {{ item.data.total - item.data.exclude.length }}/{{
                  item.data.total -
                  item.data.absent.length -
                  !getSetting('display.lateStudentsArePresent') * item.data.late.length -
                  item.data.exclude.length
                }}
              </span>
            </div>
            <v-divider class="mb-2" />

            <div v-if="item.data.absent.length > 0" class="mb-2">
              <div class="text-error text-caption mb-1">请假 ({{ item.data.absent.length }})</div>
              <div class="d-flex flex-wrap" style="gap: 4px">
                <v-chip
                  v-for="name in item.data.absent"
                  :key="name"
                  color="error"
                  size="x-small"
                  variant="flat"
                >
                  {{ name }}
                </v-chip>
              </div>
            </div>

            <div v-if="item.data.late.length > 0" class="mb-2">
              <div class="text-warning text-caption mb-1">迟到 ({{ item.data.late.length }})</div>
              <div class="d-flex flex-wrap" style="gap: 4px">
                <v-chip
                  v-for="name in item.data.late"
                  :key="name"
                  color="warning"
                  size="x-small"
                  variant="flat"
                >
                  {{ name }}
                </v-chip>
              </div>
            </div>

            <div v-if="item.data.exclude.length > 0" class="mb-2">
              <div class="text-grey text-caption mb-1">不参与 ({{ item.data.exclude.length }})</div>
              <div class="d-flex flex-wrap" style="gap: 4px">
                <v-chip
                  v-for="name in item.data.exclude"
                  :key="name"
                  color="grey"
                  size="x-small"
                  variant="flat"
                >
                  {{ name }}
                </v-chip>
              </div>
            </div>

            <div
              v-if="
                item.data.absent.length === 0 &&
                item.data.late.length === 0 &&
                item.data.exclude.length === 0
              "
              class="text-success text-center mt-2"
            >
              全勤
            </div>
          </v-card-text>
        </v-card>

        <!-- 自定义/测试卡片 -->
        <v-card
          v-else-if="item.type === 'custom'"
          :class="{
            'glow-highlight': highlightedCards[item.key],
            'cursor-not-allowed': isEditingDisabled,
            'cursor-pointer': !isEditingDisabled,
          }"
          border
          class="glow-track"
          height="100%"
          @click="handleCardClick('dialog', item.key)"
          @mousemove="handleMouseMove"
          @touchmove="handleTouchMove"
        >
          <v-card-title class="text-primary">
            <v-icon class="mr-2" icon="mdi-card-text-outline" size="small" />
            {{ item.name }}
          </v-card-title>
          <v-card-text :style="contentStyle">
            {{ item.content }}
          </v-card-text>
        </v-card>

        <!-- 普通作业卡片 -->
        <v-card
          v-else
          :class="{
            'glow-highlight': highlightedCards[item.key],
            'cursor-not-allowed': isEditingDisabled,
            'cursor-pointer': !isEditingDisabled,
          }"
          border
          class="glow-track"
          height="100%"
          rounded="xl"
          @click="handleCardClick('dialog', item.key)"
          @mousemove="handleMouseMove"
          @touchmove="handleTouchMove"
        >
          <v-card-title>{{ item.name }}</v-card-title>
          <v-card-text :style="contentStyle">
            <v-list>
              <v-list-item v-for="text in splitPoint(item.content)" :key="text">
                {{ text }}
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </div>
    </TransitionGroup>
  </div>

  <!-- 单独显示空科目 -->
  <div class="empty-subjects mt-4">
    <!-- 移动端优化视图 -->
    <div v-if="isMobile" class="d-flex flex-wrap justify-center">
      <v-chip
        v-for="subject in unusedSubjects"
        :key="subject.name"
        class="ma-1"
        color="primary"
        variant="tonal"
        @click="handleCardClick('dialog', subject.name)"
      >
        <v-icon start size="small">
          {{ isReadOnlyToken ? 'mdi-cancel' : 'mdi-plus' }}
        </v-icon>
        {{ subject.name }}
      </v-chip>
    </div>

    <template v-else-if="emptySubjectDisplay === 'button'">
      <v-btn-group divided variant="tonal">
        <v-btn
          v-for="subject in unusedSubjects"
          :key="subject.name"
          @click="handleCardClick('dialog', subject.name)"
        >
          <v-icon start>
            {{ isReadOnlyToken ? 'mdi-cancel' : 'mdi-plus' }}
          </v-icon>
          {{ subject.name }}
        </v-btn>
      </v-btn-group>
    </template>
    <div v-else class="empty-subjects-grid">
      <TransitionGroup name="v-list">
        <v-card
          v-for="subject in unusedSubjects"
          :key="subject.name"
          border
          rounded="xl"
          class="empty-subject-card"
          @click="handleCardClick('dialog', subject.name)"
        >
          <v-card-title class="text-subtitle-1">
            {{ subject.name }}
          </v-card-title>
          <v-card-text class="text-center">
            <template v-if="isReadOnlyToken">
              <v-icon color="grey" size="small"> mdi-cancel </v-icon>
              <div class="text-caption text-grey">当日无作业</div>
            </template>
            <template v-else>
              <v-icon color="grey" size="small"> mdi-plus </v-icon>
              <div class="text-caption text-grey">点击添加作业</div>
            </template>
          </v-card-text>
        </v-card>
      </TransitionGroup>
    </div>
  </div>
</template>

<script>
import HitokotoCard from '@/components/HitokotoCard.vue'
import TimeCard from '@/components/TimeCard.vue'
import ConciseExamCard from '@/components/home/ConciseExamCard.vue'
import { getSetting } from '@/utils/settings.js'

export default {
  name: 'HomeworkGrid',
  components: {
    HitokotoCard,
    TimeCard,
    ConciseExamCard,
  },
  props: {
    sortedItems: {
      type: Array,
      required: true,
    },
    unusedSubjects: {
      type: Array,
      required: true,
    },
    emptySubjectDisplay: {
      type: String,
      default: 'button',
    },
    isMobile: {
      type: Boolean,
      default: false,
    },
    isEditingDisabled: {
      type: Boolean,
      default: false,
    },
    contentStyle: {
      type: Object,
      default: () => ({}),
    },
    highlightedCards: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['open-dialog', 'open-attendance', 'disabled-click'],
  data() {
    return {
      isReadOnlyToken: false,
    }
  },
  async mounted() {
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeAllGridItems()
    })

    // Observe the grid container for width changes
    if (this.$refs.gridContainer) {
      this.resizeObserver.observe(this.$refs.gridContainer)
    }

    // Initial resize
    this.$nextTick(() => {
      this.resizeAllGridItems()
      // Observe all items
      if (this.$refs.items) {
        this.$refs.items.forEach((item) => {
          // Observe the content inside the grid item
          if (item.firstElementChild) {
            this.resizeObserver.observe(item.firstElementChild)
          }
        })
      }
    })

    // 检查只读状态
    await this.checkReadOnlyStatus()
  },
  updated() {
    // When items change, re-observe new items
    this.$nextTick(() => {
      this.resizeAllGridItems()
      if (this.$refs.items) {
        this.$refs.items.forEach((item) => {
          if (item.firstElementChild) {
            this.resizeObserver.observe(item.firstElementChild)
          }
        })
      }
    })
  },
  beforeUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
  },
  methods: {
    getSetting,
    async checkReadOnlyStatus() {
      // 尝试获取父组件中的StudentNameManager引用
      try {
        // 在Vue 2中，通过$parent或$root访问父组件
        let manager = null

        // 首先尝试直接访问父组件的引用
        if (this.$parent && this.$parent.$refs && this.$parent.$refs.studentNameManager) {
          manager = this.$parent.$refs.studentNameManager
        } else if (this.$root && this.$root.$refs && this.$root.$refs.studentNameManager) {
          manager = this.$root.$refs.studentNameManager
        }

        if (manager && typeof manager.isReadOnly !== 'undefined') {
          this.isReadOnlyToken = manager.isReadOnly
        } else {
          // 如果无法直接访问manager，尝试通过全局设置获取token信息
          // 这里需要使用utils/settings中的函数
          const { getSetting } = await import('@/utils/settings')
          const token = getSetting('server.kvToken')

          if (token) {
            // 通过API获取token信息来判断是否只读
            const { default: axios } = await import('@/axios/axios')
            const serverUrl = getSetting('server.domain')

            if (serverUrl) {
              try {
                const tokenResponse = await axios.get(`${serverUrl}/kv/_token`, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                })

                if (tokenResponse.data && typeof tokenResponse.data.isReadOnly !== 'undefined') {
                  this.isReadOnlyToken = tokenResponse.data.isReadOnly
                }
              } catch (err) {
                console.error('获取Token信息失败:', err)
              }
            }
          }
        }
      } catch (error) {
        console.error('检查只读状态失败:', error)
      }
    },
    resizeGridItem(item) {
      const grid = this.$refs.gridContainer
      if (!grid) return

      const rowHeight = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-auto-rows'))
      const rowGap = parseInt(window.getComputedStyle(grid).getPropertyValue('gap'))

      // Find the content element (v-card or div)
      const content = item.firstElementChild
      if (!content) return

      // Calculate required span
      // We use scrollHeight to get the full height of content
      // Add a small buffer to prevent scrollbars
      const contentHeight = content.getBoundingClientRect().height

      // Formula: span = ceil((contentHeight + gap) / (rowHeight + gap))
      const rowSpan = Math.ceil((contentHeight + rowGap) / (rowHeight + rowGap))

      item.style.gridRowEnd = `span ${rowSpan}`
    },
    resizeAllGridItems() {
      const items = this.$refs.items
      if (items) {
        items.forEach((item) => this.resizeGridItem(item))
      }
    },
    handleCardClick(type, key) {
      if (this.isEditingDisabled) {
        this.$emit('disabled-click')
        return
      }

      if (type === 'attendance') {
        this.$emit('open-attendance')
      } else if (type === 'dialog') {
        this.$emit('open-dialog', key)
      }
    },
    splitPoint(content) {
      return content.split('\n').filter((text) => text.trim())
    },
    handleMouseMove(e) {
      const card = e.currentTarget
      const rect = card.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      card.style.setProperty('--x', `${x}%`)
      card.style.setProperty('--y', `${y}%`)
    },
    handleTouchMove(e) {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        const card = e.currentTarget
        const rect = card.getBoundingClientRect()
        const x = ((touch.clientX - rect.left) / rect.width) * 100
        const y = ((touch.clientY - rect.top) / rect.height) * 100
        card.style.setProperty('--x', `${x}%`)
        card.style.setProperty('--y', `${y}%`)
      }
    },
  },
}
</script>

<style scoped>
.cursor-not-allowed {
  cursor: not-allowed !important;
}

.cursor-pointer {
  cursor: pointer;
}

.v-card.cursor-not-allowed:hover {
  transform: none !important;
}
</style>
