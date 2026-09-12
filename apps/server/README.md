# Classworks KV

[Classworks](https://cs.houlangs.com)用于班级大屏的作业板小工具

ClassworksKV 是 Classworks 的后端实现，这是一个KV存储服务，用于存储和查询数据信息，如作业、花名册等，也可以用于其他用途。

此项目由[厚浪云](https://houlangs.com)提供，访问公开实例零配置使用 [Classworks](https://cs.houlangs.com)

[![通过雨云一键部署](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/6229/wuyuan_)

## 文档

[Classworks 文档](https://docs.wuyuan.dev)

## 许可证

This project is licensed under the **GNU AGPL v3.0**.

Copyright (C) 2025 **Sunwuyuan** (<https://wuyuan.dev>)
See [LICENSE](./LICENSE) for details.

## 配置（OAuth / JWT）

在根目录创建或编辑 `.env`：

- 基础地址（用于回调）：
  - `BASE_URL`: `http://localhost:3000`
  - `FRONTEND_URL`: `http://localhost:5173`

- STCN（Casdoor）OIDC：
  - `STCN_CLIENT_ID`: `53e65cfd81232e729730`
  - `STCN_CLIENT_SECRET`: `e1b1277f8906e5df162b1d2f2eb3692182dd2920`
  - 回调地址：`${BASE_URL}/accounts/oauth/stcn/callback`

- 其他可选提供者：GitHub、ZeroCat、厚浪云（Logto）

- JWT：
  - 默认 HS256（提供 `JWT_SECRET`）
  - 如需 RS256，请设置：
    - `JWT_ALG=RS256`
    - `JWT_PRIVATE_KEY`（PEM，\n 转义）
    - `JWT_PUBLIC_KEY`（PEM，\n 转义）
    - `JWT_EXPIRES_IN=7d`

完成后启动服务并访问：

- GET /accounts/oauth/providers 列出可用登录方式
- 浏览器打开 /accounts/oauth/stcn 发起 STCN 登录
