# 数据结构

## `species`

- `id`
- `chineseName`
- `latinName`
- `category`
- `riskLevel`
- `avatar`
- `summary`
- `harm`
- `suggestion`

## `report`

- `id`
- `userId`
- `speciesId`
- `aiTop1`
- `aiScore`
- `imageUrl`
- `latitude`
- `longitude`
- `address`
- `remark`
- `status`
- `createdAt`

## `reviewLog`

- `id`
- `reportId`
- `reviewerId`
- `action`
- `finalSpeciesId`
- `comment`
- `createdAt`
