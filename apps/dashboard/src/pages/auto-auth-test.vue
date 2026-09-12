<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TestTube2,
  ArrowLeft,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Key,
  User,
  Database,
  Eye,
  EyeOff,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const router = useRouter()

// Tab 1: 通过 namespace 获取 token
const tab1Form = ref({
  namespace: '',
  password: '',
  appId: 'test-app-id-' + Date.now(),
})
const tab1Loading = ref(false)
const tab1Result = ref(null)
const tab1ShowPassword = ref(false)

// Tab 2: 设置学生名称
const tab2Form = ref({
  token: '',
  name: '',
})
const tab2Loading = ref(false)
const tab2Result = ref(null)

// Tab 3: KV 操作测试
const tab3Form = ref({
  token: '',
  key: '',
  value: '',
  operation: 'list', // list, get, set, delete
})
const tab3Loading = ref(false)
const tab3Result = ref(null)

// 测试 1: 获取 token
const testGetToken = async () => {
  if (!tab1Form.value.namespace) {
    toast.error('请输入 namespace')
    return
  }

  tab1Loading.value = true
  tab1Result.value = null

  try {
    const response = await apiClient.getTokenByNamespace(
      tab1Form.value.namespace,
      tab1Form.value.password || undefined,
      tab1Form.value.appId,
    )

    tab1Result.value = {
      success: true,
      data: response,
    }
    toast.success('获取 token 成功')

    // 自动填充到其他 tab
    if (response.token) {
      tab2Form.value.token = response.token
      tab3Form.value.token = response.token
    }
  } catch (error) {
    tab1Result.value = {
      success: false,
      error: error.message,
    }
    toast.error('获取 token 失败：' + error.message)
  } finally {
    tab1Loading.value = false
  }
}

// 测试 2: 设置学生名称
const testSetStudentName = async () => {
  if (!tab2Form.value.token) {
    toast.error('请输入 token')
    return
  }
  if (!tab2Form.value.name) {
    toast.error('请输入学生姓名')
    return
  }

  tab2Loading.value = true
  tab2Result.value = null

  try {
    const response = await apiClient.setStudentName(tab2Form.value.token, tab2Form.value.name)

    tab2Result.value = {
      success: true,
      data: response,
    }
    toast.success('设置学生名称成功')
  } catch (error) {
    tab2Result.value = {
      success: false,
      error: error.message,
    }
    toast.error('设置学生名称失败：' + error.message)
  } finally {
    tab2Loading.value = false
  }
}

// 测试 3: KV 操作
const testKVOperation = async () => {
  if (!tab3Form.value.token) {
    toast.error('请输入 token')
    return
  }

  const { operation, key, value } = tab3Form.value

  if (operation !== 'list' && !key) {
    toast.error('请输入 key')
    return
  }

  if (operation === 'set' && !value) {
    toast.error('请输入 value')
    return
  }

  tab3Loading.value = true
  tab3Result.value = null

  try {
    let response

    switch (operation) {
      case 'list':
        response = await apiClient.listKVItems(tab3Form.value.token)
        break
      case 'get':
        response = await apiClient.getKVItem(tab3Form.value.token, key)
        break
      case 'set': {
        let parsedValue
        try {
          parsedValue = JSON.parse(value)
        } catch {
          parsedValue = value
        }
        response = await apiClient.setKVItem(tab3Form.value.token, key, parsedValue)
        break
      }
      case 'delete':
        response = await apiClient.deleteKVItem(tab3Form.value.token, key)
        break
    }

    tab3Result.value = {
      success: true,
      data: response,
    }
    toast.success('操作成功')
  } catch (error) {
    tab3Result.value = {
      success: false,
      error: error.message,
    }
    toast.error('操作失败：' + error.message)
  } finally {
    tab3Loading.value = false
  }
}

