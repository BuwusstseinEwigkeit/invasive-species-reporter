# -*- coding: utf-8 -*-
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

doc = Document()

# 设置中文字体
def set_run_font(run, font_name='宋体', size=12, bold=False):
    run.font.name = font_name
    run.font.size = Pt(size)
    run.font.bold = bold
    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)

# 标题
title = doc.add_heading('学生制作小程序项目经验报告', level=0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

# 报告概述
doc.add_heading('报告概述', level=1)
p = doc.add_paragraph('本报告详细总结了学生制作小程序的项目经验，涵盖项目案例、开发流程、技术要点以及学习心得，帮助学生了解并掌握小程序开发的完整知识体系。')

# 一、项目案例
doc.add_heading('一、项目案例', level=1)

# 1.1 搜题小程序
doc.add_heading('1.1 搜题小程序', level=2)
doc.add_paragraph('目标用户：学生、教师')
doc.add_paragraph('核心功能：')
for item in ['拍照搜题：识别题目并展示解析结果', '文字搜题：输入题目关键词进行搜索', '题目解析：提供详细的解题步骤和思路', '错题本：记录错题并进行复习']:
    doc.add_paragraph(item, style='List Bullet')
doc.add_paragraph('技术实现：')
for item in ['前端：HTML、CSS、JavaScript', '小程序框架：微信小程序开发工具', '第三方API：OCR识别或搜题API（如有道智云）', '云开发：云服务、云函数、云数据库']:
    doc.add_paragraph(item, style='List Bullet')

# 1.2 校园小程序
doc.add_heading('1.2 校园小程序', level=2)
doc.add_paragraph('目标用户：学生、教师、学校管理')
doc.add_paragraph('核心功能：')
for item in ['校运会成绩查询', '花园科学浇水', '食物浪费处理', '学习平台']:
    doc.add_paragraph(item, style='List Bullet')
doc.add_paragraph('技术实现：')
for item in ['基于微信小程序或支付宝小程序开发', '集成校园管理API', '云端数据存储']:
    doc.add_paragraph(item, style='List Bullet')

# 1.3 学习平台小程序
doc.add_heading('1.3 学习平台小程序', level=2)
doc.add_paragraph('目标用户：学生、教师')
doc.add_paragraph('核心功能：')
for item in ['在线学习', '作业提交', '试卷管理', '学习进度跟踪']:
    doc.add_paragraph(item, style='List Bullet')
doc.add_paragraph('技术实现：')
for item in ['微信云开发', '云数据库', '服务器端API']:
    doc.add_paragraph(item, style='List Bullet')

# 二、开发经验
doc.add_heading('二、开发经验', level=1)

# 2.1 需求分析阶段
doc.add_heading('2.1 需求分析阶段', level=2)
for item in ['确定目标用户：明确是学生、教师或其他需要服务的用户群体', '统计功能需求：梳理核心功能，如搜题、校园服务、在线学习等', '平台选择：根据目标用户群体选择合适的平台（微信/支付宝）']:
    doc.add_paragraph(item, style='List Bullet')

# 2.2 开发流程
doc.add_heading('2.2 开发流程', level=2)
for i, item in enumerate(['需求调查：确定目标用户和功能需求', '平台选择：选择合适的平台进行开发', '界面设计：设计简洁直观的用户界面', '开发实现：使用前端技术实现各项功能', '测试优化：进行功能测试和性能优化', '上线运行：提交审核并正式发布'], 1):
    doc.add_paragraph(f'{i}. {item}')

# 2.3 测试与优化
doc.add_heading('2.3 测试与优化', level=2)
for item in ['功能测试：确保所有功能正常运行，无明显bug', '性能优化：减少网络请求，使用虚拟列表、分页加载等技术提升效率', '用户体验：注重界面美观、交互流畅、响应迅速']:
    doc.add_paragraph(item, style='List Bullet')

# 三、技术要点
doc.add_heading('三、技术要点', level=1)

# 3.1 微信小程序技术栈
doc.add_heading('3.1 微信小程序技术栈', level=2)
doc.add_paragraph('前端技术：')
for item in ['WXML（类似HTML）：用于页面结构定义', 'WXSS（类似CSS）：用于页面样式设计', 'JavaScript：用于逻辑交互处理']:
    doc.add_paragraph(item, style='List Bullet')
doc.add_paragraph('数据绑定与渲染：')
for item in ['双向数据绑定实现前后端数据同步', '支持列表渲染、条件渲染等指令']:
    doc.add_paragraph(item, style='List Bullet')
doc.add_paragraph('组件化开发：')
for item in ['内置组件（view、scroll-view、swiper等）', '自定义组件封装提升代码复用性']:
    doc.add_paragraph(item, style='List Bullet')
doc.add_paragraph('API调用能力：')
for item in ['调用微信原生能力（用户登录、支付、云开发数据库等）']:
    doc.add_paragraph(item, style='List Bullet')
doc.add_paragraph('性能优化技巧：')
for item in ['减少网络请求次数', '使用虚拟列表、分页加载等技术', '优化图片资源大小']:
    doc.add_paragraph(item, style='List Bullet')

# 3.2 支付宝小程序技术栈
doc.add_heading('3.2 支付宝小程序技术栈', level=2)
doc.add_paragraph('开发流程：')
for i, item in enumerate(['在支付宝开放平台注册并创建小程序，获取小程序ID', '在小程序控制台设置开发环境，配置加签和应用网关', '使用支付宝小程序开发者工具创建项目', '编写前端代码获取授权码和用户ID', '在服务器端编写接口处理授权码，完成业务逻辑'], 1):
    doc.add_paragraph(f'{i}. {item}')
doc.add_paragraph('技术要点：')
for item in ['授权码获取：使用支付宝开放平台提供的API获取用户授权码', '证书配置：使用证书进行接口加签，确保数据安全', 'HTTP请求：使用HTTP请求将授权码发送到服务器端', '错误排查：使用日志和调试工具排查接口调用错误']:
    doc.add_paragraph(item, style='List Bullet')

# 3.3 云开发能力
doc.add_heading('3.3 云开发能力', level=2)
for item in ['微信云开发：云函数、云数据库、云存储', '支付宝云开发：类似微信云开发的后端服务能力', '优势：无需搭建服务器，降低开发成本，快速上线']:
    doc.add_paragraph(item, style='List Bullet')

# 四、学习心得
doc.add_heading('四、学习心得', level=1)

# 4.1 学习路径建议
doc.add_heading('4.1 学习路径建议', level=2)
for item in ['从官方文档入手：熟悉项目结构、配置文件等基础内容', '动手实践优先：使用微信开发者工具或支付宝开发者工具进行实践', '理解"配置即开发"理念：JSON文件承担重要配置角色', '关注云开发能力：使用云开发实现后端服务，减少服务器搭建负担', '参考实战教程：学习实战案例，如尚硅谷微信小程序项目实战教程等']:
    doc.add_paragraph(item, style='List Bullet')

# 4.2 关键经验总结
doc.add_heading('4.2 关键经验总结', level=2)
table = doc.add_table(rows=7, cols=2)
table.style = 'Table Grid'
table.alignment = WD_TABLE_ALIGNMENT.CENTER
hdr_cells = table.rows[0].cells
hdr_cells[0].text = '阶段'
hdr_cells[1].text = '关键要点'
data = [
    ('需求分析', '明确目标用户和功能需求'),
    ('平台选择', '根据用户群体选择微信/支付宝'),
    ('界面设计', '简洁直观，符合平台设计规范'),
    ('代码编写', '组件化开发，注意性能优化'),
    ('测试优化', '功能完整，性能良好，体验流畅'),
    ('上线运行', '提交审核，根据反馈持续迭代'),
]
for i, (stage, key) in enumerate(data, 1):
    row_cells = table.rows[i].cells
    row_cells[0].text = stage
    row_cells[1].text = key

# 4.3 注意事项
doc.add_heading('4.3 注意事项', level=2)
for item in ['用户体验：界面美观、交互流畅、响应迅速是核心要求', '数据安全：保护用户隐私数据，做好安全防护', '持续迭代：根据用户反馈进行持续改进和功能优化', '文档规范：做好开发文档记录，方便后续维护和更新']:
    doc.add_paragraph(item, style='List Bullet')

# 五、总结
doc.add_heading('五、总结', level=1)
doc.add_paragraph('学生制作小程序是一个系统性工程，需要掌握前端开发基础、了解平台API能力、熟悉云开发技术。通过本报告介绍的项目案例、技术要点和学习心得，希望能够帮助学生快速入门小程序开发，并成功完成自己的小程序项目。')

# 报告时间
doc.add_paragraph('')
p = doc.add_paragraph('报告生成时间：2026年4月26日')
p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

# 保存
doc.save(r'C:\Users\admin\Documents\学生制作小程序项目经验报告.docx')
print('Word报告已生成：C:\\Users\\admin\\Documents\\学生制作小程序项目经验报告.docx')
