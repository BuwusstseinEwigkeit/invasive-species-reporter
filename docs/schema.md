# 数据结构

## `users`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| openid | TEXT | 微信 openid（唯一） |
| username | TEXT | 用户名（唯一） |
| password_hash | TEXT | bcrypt 哈希 |
| credit | INTEGER | 积分余额（初始 100） |
| role | TEXT | user / admin / reviewer |
| created_at | TEXT | 创建时间 |

## `species`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（如 species-001） |
| chineseName | TEXT | 中文名 |
| latinName | TEXT | 拉丁学名 |
| category | TEXT | 类别（植物/动物/昆虫/鱼类/水生植物/植物病害） |
| riskLevel | TEXT | 风险等级（高/中） |
| avatar | TEXT | 头像路径 |
| summary | TEXT | 简介 |
| harm | TEXT | 危害说明 |
| suggestion | TEXT | 处置建议 |
| origin | TEXT | 原产地 |
| controlMethods | TEXT | 防治方法 |
| relations | TEXT | JSON — 关联物种（天敌/类似/共生） |
| riskClass | TEXT | 风险分类 |

## `reports`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| user_id | TEXT | 上报用户 |
| species_id | TEXT | 关联物种（通过后填充） |
| latitude | REAL | 纬度 |
| longitude | REAL | 经度 |
| address | TEXT | 地址描述 |
| image_url | TEXT | 图片路径 |
| ai_top1 | TEXT | 图像匹配第1结果 |
| ai_score | REAL | 置信度 |
| ai_candidates | TEXT | JSON 候选结果列表 |
| remark | TEXT | 用户备注 |
| status | TEXT | pending / approved / rejected |
| review_remark | TEXT | 管理员审核备注 |
| created_at | TEXT | 上报时间 |

## `orders`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | TEXT | 购买用户 |
| product_id | TEXT | 商品 ID |
| status | TEXT | pending / shipped / completed / cancelled |
| shipping_address | TEXT | 收货地址（实物） |
| created_at | TEXT | 下单时间 |

## `user_credit`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | TEXT | 用户 |
| amount | INTEGER | 变动积分（正/负） |
| reason | TEXT | 变动原因 |
| created_at | TEXT | 时间 |

## `image_fingerprints`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| md5 | TEXT | 图片 MD5 |
| user_id | TEXT | 上传用户 |
| created_at | TEXT | 时间 |

## `achievements` / `user_achievements`

徽章定义表 + 用户徽章领取记录。徽章等级：newbie → eco_guard → contributor → expert → species。

## `notifications`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | TEXT | 接收用户 |
| type | TEXT | 通知类型 |
| title | TEXT | 标题 |
| content | TEXT | 内容 |
| is_read | INTEGER | 是否已读（0/1） |
| created_at | TEXT | 时间 |

## `review_logs`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| report_id | TEXT | 上报 ID |
| reviewer_id | TEXT | 审核员 ID |
| action | TEXT | approved / rejected |
| final_species_id | TEXT | 最终确认物种 |
| comment | TEXT | 审核意见 |
| created_at | TEXT | 时间 |
