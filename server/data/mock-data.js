const species = [
  {
    id: "species-001",
    chineseName: "加拿大一枝黄花",
    latinName: "Solidago canadensis",
    category: "植物",
    riskLevel: "高",
    avatar: "/static/species/species-001.jpg",
    summary: "多年生草本植物，常在荒地、河岸和道路两侧快速扩散。",
    harm: "会挤压本地植物生境，降低生物多样性，并增加绿地和农田管理压力。",
    suggestion: "发现成片扩散时应记录时间和位置，并联系属地管理部门复核。",
    relations: [{"type": "天敌", "speciesId": "species-015", "name": "美国白蛾", "desc": "同区域竞争生境"}, {"type": "类似", "speciesId": "species-005", "name": "空心莲子草", "desc": "常见伴生入侵植物"}],
    origin: "北美洲",
    controlMethods: "人工拔除或机械铲除，在开花前连根挖出并集中焚烧；可选用草甘膦等除草剂定向喷雾。"
  },
  {
    id: "species-002",
    chineseName: "福寿螺",
    latinName: "Pomacea canaliculata",
    category: "动物",
    riskLevel: "高",
    avatar: "/static/species/species-002.jpg",
    summary: "大型淡水螺类，常见于稻田、池塘和沟渠环境。",
    harm: "危害水稻和水生植物，也存在传播寄生虫的公共卫生风险。",
    suggestion: "上报时尽量同时记录卵块、成体和周边水域环境，不建议自行大规模处置。",
    relations: [{"type": "天敌", "speciesId": "species-007", "name": "克氏原螯虾", "desc": "捕食幼螺"}, {"type": "类似", "speciesId": "species-016", "name": "非洲大蜗牛", "desc": "同为入侵软体动物"}],
    origin: "南美洲（亚马逊河流域）",
    controlMethods: "人工摘除卵块并集中销毁；冬季排干积水杀灭成螺；使用杀螺胺等专用药剂。"
  },
  {
    id: "species-003",
    chineseName: "红耳龟",
    latinName: "Trachemys scripta elegans",
    category: "动物",
    riskLevel: "中",
    avatar: "/static/species/species-003.jpg",
    summary: "常由宠物弃养进入城市水域，适应性强。",
    harm: "会与本地龟类争夺资源，扰乱城市水域生态。",
    suggestion: "建议连续记录时间和位置，便于后续巡查和风险评估。",
    relations: [{"type": "类似", "speciesId": "species-012", "name": "巴西龟", "desc": "同种异名，常被混用"}],
    origin: "美国中南部（密西西比河流域）",
    controlMethods: "严禁野外放生；加强宠物交易监管；在繁殖期人工清理卵窝。"
  },
  {
    id: "species-004",
    chineseName: "水葫芦",
    latinName: "Eichhornia crassipes",
    category: "植物",
    riskLevel: "高",
    avatar: "/static/species/species-004.jpg",
    summary: "漂浮性水生植物，在富营养化水体中扩繁很快。",
    harm: "会遮挡水面、消耗溶氧、堵塞河道，影响航运和水体生态。",
    suggestion: "发现大面积漂浮群落时，应同步记录水域范围和覆盖程度。",
    relations: [{"type": "类似", "speciesId": "species-018", "name": "大藻", "desc": "同属漂浮水生植物"}, {"type": "共生", "speciesId": "species-002", "name": "福寿螺", "desc": "喜附着于水葫芦叶片"}],
    origin: "南美洲（亚马逊河流域）",
    controlMethods: "机械打捞是主要手段，需在种子成熟前完成；可引入象甲等天敌生物防治。"
  },
  {
    id: "species-005",
    chineseName: "空心莲子草",
    latinName: "Alternanthera philoxeroides",
    category: "植物",
    riskLevel: "高",
    avatar: "/static/species/species-005.jpg",
    summary: "常见于湿地、沟渠和农田边，耐受性强，匍匐扩张明显。",
    harm: "会侵占湿地和农田空间，影响排水和本地植被群落结构。",
    suggestion: "建议拍清楚叶片、茎节和生境，便于与相似植物区分。",
    relations: [{"type": "类似", "speciesId": "species-001", "name": "加拿大一枝黄花", "desc": "高入侵性草本植物"}],
    origin: "南美洲",
    controlMethods: "人工拔除须连根清除；覆盖黑色地膜抑制生长；使用氯氟吡氧乙酸等选择性除草剂。"
  },
  {
    id: "species-006",
    chineseName: "互花米草",
    latinName: "Spartina alterniflora",
    category: "植物",
    riskLevel: "高",
    avatar: "/static/species/species-006.jpg",
    summary: "滨海盐沼植物，常在滩涂和河口区域形成高密度群落。",
    harm: "会改变潮滩地貌和湿地生态过程，影响鸟类栖息地和海岸带管理。",
    suggestion: "上报时应尽量附带大范围环境图，帮助判断扩散规模。",
    relations: [{"type": "类似", "speciesId": "species-004", "name": "水葫芦", "desc": "同为水生高入侵物种"}],
    origin: "北美洲大西洋沿岸",
    controlMethods: "物理刈割结合水淹法；引入光蝉等专食性天敌；围堤阻断扩散路径。"
  },
  {
    id: "species-007",
    chineseName: "克氏原螯虾",
    latinName: "Procambarus clarkii",
    category: "动物",
    riskLevel: "中",
    avatar: "/static/species/species-007.jpg",
    summary: "俗称小龙虾，适应性强，常见于稻田、池塘、沟渠。",
    harm: "会掘洞破坏堤岸，也会改变水域群落结构和养殖环境。",
    suggestion: "拍摄时尽量包含个体特征和出现环境，避免与养殖场景混淆。",
    relations: [{"type": "天敌", "speciesId": "species-002", "name": "福寿螺", "desc": "捕食福寿螺幼体"}, {"type": "类似", "speciesId": "species-017", "name": "尼罗罗非鱼", "desc": "同为入侵水生动物"}],
    origin: "北美洲（墨西哥湾沿岸）",
    controlMethods: "在繁殖期集中捕捞；加强养殖防逃设施；在稻田中可通过晒田控制种群。"
  },
  {
    id: "species-008",
    chineseName: "牛蛙",
    latinName: "Lithobates catesbeianus",
    category: "动物",
    riskLevel: "中",
    avatar: "/static/species/species-008.jpg",
    summary: "大型蛙类，常见于池塘、湿地和养殖逃逸场景。",
    harm: "会捕食本地两栖动物和小型脊椎动物，并带来疾病传播风险。",
    suggestion: "建议记录叫声、体型和周围水域环境，便于后续复核。",
    relations: [{"type": "天敌", "speciesId": "species-003", "name": "红耳龟", "desc": "捕食蝌蚪和幼蛙"}],
    origin: "北美洲东部",
    controlMethods: "人工捕捉成体和蝌蚪；清除产卵水域的植被；加强养殖场防逃管理。"
  },
  {
    id: "species-009",
    chineseName: "清道夫",
    latinName: "Pterygoplichthys pardalis",
    category: "动物",
    riskLevel: "中",
    avatar: "/static/species/species-009.jpg",
    summary: "常见于热带观赏鱼逸散场景，在南方水域有定殖风险。",
    harm: "会影响底栖生态和渔业环境，也可能造成堤岸洞穴问题。",
    suggestion: "建议拍摄鱼体花纹、口器和出现水域环境。",
    origin: "南美洲亚马逊河流域",
    controlMethods: "在自然水域中无法根除，以预防为主；加强水族贸易监管和公众宣教。"
  },
  {
    id: "species-010",
    chineseName: "豚草",
    latinName: "Ambrosia artemisiifolia",
    category: "植物",
    riskLevel: "高",
    avatar: "/static/species/species-010.jpg",
    summary: "一年生草本杂草，常出现在荒地、道路旁和农田边。",
    harm: "花粉致敏性强，会影响人体健康，也会危害农业生产。",
    suggestion: "建议拍摄叶片、花序和成片分布范围。",
    relations: [{"type": "类似", "speciesId": "species-019", "name": "刺苋", "desc": "同为农田常见杂草"}],
    origin: "北美洲",
    controlMethods: "在开花前刈割或拔除；使用百草敌等除草剂；种植紫穗槐等竞争性替代植物。"
  },
  {
    id: "species-011",
    chineseName: "薇甘菊",
    latinName: "Mikania micrantha",
    category: "植物",
    riskLevel: "高",
    avatar: "/static/species/species-011.jpg",
    summary: "攀援藤本植物，生长迅速，常在南方地区形成覆盖。",
    harm: "会快速覆盖本地植被，被称为植物杀手之一。",
    suggestion: "建议拍摄藤蔓缠绕情况和周边被覆盖植被。",
    origin: "中南美洲",
    controlMethods: "人工清除须连根拔除；引入锈菌等天敌进行生物防治；使用森草净等除草剂涂抹藤茎。"
  },
  {
    id: "species-012",
    chineseName: "巴西龟",
    latinName: "Trachemys scripta elegans",
    category: "动物",
    riskLevel: "中",
    avatar: "/static/species/species-012.jpg",
    summary: "市场俗称巴西龟，与红耳龟在实际使用中常被混称。",
    harm: "弃养进入自然水域后会与本地龟类竞争资源。",
    suggestion: "如果用户用俗名上报，可作为红耳龟同类外来龟类线索处理。",
    origin: "美国中南部",
    controlMethods: "与红耳龟相同，禁止在自然水域放生；开展宠物回收购置计划。"
  }
];

