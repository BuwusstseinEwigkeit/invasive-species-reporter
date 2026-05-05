# 数据结构

> 以 `server/lib/database.js` → `initSchema()` 为准。
> 最后更新：2026-05-02

## `species`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（如 species-001） |
| chinese_name | TEXT | 中文名 |
| latin_name | TEXT | 拉丁学名 |
| category | TEXT | 类别（植物/动物/昆虫/鱼类/水生植物/植物病害） |
| risk_level | TEXT | 风险等级（高/中） |
| avatar | TEXT | 头像路径 |
| summary | TEXT | 简介 |
| harm | TEXT | 危害说明 |
| suggestion | TEXT | 处置建议 |
| origin | TEXT | 原产地 |
| control_methods | TEXT | 防治方法 |
| relations | TEXT | JSON — 关联物种（天敌/类似/共生） |
| created_at | TEXT | 创建时间（UTC ISO 8601） |

## `reports`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID 格式） |
| user_id | TEXT | 上报用户 ID |
| species_id | TEXT | 关联物种（审核后填充） |
| ai_top1 | TEXT | AI 识别第 1 结果 |
| ai_score | REAL | 置信度 |
| ai_candidates | TEXT | JSON 候选结果列表 |
| image_url | TEXT | 图片路径 |
| latitude | REAL | 纬度 |
| longitude | REAL | 经度 |
| address | TEXT | 地址描述 |
| remark | TEXT | 用户备注 |
| status | TEXT | pending / approved / rejected / spam |
| image_fingerprint | TEXT | 图片 MD5 指纹 |
| created_at | TEXT | 上报时间（UTC ISO 8601） |

索引：`idx_reports_status(status)`, `idx_reports_species(species_id)`, `idx_reports_user(user_id)`

## `users`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID 格式） |
| username | TEXT | 用户名（唯一） |
| password_hash | TEXT | pbkdf2 哈希（salt:hash 格式） |
| role | TEXT | user / reviewer / admin |
| openid | TEXT | 微信 openid（唯一） |
| created_at | TEXT | 创建时间（UTC ISO 8601） |

## `review_logs`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID 格式） |
| report_id | TEXT | 上报 ID（外键 → reports） |
| reviewer_id | TEXT | 审核员 ID |
| action | TEXT | approved / rejected / spam |
| final_species_id | TEXT | 最终确认物种 |
| comment | TEXT | 审核意见 |
| created_at | TEXT | 时间（UTC ISO 8601） |

## `points`

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | TEXT | 主键（用户 ID） |
| total | INTEGER | 积分总额 |
| updated_at | TEXT | 最后更新时间 |

## `points_log`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID 格式） |
| user_id | TEXT | 用户 ID |
| amount | INTEGER | 变动积分（正/负） |
| action | TEXT | 变动原因（report_submit/report_approved/high_quality 等） |
| reference_id | TEXT | 关联对象 ID |
| created_at | TEXT | 时间（UTC ISO 8601） |

索引：`idx_points_log_user(user_id)`

## `user_credit`

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | TEXT | 主键（用户 ID） |
| score | INTEGER | 信用分（初始 100） |
| updated_at | TEXT | 最后更新时间 |

> 信用分与积分（points）独立：信用分用于控制每日上报配额，积分用于商城消费。

## `products`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 商品名 |
| description | TEXT | 描述 |
| points_cost | INTEGER | 所需积分 |
| image_url | TEXT | 图片路径 |
| stock | INTEGER | 库存 |
| category_id | TEXT | 分类 ID（cat-digital / cat-physical） |
| is_virtual | INTEGER | 是否虚拟商品（0/1） |
| requirement | TEXT | JSON — 购买条件（如需要某徽章） |
| sort_order | INTEGER | 排序权重 |

## `purchases`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID 格式） |
| user_id | TEXT | 购买用户 |
| product_id | TEXT | 商品 ID |
| created_at | TEXT | 购买时间 |

索引：`idx_purchases_user(user_id)`

## `orders`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID 格式） |
| user_id | TEXT | 用户 ID |
| product_id | TEXT | 商品 ID |
| status | TEXT | pending / shipped / completed / cancelled |
| shipping_name | TEXT | 收货人姓名 |
| shipping_phone | TEXT | 收货人电话 |
| shipping_address | TEXT | 收货地址 |
| created_at | TEXT | 下单时间 |
| updated_at | TEXT | 最后更新时间 |

索引：`idx_orders_user(user_id)`

## `product_categories`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 分类名 |
| sort_order | INTEGER | 排序权重 |

## `notifications`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID 格式） |
| user_id | TEXT | 接收用户 |
| title | TEXT | 标题 |
| body | TEXT | 内容 |
| type | TEXT | info / approved / rejected / achievement |
| reference_id | TEXT | 关联对象 ID |
| is_read | INTEGER | 是否已读（0/1） |
| created_at | TEXT | 时间（UTC ISO 8601） |

索引：`idx_notifications_user(user_id)`

## `achievements`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID 格式） |
| user_id | TEXT | 用户 ID |
| achievement_key | TEXT | 成就标识（first_report/eco_guard/contributor/expert/honorary_medal） |
| earned_at | TEXT | 获得时间 |

索引：`idx_achievements_user(user_id)`，唯一约束：`(user_id, achievement_key)`

## `image_fingerprints`

| 字段 | 类型 | 说明 |
|------|------|------|
| md5_hash | TEXT | 主键（图片 MD5） |
| user_id | TEXT | 上传用户 |
| file_size | INTEGER | 文件大小 |
| width | INTEGER | 图片宽度 |
| height | INTEGER | 图片高度 |
| created_at | TEXT | 上传时间 |

索引：`idx_image_fp_user(user_id)`

## `leaderboard_snapshot`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| week_start | TEXT | 周起始日 |
| type | TEXT | weekly / total / newcomer |
| rank_data | TEXT | JSON 排行数据 |
| created_at | TEXT | 快照时间 |

索引：`idx_leaderboard_week(week_start, type)`
