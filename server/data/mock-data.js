const species = [
  {
    id: "species-001",
    chineseName: "加拿大一枝黄花",
    latinName: "Solidago canadensis",
    category: "植物",
    riskLevel: "高",
    avatar: "/uploads/species/species-001.jpg",
    summary: "多年生草本植物，常在荒地、河岸和道路两侧快速扩散。",
    harm: "会挤压本地植物生境，降低生物多样性，并增加绿地和农田管理压力。",
    suggestion: "发现成片扩散时应记录时间和位置，并联系属地管理部门复核。"
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
    suggestion: "上报时尽量同时记录卵块、成体和周边水域环境，不建议自行大规模处置。"
  },
  {
    id: "species-003",
    chineseName: "红耳龟",
    latinName: "Trachemys scripta elegans",
    category: "动物",
    riskLevel: "中",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/Trachemys%20scripta%20elegans%20IMG%207436-2.jpg",
    summary: "常由宠物弃养进入城市水域，适应性强。",
    harm: "会与本地龟类争夺资源，扰乱城市水域生态。",
    suggestion: "建议连续记录时间和位置，便于后续巡查和风险评估。"
  },
  {
    id: "species-004",
    chineseName: "水葫芦",
    latinName: "Eichhornia crassipes",
    category: "植物",
    riskLevel: "高",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/Eichhornia%20crassipes.jpg",
    summary: "漂浮性水生植物，在富营养化水体中扩繁很快。",
    harm: "会遮挡水面、消耗溶氧、堵塞河道，影响航运和水体生态。",
    suggestion: "发现大面积漂浮群落时，应同步记录水域范围和覆盖程度。"
  },
  {
    id: "species-005",
    chineseName: "空心莲子草",
    latinName: "Alternanthera philoxeroides",
    category: "植物",
    riskLevel: "高",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/Alternanthera%20philoxeroides%20%2823700610838%29.jpg",
    summary: "常见于湿地、沟渠和农田边，耐受性强，匍匐扩张明显。",
    harm: "会侵占湿地和农田空间，影响排水和本地植被群落结构。",
    suggestion: "建议拍清楚叶片、茎节和生境，便于与相似植物区分。"
  },
  {
    id: "species-006",
    chineseName: "互花米草",
    latinName: "Spartina alterniflora",
    category: "植物",
    riskLevel: "高",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/Spartina%20alterniflora.jpg",
    summary: "滨海盐沼植物，常在滩涂和河口区域形成高密度群落。",
    harm: "会改变潮滩地貌和湿地生态过程，影响鸟类栖息地和海岸带管理。",
    suggestion: "上报时应尽量附带大范围环境图，帮助判断扩散规模。"
  },
  {
    id: "species-007",
    chineseName: "克氏原螯虾",
    latinName: "Procambarus clarkii",
    category: "动物",
    riskLevel: "中",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/Procambarus%20clarkii%20%2832290488233%29.jpg",
    summary: "俗称小龙虾，适应性强，常见于稻田、池塘、沟渠。",
    harm: "会掘洞破坏堤岸，也会改变水域群落结构和养殖环境。",
    suggestion: "拍摄时尽量包含个体特征和出现环境，避免与养殖场景混淆。"
  },
  {
    id: "species-008",
    chineseName: "牛蛙",
    latinName: "Lithobates catesbeianus",
    category: "动物",
    riskLevel: "中",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/American%20bullfrog%20%28Lithobates%20catesbeianus%29.jpg",
    summary: "大型蛙类，常见于池塘、湿地和养殖逃逸场景。",
    harm: "会捕食本地两栖动物和小型脊椎动物，并带来疾病传播风险。",
    suggestion: "建议记录叫声、体型和周围水域环境，便于后续复核。"
  },
  {
    id: "species-009",
    chineseName: "清道夫",
    latinName: "Pterygoplichthys pardalis",
    category: "动物",
    riskLevel: "中",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/Pterygoplichthys%20pardalis.jpg",
    summary: "常见于热带观赏鱼逸散场景，在南方水域有定殖风险。",
    harm: "会影响底栖生态和渔业环境，也可能造成堤岸洞穴问题。",
    suggestion: "建议拍摄鱼体花纹、口器和出现水域环境。"
  },
  {
    id: "species-010",
    chineseName: "豚草",
    latinName: "Ambrosia artemisiifolia",
    category: "植物",
    riskLevel: "高",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/Ambrosia%20artemisiifolia%202993.jpg",
    summary: "一年生草本杂草，常出现在荒地、道路旁和农田边。",
    harm: "花粉致敏性强，会影响人体健康，也会危害农业生产。",
    suggestion: "建议拍摄叶片、花序和成片分布范围。"
  },
  {
    id: "species-011",
    chineseName: "薇甘菊",
    latinName: "Mikania micrantha",
    category: "植物",
    riskLevel: "高",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/Mikania%20micrantha%20128.jpg",
    summary: "攀援藤本植物，生长迅速，常在南方地区形成覆盖。",
    harm: "会快速覆盖本地植被，被称为植物杀手之一。",
    suggestion: "建议拍摄藤蔓缠绕情况和周边被覆盖植被。"
  },
  {
    id: "species-012",
    chineseName: "巴西龟",
    latinName: "Trachemys scripta elegans",
    category: "动物",
    riskLevel: "中",
    avatar: "https://commons.wikimedia.org/wiki/Special:FilePath/Trachemys%20scripta%20elegans%20IMG%207439-2.jpg",
    summary: "市场俗称巴西龟，与红耳龟在实际使用中常被混称。",
    harm: "弃养进入自然水域后会与本地龟类竞争资源。",
    suggestion: "如果用户用俗名上报，可作为红耳龟同类外来龟类线索处理。"
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
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Solidago%20canadensis%20%284973669237%29.jpg",
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
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Pomacea%20canaliculata%2001.JPG",
    latitude: 31.8926,
    longitude: 118.8212,
    address: "南京市江宁区某河道边",
    remark: "看到了粉红色卵块和多只成体。",
    status: "pending",
    createdAt: "2026-04-21T11:10:00.000Z"
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
  }
];

module.exports = {
  species,
  reports,
  reviewLogs
};