const reports = [
  {
    id: "report-1001",
    userId: "user-001",
    speciesId: "species-001",
    aiTop1: "加拿大一枝黄花",
    aiScore: 0.82,
    aiCandidates: [
      { speciesId: "species-001", speciesName: "加拿大一枝黄花", confidence: 0.82 },
      { speciesId: "species-005", speciesName: "空心莲子草", confidence: 0.18 }
    ],
    imageUrl: "/static/species/species-001.jpg",
    latitude: 32.0617,
    longitude: 118.7778,
    address: "南京市江宁区东南大学九龙湖校区",
    remark: "体育场外围绿化带发现成片黄色花序。",
    status: "approved",
    createdAt: "2026-04-20T09:30:00.000Z"
  },
  {
    id: "report-1002",
    userId: "user-002",
    speciesId: "species-002",
    aiTop1: "福寿螺",
    aiScore: 0.76,
    aiCandidates: [
      { speciesId: "species-002", speciesName: "福寿螺", confidence: 0.76 },
      { speciesId: "species-007", speciesName: "克氏原螯虾", confidence: 0.12 }
    ],
    imageUrl: "/static/species/species-002.jpg",
    latitude: 31.8926,
    longitude: 118.8212,
    address: "南京市江宁区某河道边",
    remark: "看到了粉红色卵块和多只成体。",
    status: "approved",
    createdAt: "2026-04-21T11:10:00.000Z"
  },
  {
    id: "report-1003",
    userId: "user-001",
    speciesId: "species-004",
    aiTop1: "水葫芦",
    aiScore: 0.91,
    aiCandidates: [
      { speciesId: "species-004", speciesName: "水葫芦", confidence: 0.91 }
    ],
    imageUrl: "/static/species/species-004.jpg",
    latitude: 32.0387,
    longitude: 118.7512,
    address: "南京市江宁区百家湖",
    remark: "湖边发现成片水葫芦。",
    status: "approved",
    createdAt: "2026-04-22T14:30:00.000Z"
  },
  {
    id: "report-1004",
    userId: "user-003",
    speciesId: "species-003",
    aiTop1: "红耳龟",
    aiScore: 0.88,
    aiCandidates: [
      { speciesId: "species-003", speciesName: "红耳龟", confidence: 0.88 },
      { speciesId: "species-012", speciesName: "巴西龟", confidence: 0.12 }
    ],
    imageUrl: "/static/species/species-003.jpg",
    latitude: 32.0802,
    longitude: 118.7928,
    address: "南京市玄武区玄武湖公园",
    remark: "湖边看到多只红耳龟晒太阳。",
    status: "approved",
    createdAt: "2026-04-23T09:15:00.000Z"
  },
  {
    id: "report-1005",
    userId: "user-002",
    speciesId: "species-007",
    aiTop1: "克氏原螯虾",
    aiScore: 0.85,
    aiCandidates: [
      { speciesId: "species-007", speciesName: "克氏原螯虾", confidence: 0.85 }
    ],
    imageUrl: "/static/species/species-007.jpg",
    latitude: 31.9512,
    longitude: 118.8576,
    address: "南京市秦淮区秦淮河沿岸",
    remark: "河边发现小龙虾洞穴。",
    status: "pending",
    createdAt: "2026-04-24T16:20:00.000Z"
  }
];

