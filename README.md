<<<<<<< HEAD
# Invasive Species Reporter

一个面向微信小程序场景的外来物种上报项目骨架，目标是先跑通 `发现 -> 上传 -> 识别 -> 上报 -> 审核 -> 地图展示` 的闭环。

## 当前内容

- `miniprogram/`: 微信原生小程序骨架
- `server/`: Node API，支持图片上传、静态访问、识别调用、审核流
- `docs/`: 架构、接口和数据设计说明

## 当前能力

- 用户上传真实图片到本地服务目录
- 小程序调用后端进行真实识别
- 识别服务默认接智谱视觉模型
- 返回候选物种、置信度和说明
- 人工审核通过后进入地图展示

## 启动方式

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，至少填写：

```bash
ZHIPU_API_KEY=你的密钥
SERVER_PUBLIC_BASE_URL=http://你的局域网IP:3000
ZHIPU_MODEL=glm-4.6v-flash
```

### 3. 启动后端

```bash
node server/index.js
```

默认监听 `http://127.0.0.1:3000`。

### 4. 导入小程序

将 `miniprogram/` 导入微信开发者工具即可。

## 真实识别说明

- 当前实现会把上传的图片读为 base64，并通过智谱视觉模型进行分析。
- 若未配置 `ZHIPU_API_KEY`，识别接口会返回不可用提示。
- 当前物种识别是“在你们维护的重点物种列表中做候选判断”，不是通用生物百科识别器。

## 下一步建议

1. 把本地 `uploads/` 替换为腾讯云 COS 或微信云存储。
2. 给审核台加登录和角色权限。
3. 增加真实数据库而不是内存数组。
4. 后续再做热点分析和扩散预测。
=======
# invasive-species-reporter
My own Program
>>>>>>> 6e9d11ff69115ae414574f9aca0fd784623fb5f1
