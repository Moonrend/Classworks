<template>
  <settings-card border icon="mdi-monitor" title="显示设置">
    <v-list>
      <v-list-item>
        <template #prepend>
          <v-icon class="mr-3" icon="mdi-theme-light-dark" />
        </template>
        <v-list-item-title>主题模式</v-list-item-title>
        <v-list-item-subtitle>选择明亮或暗黑主题</v-list-item-subtitle>
        <template #append>
          <v-btn-toggle v-model="localTheme" color="primary" density="comfortable">
            <v-btn value="light">
              <v-icon class="mr-2" icon="mdi-white-balance-sunny" />
              明亮
            </v-btn>
            <v-btn value="dark">
              <v-icon class="mr-2" icon="mdi-moon-waning-crescent" />
              暗黑
            </v-btn>
          </v-btn-toggle>
        </template>
      </v-list-item>

      <v-divider class="my-2" />
      <setting-item :setting-key="'timeCard.enabled'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.emptySubjectDisplay'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.dynamicSort'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.showRandomButton'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.showFullscreenButton'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.cardHoverEffect'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.enhancedTouchMode'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.showQuickTools'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.showAntiScreenBurnCard'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.showExamScheduleButton'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.showUafTransfer'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.forceDesktopMode'" />

      <v-divider class="my-2" />
      <setting-item :setting-key="'display.lateStudentsArePresent'" />
    </v-list>
  </settings-card>
</template>

<script>
import SettingsCard from '@/components/SettingsCard.vue'
import SettingItem from '@/components/settings/SettingItem.vue'
import { getSetting, setSetting } from '@/utils/settings'
import { useTheme } from 'vuetify'

export default {
  name: 'DisplaySettingsCard',
  components: { SettingsCard, SettingItem },

  setup() {
    const theme = useTheme()
    return { theme }
  },

  data() {
    return {
      localTheme: getSetting('theme.mode'),
    }
  },

  watch: {
    localTheme(newValue) {
      setSetting('theme.mode', newValue)
      this.theme.global.name.value = newValue
    },
  },
}
</script>
