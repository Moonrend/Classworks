# 设备授权流程 - CLI 工具

命令行工具，用于通过设备授权流程获取访问令牌。支持两种授权模式：

- **设备代码模式** (`get-token.js`) - 用户手动输入设备代码完成授权
- **回调模式** (`get-token-callback.js`) - 通过浏览器回调自动完成授权

## 使用方法

### 1. 设备代码模式（推荐用于无GUI环境）

```bash
node cli/get-token.js
```

### 2. 回调模式（推荐用于桌面环境）

```bash
node cli/get-token-callback.js
```

### 环境变量配置

两种模式都支持以下环境变量：

```bash
# 设置API服务器地址（默认: http://localhost:3000）
export API_BASE_URL=https://your-api-server.com

# 设置授权页面地址（默认: http://localhost:5173/authorize）
export AUTH_PAGE_URL=https://your-classworks-frontend.com/authorize

# 设置应用ID（默认: 1）
export APP_ID=1

# 设置站点密钥（如果需要）
export SITE_KEY=your-site-key

# 回调模式特有配置
export CALLBACK_PORT=8080      # 回调服务器端口（默认: 8080）
export TIMEOUT=300             # 授权超时时间（默认: 300秒）

# 运行工具
node cli/get-token.js         # 设备代码模式
node cli/get-token-callback.js # 回调模式
```

### 使其可执行（Linux/Mac）

```bash
chmod +x cli/get-token.js
./cli/get-token.js
```

## 工作流程

### 设备代码模式 (`get-token.js`)

1. **生成设备代码** - 工具会自动调用 API 生成形如 `1234-ABCD` 的授权码
2. **显示授权链接** - 在终端显示完整的授权URL，包含设备代码
3. **等待授权** - 用户点击链接或在授权页面手动输入设备代码完成授权
4. **获取令牌** - 工具自动轮询并获取令牌
5. **保存令牌** - 令牌会保存到 `~/.classworks/token.txt`

### 回调模式 (`get-token-callback.js`)

1. **获取设备UUID** - 自动获取或生成设备UUID
2. **启动回调服务器** - 在本地启动HTTP服务器监听回调
3. **打开授权页面** - 自动在浏览器中打开授权页面
4. **用户授权** - 用户在浏览器中完成授权操作
5. **接收回调** - 本地服务器接收授权回调并获取令牌
6. **保存令牌** - 令牌会保存到 `~/.classworks/token-callback.txt`

## 输出示例

### 设备代码模式输出

```text
设备授权流程 - 令牌获取工具

✓ 设备授权码生成成功！

============================================================
  请访问以下地址完成授权：

  https://classworks.xiaomo.tech/authorize?app_id=1&mode=devicecode&devicecode=1234-ABCD

  设备授权码: 1234-ABCD
============================================================
ℹ 授权码有效期: 15 分钟
ℹ API服务器: http://localhost:3000

ℹ 请在浏览器中打开上述地址，或在授权页面手动输入设备代码
ℹ 等待授权中...

等待授权... (1/100)
等待授权... (2/100)

==================================================
✓ 授权成功！令牌获取完成
==================================================

您的访问令牌：
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

✓ 令牌已保存到: /home/user/.classworks/token.txt

使用示例：
  curl -H "Authorization: Bearer eyJhbGc..." http://localhost:3000/kv
```

### 回调模式输出

```text
回调授权流程 - 令牌获取工具

ℹ 正在获取设备UUID...
✓ 设备UUID: 1234567890abcdef1234567890abcdef

============================================================
  请访问以下地址完成授权：

  http://localhost:5173/authorize?app_id=1&mode=callback&callback_url=http://localhost:8080/callback&state=abc123

  设备UUID: 1234567890abcdef1234567890abcdef
  状态参数: abc123
============================================================
ℹ 回调地址: http://localhost:8080/callback
ℹ API服务器: http://localhost:3000
ℹ 超时时间: 300 秒

ℹ 正在启动回调服务器...
✓ 回调服务器已启动: http://localhost:8080/callback
ℹ 正在尝试打开浏览器...
✓ 已尝试打开浏览器
ℹ 等待授权完成...

==================================================
✓ 授权成功！令牌获取完成
==================================================

您的访问令牌：
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

✓ 令牌已保存到: /home/user/.classworks/token-callback.txt

使用示例：
  curl -H "Authorization: Bearer eyJhbGc..." http://localhost:3000/kv
```

## 配置选项

### 通用配置

可以通过修改相应文件中的 `CONFIG` 对象或设置环境变量来调整：

- `baseUrl` / `API_BASE_URL` - API 服务器地址（默认: `http://localhost:3000`）
- `authPageUrl` / `AUTH_PAGE_URL` - Classworks 授权页面地址（默认: `http://localhost:5173/authorize`）
- `appId` / `APP_ID` - 应用ID（默认: 1）
- `siteKey` / `SITE_KEY` - 站点密钥（如果需要）

### 设备代码模式专用配置

- `pollInterval` - 轮询间隔（秒，默认3秒）
- `maxPolls` - 最大轮询次数（默认100次）

### 回调模式专用配置

- `callbackPort` / `CALLBACK_PORT` - 回调服务器端口（默认: 8080）
- `timeout` / `TIMEOUT` - 授权超时时间（秒，默认: 300）
- `callbackPath` - 回调路径（默认: /callback）

## 错误处理

### 设备代码模式

- 如果设备代码过期，会显示错误并退出
- 如果轮询超时（默认5分钟），会显示超时错误
- 如果无法连接到服务器，会显示连接错误

### 回调模式

- 如果回调端口被占用，会提示更换端口
- 如果授权超时，会显示超时错误并提示延长超时时间
- 如果状态参数不匹配，会拒绝授权防止CSRF攻击
- 如果无法连接到服务器，会显示连接错误

## 选择模式建议

- **设备代码模式** - 适用于无GUI环境、服务器环境、或无法启动本地服务器的场景
- **回调模式** - 适用于桌面环境、开发环境、或希望更流畅授权体验的场景