// 格式化 JSON
const formatJson = (data) => {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

// 返回上一页
const goBack = () => {
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
    <!-- Header -->
    <div
      class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10"
    >
      <div class="container mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <Button size="icon" variant="ghost" @click="goBack">
              <ArrowLeft class="h-5 w-5" />
            </Button>
            <div>
              <h1 class="text-2xl font-bold flex items-center gap-2">
                <TestTube2 class="h-6 w-6" />
                AutoAuth API 测试
              </h1>
              <p class="text-sm text-muted-foreground">测试自动授权和相关 API 功能</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-6 py-8 max-w-7xl">
      <Tabs class="w-full" default-value="token">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="token">
            <Key class="h-4 w-4 mr-2" />
            获取 Token
          </TabsTrigger>
          <TabsTrigger value="student">
            <User class="h-4 w-4 mr-2" />
            学生名称
          </TabsTrigger>
          <TabsTrigger value="kv">
            <Database class="h-4 w-4 mr-2" />
            KV 操作
          </TabsTrigger>
        </TabsList>

        <!-- Tab 1: 获取 Token -->
        <TabsContent class="space-y-4" value="token">
          <Card>
            <CardHeader>
              <CardTitle>通过 Namespace 获取 Token</CardTitle>
              <CardDescription>
                测试 <code class="text-xs">POST /apps/auth/token</code> 接口
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="space-y-2">
                <Label for="namespace">Namespace *</Label>
                <Input
                  id="namespace"
                  v-model="tab1Form.namespace"
                  placeholder="例如: class-2024-1"
                />
              </div>

              <div class="space-y-2">
                <Label for="password">Password</Label>
                <div class="relative">
                  <Input
                    id="password"
                    v-model="tab1Form.password"
                    :type="tab1ShowPassword ? 'text' : 'password'"
                    placeholder="留空表示无密码授权"
                  />
                  <Button
                    class="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    size="icon"
                    tabindex="-1"
                    type="button"
                    variant="ghost"
                    @click="tab1ShowPassword = !tab1ShowPassword"
                  >
                    <Eye v-if="!tab1ShowPassword" class="h-4 w-4 text-muted-foreground" />
                    <EyeOff v-else class="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <div class="space-y-2">
                <Label for="appId">App ID</Label>
                <Input id="appId" v-model="tab1Form.appId" placeholder="应用标识符" />
              </div>

              <Button :disabled="tab1Loading" class="w-full" @click="testGetToken">
                <Loader2 v-if="tab1Loading" class="mr-2 h-4 w-4 animate-spin" />
                <Play v-else class="mr-2 h-4 w-4" />
                执行测试
              </Button>

              <!-- 结果显示 -->
              <div v-if="tab1Result" class="mt-4">
                <div class="flex items-center gap-2 mb-2">
                  <Badge :variant="tab1Result.success ? 'default' : 'destructive'">
                    <component
                      :is="tab1Result.success ? CheckCircle2 : XCircle"
                      class="h-3 w-3 mr-1"
                    />
                    {{ tab1Result.success ? '成功' : '失败' }}
                  </Badge>
                </div>
                <div class="rounded-lg bg-muted p-4">
                  <pre class="text-xs overflow-auto">{{
                    formatJson(tab1Result.success ? tab1Result.data : tab1Result.error)
                  }}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Tab 2: 设置学生名称 -->
        <TabsContent class="space-y-4" value="student">
          <Card>
            <CardHeader>
              <CardTitle>设置学生名称</CardTitle>
              <CardDescription>
                测试 <code class="text-xs">POST /apps/tokens/:token/set-student-name</code> 接口
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="space-y-2">
                <Label for="token2">Token *</Label>
                <Input id="token2" v-model="tab2Form.token" placeholder="从上一步获取的 token" />
              </div>

              <div class="space-y-2">
                <Label for="studentName">学生姓名 *</Label>
                <Input id="studentName" v-model="tab2Form.name" placeholder="例如: 张三" />
                <p class="text-xs text-muted-foreground">
                  名称必须在设备的学生列表中（存储在 classworks-list-main 键中）
                </p>
              </div>

              <Button :disabled="tab2Loading" class="w-full" @click="testSetStudentName">
                <Loader2 v-if="tab2Loading" class="mr-2 h-4 w-4 animate-spin" />
                <Play v-else class="mr-2 h-4 w-4" />
                执行测试
              </Button>

              <!-- 结果显示 -->
              <div v-if="tab2Result" class="mt-4">
                <div class="flex items-center gap-2 mb-2">
                  <Badge :variant="tab2Result.success ? 'default' : 'destructive'">
                    <component
                      :is="tab2Result.success ? CheckCircle2 : XCircle"
                      class="h-3 w-3 mr-1"
                    />
                    {{ tab2Result.success ? '成功' : '失败' }}
                  </Badge>
                </div>
                <div class="rounded-lg bg-muted p-4">
                  <pre class="text-xs overflow-auto">{{
                    formatJson(tab2Result.success ? tab2Result.data : tab2Result.error)
                  }}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Tab 3: KV 操作 -->
        <TabsContent class="space-y-4" value="kv">
          <Card>
            <CardHeader>
              <CardTitle>KV 存储操作测试</CardTitle>
              <CardDescription> 测试 KV API 的读写权限控制 </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="space-y-2">
                <Label for="token3">Token *</Label>
                <Input id="token3" v-model="tab3Form.token" placeholder="从第一步获取的 token" />
              </div>

              <div class="space-y-2">
                <Label for="operation">操作类型</Label>
                <select
                  id="operation"
                  v-model="tab3Form.operation"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="list">列出所有键值 (LIST)</option>
                  <option value="get">读取值 (GET)</option>
                  <option value="set">设置值 (SET)</option>
                  <option value="delete">删除值 (DELETE)</option>
                </select>
              </div>

              <div v-if="tab3Form.operation !== 'list'" class="space-y-2">
                <Label for="key">Key *</Label>
                <Input id="key" v-model="tab3Form.key" placeholder="例如: test-key" />
              </div>

              <div v-if="tab3Form.operation === 'set'" class="space-y-2">
                <Label for="value">Value (JSON) *</Label>
                <textarea
                  id="value"
                  v-model="tab3Form.value"
                  class="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder='例如: {"message": "Hello World"}'
                />
              </div>

              <Button :disabled="tab3Loading" class="w-full" @click="testKVOperation">
                <Loader2 v-if="tab3Loading" class="mr-2 h-4 w-4 animate-spin" />
                <Play v-else class="mr-2 h-4 w-4" />
                执行测试
              </Button>

              <!-- 结果显示 -->
              <div v-if="tab3Result" class="mt-4">
                <div class="flex items-center gap-2 mb-2">
                  <Badge :variant="tab3Result.success ? 'default' : 'destructive'">
                    <component
                      :is="tab3Result.success ? CheckCircle2 : XCircle"
                      class="h-3 w-3 mr-1"
                    />
                    {{ tab3Result.success ? '成功' : '失败' }}
                  </Badge>
                </div>
                <div class="rounded-lg bg-muted p-4">
                  <pre class="text-xs overflow-auto">{{
                    formatJson(tab3Result.success ? tab3Result.data : tab3Result.error)
                  }}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <!-- 使用说明 -->
      <Card class="mt-6 border-primary/20">
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent class="text-sm text-muted-foreground space-y-3">
          <div>
            <p class="font-medium text-foreground mb-1">📝 测试流程：</p>
            <ol class="list-decimal list-inside space-y-1 ml-2">
              <li>在「自动授权配置」页面创建授权配置</li>
              <li>使用配置的 namespace 和 password 获取 token</li>
              <li>如果是学生类型，可以设置学生名称</li>
              <li>使用获取的 token 测试 KV 操作权限</li>
            </ol>
          </div>
          <div>
            <p class="font-medium text-foreground mb-1">🔑 权限说明：</p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>只读 token 只能执行 LIST 和 GET 操作</li>
              <li>读写 token 可以执行所有操作</li>
              <li>学生类型 token 需要设置名称后才能正常使用</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