const reviewLogs = [
  {
    id: "review-001",
    reportId: "report-1001",
    reviewerId: "reviewer-001",
    action: "approved",
    finalSpeciesId: "species-001",
    comment: "位置明确，特征清晰。",
    createdAt: "2026-04-20T10:00:00.000Z"
  },
  {
    id: "review-002",
    reportId: "report-1002",
    reviewerId: "reviewer-001",
    action: "approved",
    finalSpeciesId: "species-002",
    comment: "卵块特征明显，确认为福寿螺。",
    createdAt: "2026-04-21T15:00:00.000Z"
  },
  {
    id: "review-003",
    reportId: "report-1003",
    reviewerId: "reviewer-001",
    action: "approved",
    finalSpeciesId: "species-004",
    comment: "水葫芦典型特征，通过。",
    createdAt: "2026-04-22T16:00:00.000Z"
  },
  {
    id: "review-004",
    reportId: "report-1004",
    reviewerId: "reviewer-001",
    action: "approved",
    finalSpeciesId: "species-003",
    comment: "红耳龟特征明显，确认。",
    createdAt: "2026-04-23T10:00:00.000Z"
  }
];

// Expanding categories to include insects, fish, plant diseases
species.push(
  {
    id: "species-013",
    chineseName: "红火蚁",
    latinName: "Solenopsis invicta",
    category: "昆虫",
    riskLevel: "高",
    avatar: "/static/species/species-013.jpg",
    summary: "原产南美洲的入侵蚂蚁，攻击性强，在南方地区已形成大规模定殖。",
    harm: "叮咬人畜可引起过敏反应甚至休克，破坏生态平衡，危害农业和基础设施。",
    suggestion: "发现蚁丘时切勿惊扰，立即记录位置并上报当地农业或林业部门处理。",
    relations: [{"type": "天敌", "speciesId": "species-008", "name": "牛蛙", "desc": "捕食有翅蚁"}, {"type": "类似", "speciesId": "species-015", "name": "美国白蛾", "desc": "同为高危害入侵昆虫"}],
    origin: "南美洲（巴拉那河流域）",
    controlMethods: "发现蚁丘立即标记并上报检疫部门；使用毒饵诱杀，切勿惊扰蚁丘。"
  },
  {
    id: "species-014",
    chineseName: "松材线虫",
    latinName: "Bursaphelenchus xylophilus",
    category: "植物病害",
    riskLevel: "高",
    avatar: "/static/species/species-014.jpg",
    summary: "引起松树萎蔫病的病原线虫，通过松墨天牛传播，对松林造成毁灭性危害。",
    harm: "感染后松树在数周至数月内枯死，目前尚无有效治疗手段，只能伐除销毁。",
    suggestion: "发现松树针叶变黄、枯萎时，应采集样本并立即联系林业部门。",
    origin: "北美洲",
    controlMethods: "及时砍伐并销毁感病松树，树干用药剂熏蒸杀灭线虫；严格检疫松木制品运输。"
  },
  {
    id: "species-015",
    chineseName: "美国白蛾",
    latinName: "Hyphantria cunea",
    category: "昆虫",
    riskLevel: "高",
    avatar: "/static/species/species-015.jpg",
    summary: "世界性检疫害虫，幼虫吐丝结网群居危害，食性极杂。",
    harm: "可取食300多种植物，严重时可将整株树叶吃光，影响城市绿化和林业。",
    suggestion: "发现网幕状虫巢时应记录位置，避免自行触碰幼虫，上报林业部门。",
    relations: [{"type": "类似", "speciesId": "species-020", "name": "椰心叶甲", "desc": "同为林业检疫害虫"}, {"type": "天敌", "speciesId": "species-013", "name": "红火蚁", "desc": "捕食幼虫"}],
    origin: "北美洲",
    controlMethods: "剪除网幕枝条集中烧毁；幼虫期喷洒苏云金杆菌或灭幼脲；成虫期灯光诱杀。"
  },
  {
    id: "species-016",
    chineseName: "非洲大蜗牛",
    latinName: "Achatina fulica",
    category: "动物",
    riskLevel: "中",
    avatar: "/static/species/species-016.jpg",
    summary: "大型陆生蜗牛，在中国南方已广泛定殖，繁殖迅速。",
    harm: "取食农作物和园艺植物，也是多种寄生虫的中间宿主，具公共卫生风险。",
    suggestion: "发现时避免直接接触，可记录环境照片后上报，不建议自行放生或饲养。",
    origin: "东非",
    controlMethods: "人工捡拾成螺销毁；在菜地周围撒生石灰带阻隔；避免与皮肤直接接触。"
  },
  {
    id: "species-017",
    chineseName: "尼罗罗非鱼",
    latinName: "Oreochromis niloticus",
    category: "鱼类",
    riskLevel: "中",
    avatar: "/static/species/species-017.jpg",
    summary: "原产非洲的淡水鱼类，因养殖逃逸在南方水域广泛定殖。",
    harm: "会与本地鱼类竞争食物和繁殖空间，改变水域群落结构。",
    suggestion: "在自然水域发现时应记录大致数量和个体大小，上报渔业管理部门。",
    origin: "非洲（尼罗河流域）",
    controlMethods: "在自然水域中难以根除，以控制种群密度为主；加强养殖防逃和引种管理。"
  },
  {
    id: "species-018",
    chineseName: "大藻",
    latinName: "Pistia stratiotes",
    category: "水生植物",
    riskLevel: "高",
    avatar: "/static/species/species-018.jpg",
    summary: "漂浮性水生植物，俗称水浮莲，在富营养化水体中极易暴发。",
    harm: "大面积覆盖水面会导致水体缺氧，影响水生态和航运，与本地水生植物竞争。",
    suggestion: "发现成片聚集时应记录水域范围、覆盖程度和周边环境。",
    origin: "南美洲或非洲（热带地区）",
    controlMethods: "机械打捞清理水面聚集群落；引入象甲等天敌抑制扩繁；加强水体富营养化治理。"
  },
  {
    id: "species-019",
    chineseName: "刺苋",
    latinName: "Amaranthus spinosus",
    category: "植物",
    riskLevel: "中",
    avatar: "/static/species/species-019.jpg",
    summary: "一年生草本，茎具锐刺，常见于农田、路边和荒地。",
    harm: "与农作物争夺水分和养分，其锐刺也给田间管理带来困难。",
    suggestion: "记录分布范围和密度，常规农业管理措施即可控制。",
    origin: "热带美洲",
    controlMethods: "常规田间除草即可控制；在结实前进行刈割可有效减少种子库积累。"
  },
  {
    id: "species-020",
    chineseName: "椰心叶甲",
    latinName: "Brontispa longissima",
    category: "昆虫",
    riskLevel: "中",
    avatar: "/static/species/species-020.jpg",
    summary: "危害棕榈科植物的检疫性害虫，在南方沿海省份已定殖。",
    harm: "幼虫钻蛀心叶取食，导致叶片枯死、树势衰弱，严重时可致植株死亡。",
    suggestion: "发现棕榈科植物心叶出现条形枯斑或虫粪时，记录并上报检疫部门。",
    origin: "东南亚至太平洋岛屿",
    controlMethods: "加强棕榈科植物调运检疫；心叶喷洒杀虫剂保护生长点；挂设诱虫灯监测成虫。"
  }
);

const products = [
  {
    id: "product-001",
    name: "外来物种识别手册",
    description: "涵盖50种常见外来物种的图文识别指南，适合野外巡查参考。",
    pointsCost: 200,
    imageUrl: "/static/products/product-001.png",
    stock: 100
  },
  {
    id: "product-002",
    name: "生态田野笔记本",
    description: "防水耐磨的户外记录本，方便在野外记录观测数据。",
    pointsCost: 100,
    imageUrl: "/static/products/product-002.png",
    stock: 200
  },
  {
    id: "product-003",
    name: "哨点徽章",
    description: "「外来物种哨点」限量版纪念徽章，表彰您的生态贡献。",
    pointsCost: 50,
    imageUrl: "/static/products/product-003.png",
    stock: 500
  },
  {
    id: "product-004",
    name: "数据导出权限",
    description: "解锁完整的已核实数据导出功能（CSV格式），支持进一步分析。",
    pointsCost: 300,
    imageUrl: "/static/products/product-004.png",
    stock: 9999
  }
];

module.exports = {
  species,
  reports,
  reviewLogs,
  products
};
