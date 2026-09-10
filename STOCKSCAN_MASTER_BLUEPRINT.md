# StockScan Master Blueprint
## PT. CHANG PING INDONESIA 扫码实时库存工具
### 产品定义、最终交付、业务规则、真实数据分析、UX 模式、仓储标准、商业化路线、技术架构与开发计划

**Repo 建议：** `stockscan`  
**产品名：** `StockScan`  
**当前版本定位：** Offline-first Real-time Inventory Scanning Desktop App  
**目标设备：** Windows PC + 现有 USB / Bluetooth 扫码枪  
**核心原则：** 下载、安装、双击、选择员工、扫码。员工不需要浏览器地址、localhost、命令行或开发环境。

---

# 0. 2026-09-10 评审结论与本轮调整

## 0.1 总体判断

框架方向是对的：ERP Companion + Offline-first + Baseline / Live Delta + 不可删除的流水账，这四个核心判断都成立，不需要推翻。

本轮补的是"真正上线时会出问题"的地方，按风险排序：

| # | 问题 | 后果 | 调整位置 |
|---|---|---|---|
| 1 | 重新导入 ACCURATE 时，没有定义"哪些 StockScan 交易已经包含在新报表里" | 对账系统性算错；Apply 后可能丢交易 | §19.1、§40 |
| 2 | 扫码枪结尾自带 Enter，与"Enter = Confirm"冲突；数量框有焦点时扫码字符会写进数量 | 误提交、数量错误 | §42.2 |
| 3 | 备份默认在同一台电脑，但文档自己说最大风险是"电脑坏了" | 备份形同虚设 | §39.1 |
| 4 | 语言只考虑中文 / English，客户在印尼 | 员工看不懂、误操作 | §46（已定为三语） |
| 5 | 未签名安装包会触发 SmartScreen；Tauri 依赖 WebView2，离线电脑可能装不上 | "双击就能用"落空 | §56.1 |
| 6 | 箱码 (`unit_multiplier`) 与 CTN 按钮同时生效会重复乘 ISI | 数量放大 60–450 倍 | §15.1 |
| 7 | `sessions.operation_type` 与"Session 内 F1–F4 切换模式"矛盾 | 数据模型和 UI 不一致 | §18.1、§40 |
| 8 | ADJUST 语义没定：是 ±N 还是"改成实盘数量" | 调整记录无法解释 | §67 |
| 9 | Undo 范围没限定（撤谁的、撤多久以前的、能否撤销 reversal） | 审计漏洞 | §31.1 |
| 10 | 主色 `#5B5FEF` 与 SALE 的 Indigo 几乎相同 | 模式识别被削弱 | §45 |

另外两个流程补充：Phase 0.5（界面雏形给客户确认）和 Phase 8（并行试运行），见 §61。

## 0.2 决策状态

| 事项 | 状态 |
|---|---|
| 负库存：允许但警告 | 已确认 |
| 临时箱子 / 桌边移动不记库存 | 已确认 |
| ISI = 每箱件数、KOLI = 库存 ÷ ISI | 高置信假设，待客户确认 |
| HARGA 含义 | 待确认 |
| 是否有 Barcode Master | 待确认（没有则 Barcode Setup 进入 MVP） |
| 单机 vs 多机 | 待确认（决定是否继续 SQLite 单机架构） |
| 损坏退货是否进 Gudang Rusak | 待确认 |
| 界面语言：English / 中文 / Bahasa Indonesia 三语 | 已确定（2026-09-10），印尼语用词待员工过目 |
| 新 ACCURATE 报表是否已包含 StockScan 同步过的交易 | 本轮新增，待确认 |
| 交易同步状态 LOCAL / EXPORTED / SYNCED，对账只算已录进 ACCURATE 的部分（§19.1） | 已确定（2026-09-10）；同步节奏待客户回答 |
| 扫码枪输入按字符速度识别，扫码带来的 Enter 不算确认（§42.2） | 已确定（2026-09-10） |
| 第二备份位置 + 超过 2 天未备份提醒（§39.1） | 已确定（2026-09-10） |

## 0.3 客户确认用的界面雏形

9 个桌面画面（1440×900），英文版分三页，另有一页是全部画面的印尼语版，每页附带要客户确认的问题：

```text
Daily scanning       选员工 / 扫描-售出 / 未知条码 / 库存不足警告
Inventory & history  库存列表 + 商品侧栏 / 操作记录（Undo = reversal）
Data & setup         导入 ACCURATE 报表 / 条码绑定 / 新报表对账
Bahasa Indonesia     以上 9 个画面的印尼语版
```

在线查看：https://claude.ai/code/artifact/2d8700f2-7ca8-43f5-bc77-235632e1242f  
源文件：`design/mockups/*.dc.html`

雏形相对 §27 的调整：

- Scan 页面改成左右两栏：左边是模式、商品和数量，右边常驻本 Session 最近操作和快捷键，员工确认后不用切页面就能核对
- Session 栏不显示模式（§18.1）
- 库存数字同时显示 `X ctn + Y pcs`（§15.1）
- 导航和主按钮用中性深色，彩色只留给四个模式和警告（§45）
- 商品侧栏直接标出数据来源 Imported / Recorded / Calculated / Derived（落实 §66）

画面中 CK-EM296、CK-EM196、SM-K805 的数字来自 EMERGENCY 报表，其余商品、条码和数量是示例数据。

---

# 1. 最终我们到底要做什么

StockScan 第一版不是：

- 新 ERP
- 新 ACCURATE
- 完整 WMS
- 电商后台
- POS 收银系统
- 云平台
- 小程序
- 普通 Excel 表格
- 需要员工输入 localhost 的网页

StockScan 第一版应该是：

> **一个安装在 Windows 电脑上的轻量实时扫码库存工作台。**

它位于工作人员和现有 ACCURATE 库存平台之间，用于解决现有流程中最明显的问题：

```text
现有 ACCURATE
库存数据存在
但扫码器和实时库存操作没有形成一个快速闭环
        ↓
StockScan
        ↓
员工扫码
选择进货 / 售出 / 退货 / 调整
输入数量
立即更新本地库存
自动记录操作人和操作历史
        ↓
需要时导出 Excel / CSV
        ↓
人工同步回 ACCURATE
```

第一版最重要的价值不是“功能多”，而是：

1. 扫得快
2. 当前数量马上变化
3. 同款多个商品不用扫很多遍
4. 谁操作的可以查
5. 扫错可以撤销
6. 不联网也能工作
7. 原来的 Excel / ACCURATE 继续保留
8. 后续如果客户认可，再升级成和 ACCURATE 或其他平台的正式集成层

---

# 2. 最终交付形式

## 2.1 给普通员工

最终最理想的交付物是：

```text
StockScan_Setup.exe
```

员工使用过程：

```text
第一次：
双击 StockScan_Setup.exe
→ 安装
→ 桌面出现 StockScan 图标

以后每天：
双击 StockScan
→ 选择自己的姓名 / 工号
→ 自动进入 Scan 页面
→ 选择 Sale / Stock In / Return
→ 扫码
→ 输入数量
→ 完成
```

不应该要求员工：

```text
npm install
npm run dev
python app.py
localhost:3000
localhost:xxxx
输入 IP
打开 terminal
配置数据库
安装 Node
安装 Python
```

这些全部是开发者内部内容。

## 2.2 推荐 Windows 打包方式

推荐：

```text
Tauri 2
+ React
+ TypeScript
+ SQLite
```

Windows 交付：

```text
StockScan_Setup_x64.exe
```

可以同时保留开发人员内部 build artifact，但客户日常只需要安装程序和桌面快捷方式。

## 2.3 本地数据

建议默认保存在应用数据目录，不让员工手动管理数据库文件。

逻辑上：

```text
StockScan App
   │
   ├── stockscan.db
   ├── backups/
   ├── exports/
   └── logs/
```

界面中提供：

```text
Backup
Restore
Export
```

不要求用户自己进入数据库目录。

---

# 3. 真实客户环境分析

目前已经看到三类重要证据：

1. `stock gs8 09.09.2026.xls`
2. `EMERGENCY.pdf`
3. 客户提供的 ACCURATE 5 系统截图

这些信息比最开始的口头描述更重要，因为它们已经暴露出客户真实的数据结构。

---

# 4. `stock gs8 09.09.2026.xls` 的核心结论

这份文件不是一个干净的 Product Master 表。

它属于 ACCURATE Accounting System 的库存数量报表。

已观察到类似字段：

```text
Deskripsi Barang
ISI
GS 8A NO 21
KOLI
```

最合理的业务解释是：

| 原字段 | 含义 | StockScan |
|---|---|---|
| Deskripsi Barang | 商品描述 | product_name |
| ISI | 每箱 / 包装内件数 | pack_size |
| GS 8A NO 21 | 当前该仓库库存件数 | current_stock |
| KOLI | 折算箱数 | carton_equivalent |

已有样本呈现非常强的一致关系：

```text
KOLI ≈ Current Stock / ISI
```

因此 StockScan 不应该把 KOLI 当成第二套独立库存维护。

建议：

```text
current_stock = 280
pack_size = 80

carton_equivalent = 280 / 80 = 3.50
```

界面显示：

```text
280 pcs
3.50 cartons
```

但真正库存 source of truth 是：

```text
current_stock
```

---

# 5. EMERGENCY.pdf 新增了什么信息

`EMERGENCY.pdf` 同样来自：

```text
PT. CHANG PING INDONESIA
Kuantitas Barang GS 8 No.21
ACCURATE Accounting System Report
```

报表字段是：

```text
Deskripsi Barang
ISI
GS 8A NO 21
KOLI
HARGA
```

例如：

```text
EMERGENCY LAMP KISEKI CK-EM296
ISI       100
GS8       50
KOLI      0.50
HARGA     32,500

EMERGENCY LAMP KISEKI CK-EM196
ISI       100
GS8       4,697
KOLI      46.97
HARGA     36,500

EMERGENCY LAMP SMARTSONIC SM-K805
ISI       450
GS8       4,992
KOLI      11.09
HARGA     12,500
```

再次验证：

```text
4697 / 100 = 46.97
4992 / 450 ≈ 11.09
```

所以 `ISI + KOLI` 的解释基本可以作为高置信度假设，但在客户确认前仍标记为：

```text
Pending business confirmation
```

## 5.1 HARGA

`HARGA` 很可能是价格字段。

但第一版不要把 StockScan 做成 POS。

建议数据模型保留：

```text
reference_price
currency
```

但：

- 不要求销售必须计算金额
- 不自动做收入报表
- 不做发票
- 不做客户订单
- 不把 HARGA 作为 StockScan 核心逻辑

客户只需要库存工具时，价格作为辅助商品识别信息即可。

后续如果明确要做销售金额分析，再扩展。

---

# 6. 一个必须注意的数据日期问题

EMERGENCY 报表显示：

```text
Per Tgl. 18 Sep 2026
```

但页面底部又显示打印时间：

```text
Cetak di 09 Sep 2026 - 15.53
```

也就是说：

```text
Report As-Of Date
和
Printed At
```

不是同一个概念，而且样本里甚至出现“报表日期晚于打印日期”的情况。

因此导入器不能简单写：

```text
import_date = report_date
```

建议分别保存：

```text
report_as_of_date
report_printed_at
imported_at
```

并加入数据验证：

```text
如果 report_as_of_date 明显晚于 imported_at：
显示提示
但允许继续
```

例如：

```text
Report date appears to be later than the import date.
Please confirm the report period before importing.
```

这也是为什么 StockScan 的导入流程需要 Preview，而不能做到“选文件立即无脑覆盖”。

---

# 7. ACCURATE 5 截图带来的更重要结论：公司存在多个正式库存位置

客户截图中可以看到多种库存相关报表，例如：

```text
Kuantitas Barang GS 8 No.21
Kuantitas Barang Gudang Rusak
Kuantitas Barang per Daftar Gudang
Kuantitas Barang per Daftar Gudang GS8 No.21
Kuantitas Barang per Daftar Gudang Online
```

另一张报表明确显示：

```text
Kuantitas Barang per Daftar Gudang Online
```

库存列：

```text
GD ONLINE
```

这说明 ACCURATE 中“仓库 / 正式库存位置”是现实存在的业务维度。

这与之前确认的：

```text
仓库拿一些商品到箱子里
不算库存变化
```

并不冲突。

应该区分两个概念。

## 7.1 不需要记录的内部临时移动

```text
GS8 仓库
→ 临时箱子
→ 桌边
→ 销售区
```

如果客户明确说这些不算库存变化：

```text
不记录 transfer
```

## 7.2 需要在数据模型中预留的正式库存位置

例如：

```text
GS 8A NO 21
GD ONLINE
Gudang Rusak
```

这些属于 ACCURATE 中正式的仓库/location。

因此新版数据模型建议从第一天就保留：

```text
location_id
```

但是 MVP UI 可以保持非常简单。

例如首次设置：

```text
Active Warehouse
当前仓库

GS 8A NO 21
```

之后普通员工无需每次选择。

这样不会增加日常操作复杂度，同时避免未来数据库大改。

---

# 8. 退货问题因为 `Gudang Rusak` 变得更值得确认

ACCURATE 报表列表中出现：

```text
Gudang Rusak
```

可理解为损坏品仓库 / damaged goods warehouse。

所以：

```text
Return = +N
```

不应永久写死成所有退货都回到可售库存。

第一版可以先保持：

```text
Return → Active Warehouse +N
```

但应预留：

```text
return_disposition
```

以后可以支持：

```text
Sellable
Damaged
Quarantine
Other
```

如果客户确认损坏退货需要进入 `Gudang Rusak`，可以扩展成：

```text
Return
├── Sellable → GS 8A NO 21 +N
└── Damaged  → Gudang Rusak +N
```

如果客户暂时不需要，就不把这个选择放在主 Scan 页面。

---

# 9. 最大的数据问题仍然是 Barcode

目前看到的库存报表都没有明确的：

```text
Barcode
EAN
UPC
GTIN
```

字段。

商品名中出现：

```text
CK-EM296
CK-EM838
CK-K837PB
SM-K808
```

这些更像：

```text
型号 / Item Code / Model Code
```

不能自动假设是扫码枪读取的条码。

因此 StockScan 必须把：

```text
Product
```

与：

```text
Identifier / Barcode
```

分开。

---

# 10. 正确的 Barcode 数据模型

不要设计：

```text
products.barcode
```

然后强制一个产品只有一个码。

建议：

```text
Product
   │
   └── Identifiers
       ├── EAN / UPC / GTIN
       ├── Internal barcode
       ├── Alternate barcode
       ├── Carton barcode
       └── Serial code
```

表：

```text
identifiers
-----------
id
product_id
code
identifier_type
unit_multiplier
is_active
```

`unit_multiplier` 是一个非常有价值的未来字段。

例如：

```text
单件条码
code = 123456
unit_multiplier = 1

整箱条码
code = 888888
unit_multiplier = 60
```

如果客户未来真的存在“箱码”，扫描整箱可以自动：

```text
Qty = 60
```

这比写死 barcode 更符合仓储系统设计。

---

# 11. 如果客户没有 Barcode Master

首选仍然是问：

> ACCURATE 或其他系统能不能导出一份“Barcode + 商品”的对应表？

如果有：

```text
Stock Report
+
Barcode Master
        ↓
StockScan
```

如果没有：

StockScan 加：

```text
Barcode Setup
条码绑定
```

流程：

```text
搜索商品
→ 选择商品
→ 扫实物条码
→ Link
```

例如：

```text
Product
EMERGENCY LAMP KISEKI CK-EM296

Scan barcode:
6914791234567

[Link Barcode]
```

以后：

```text
6914791234567
        ↓
CK-EM296
```

---

# 12. Unknown Barcode 的正式处理

日常 Sale / Stock In 页面中，如果扫到未知条码：

```text
Barcode not found
未找到条码

6914791234567

No inventory has been changed.
库存没有发生变化。
```

按钮：

```text
[Scan Again]
[Cancel]
[Barcode Setup]
```

普通扫描流程：

**不要自动创建商品。**

原因：

1. ACCURATE 中商品理论上已经存在
2. 扫错码可能产生脏数据
3. 商品名称 / ISI / 价格等信息不应该由普通员工临时乱填
4. Product Master 与 Barcode Mapping 是两个不同动作

---

# 13. 核心库存运算模型

最稳定的模型是：

```text
Current Stock
=
Imported Baseline
+
Sum(StockScan Transactions)
```

例如：

```text
ACCURATE 导入：
CK-EM296 = 50
```

StockScan 当天：

```text
Sale       -3
Return     +1
Stock In  +20
Sale       -5
```

则：

```text
50 - 3 + 1 + 20 - 5 = 63
```

StockScan 当前显示：

```text
63
```

这个模式特别适合“现有平台不实时，但 StockScan 需要实时”的场景。

---

# 14. 一个非常值得做的新颖元素：Baseline + Live Delta

这是 StockScan 与普通 Excel 最大的差异之一。

商品详情不要只显示：

```text
Current Stock
63
```

可以显示：

```text
ACCURATE Baseline      50
StockScan Live Delta  +13
Current Stock          63
```

或者：

```text
50  + 13  =  63
↑      ↑      ↑
Base  Live   Now
```

价值：

1. 员工知道为什么 StockScan 和老系统数字不一样
2. 管理员可以快速解释差异
3. 后续同步 ACCURATE 非常容易
4. 临时台账不会变成“不知道这个数从哪来的第二套库存”

建议称：

```text
Live Delta
实时变动
```

这是非常适合当前客户场景的产品化特征。

---

# 15. 第二个新颖元素：Unit / Carton 智能数量输入

客户数据已经天然包含：

```text
ISI
KOLI
```

所以 StockScan 不应该只做：

```text
Qty [ - ] 3 [ + ]
```

更适合仓库人员的 UI：

```text
Quantity

[ Units ] [ Cartons ]

Cartons:  2
Units:    3

ISI: 60 pcs/carton

Total:
123 pcs
```

计算：

```text
2 × 60 + 3 = 123
```

然后：

```text
Sale -123
```

或者简单模式：

```text
[PCS 件] [CTN 箱]

Qty: 2 cartons
= 120 pcs
```

这个设计的优点：

- 和客户现有 `ISI / KOLI` 数据结构天然一致
- 仓库工作人员经常按箱思考
- 不需要扫同一个商品几十次
- 比普通扫码库存 App 更贴近真实操作

## MVP 建议

第一版 UI 可以做：

```text
Qty [ - ] 1 [ + ]

[按件 PCS] [按箱 CTN]
```

当选择 CTN：

```text
Qty 2
ISI 60
Actual change 120 pcs
```

如果客户说他们从不按箱操作，可以隐藏 CTN 模式。

## 15.1 箱数显示与箱码规则（2026-09-10 补充）

KOLI 的小数对仓库人员不直观：

```text
4992 / 450 = 11.09 KOLI
```

员工真正需要的是：

```text
11 ctn + 42 pcs
```

建议：

- Inventory 表格和导出保留 `carton_equivalent`（两位小数，和 ACCURATE 的 KOLI 对得上）
- Scan 页面和商品侧栏显示 `X ctn + Y pcs`

箱码与 CTN 按钮不能叠加：

```text
扫到 unit_multiplier = 60 的箱码
→ 自动切到 CTN，Qty = 1，实际 60 pcs
→ PCS / CTN 切换锁定
```

否则会出现"箱码 × CTN × ISI"的重复放大。

另外：

- ISI 为空、0 或非整数时禁用 CTN，并进 Exception 提示
- 每笔交易保存当时的 `unit_multiplier`，以后 ISI 被新报表修改，历史记录不受影响

---

# 16. 第三个新颖元素：Mode-first 扫描

最大风险不是扫码失败，而是：

> 员工在错误模式下连续扫了很多商品。

所以当前操作类型必须是主视觉，不应该只是一个小 dropdown。

顶部固定：

```text
CURRENT MODE

[ STOCK IN ]
[ SALE     ]
[ RETURN   ]
[ ADJUST   ]
```

选中 Sale：

```text
SALE / 售出
- Quantity
```

选中 Stock In：

```text
STOCK IN / 进货
+ Quantity
```

整个 Scan Card 同时显示：

```text
SALE
-3

280 → 277
```

不能只通过颜色区分。

必须：

```text
文字
图标
+ / -
状态色
```

一起表达。

---

# 17. 第四个新颖元素：Scanner Pulse

扫描以后不要只在表格增加一行。

主页面短暂给一个非常明确的反馈：

```text
✓ FOUND

EMERGENCY LAMP KISEKI
CK-EM296

Stock
50 → 47

SALE -3
```

然后 0.8 到 1.2 秒后缩进 Recent Activity。

音效：

```text
成功：短 beep
未知码：双 beep / warning
负库存：warning sound
```

工作人员不用一直盯着屏幕，也能确认扫描是否成功。

---

# 18. 第五个新颖元素：Session

员工一次工作通常不是孤立一个 scan。

可以自然形成：

```text
Session #042
Operator: Alex #1024
Mode: SALE
Started: 14:22
```

Session 内：

```text
12 transactions
31 units
5 products
Net stock change: -31
```

好处：

- 一箱货 / 一轮操作可以被整体追踪
- 容易导出
- 容易回看
- 容易发现“下午那一批哪里不对”
- 后续做 reconciliation 时有上下文

Session 不需要变成订单系统。

它只是操作分组。

## 18.1 Session 不绑定模式（2026-09-10 调整）

员工在一轮操作里会用 F1–F4 切换模式，所以：

```text
operation_type 记在每一笔 transaction 上
session 不记 operation_type
```

Session 规则：

- 选择员工后第一次扫码自动开始
- 切换员工、点 Finish Session、或空闲超过设定时间（例如 30 分钟）自动结束
- Session 汇总按模式分开显示，例如 `Sale −31 / Stock In +120`

---

# 19. 第六个新颖元素：Reconcile Mode

这是 StockScan 很有商业化潜力的部分。

例如：

9 月 9 日从 ACCURATE 导入：

```text
Product A = 280
```

StockScan 之后记录：

```text
Live Delta = -34
```

StockScan 预期：

```text
246
```

后来客户重新从 ACCURATE 导出：

```text
ACCURATE New Snapshot = 248
```

Reconcile 页面显示：

```text
Product A

Previous Baseline        280
StockScan Delta          -34
Expected                 246

New ACCURATE Snapshot    248

Difference                +2
```

状态：

```text
Needs Review
```

这比“直接重新导入然后覆盖”安全很多。

## Reconcile 原则

绝不：

```text
Import new Excel
→ silently overwrite StockScan
```

而是：

```text
Import
→ Compare
→ Difference Preview
→ Review
→ Choose action
```

这是从“临时工具”走向“可商业化库存辅助系统”的关键能力。

## 19.1 对账必须知道"哪些交易已经进了 ACCURATE"（2026-09-10 补充）

上面的例子隐含一个假设：新的 ACCURATE 报表完全没有包含 StockScan 的交易。

实际流程却是：

```text
StockScan 导出交易
→ 人工录入 ACCURATE
→ 过几天再从 ACCURATE 导出新报表
```

新报表里已经有一部分 StockScan 交易，另一部分还没录。直接用 `Previous Baseline + 全部 Live Delta` 比较，会把"还没录入"误报成差异；Apply 以后如果把 Live Delta 清零，还会把没录入的交易直接丢掉。

因此每笔交易需要同步状态：

```text
LOCAL       只在 StockScan
EXPORTED    已导出（export_batch_id）
SYNCED      管理员确认该批次已录入 ACCURATE（synced_at）
```

对账时：

```text
Expected ACCURATE
= Previous Baseline
+ Σ 已包含在新报表里的 StockScan 交易（SYNCED 且 synced_at ≤ report_as_of）

Difference = New ACCURATE − Expected
```

这样 Difference 只剩真正的问题：有人直接在 ACCURATE 改了库存、录入错误、或 StockScan 漏记。

Apply 新 baseline 以后：

```text
New Baseline = New ACCURATE
Live Delta   = Σ 还没包含在新报表里的交易
Current      = New Baseline + Live Delta
```

除了管理员对差异选了"Use ACCURATE"的商品，其余商品的 Current 在 Apply 前后必须不变。这是 Reconcile 的核心校验，写成自动测试。

需要客户确认：

1. StockScan 导出后，多久、由谁录入 ACCURATE？
2. `Per Tgl.` 只有日期没有时间，默认按当天结束处理，导入时允许管理员修改。

---

# 20. 第七个新颖元素：Barcode Coverage

导入 ACCURATE 后，可以直接显示：

```text
Products Imported       1,284
Barcode Linked            932
Unlinked                  352
Coverage                 72.6%
```

并提供：

```text
[Continue Pairing]
```

这能非常清楚地告诉管理员：

> 还有多少商品不能通过扫码识别。

对于首次部署非常实用。

---

# 21. 第八个新颖元素：Exception Inbox

不要让异常散落在各个页面。

右上角：

```text
⚠ Exceptions  5
```

里面汇总：

```text
Unknown barcode               2
Negative stock transaction    1
Import date warning           1
Reconciliation difference     1
```

这既不会影响普通员工扫货，又让管理员知道哪些问题需要处理。

商业版尤其值得保留。

---

# 22. 第九个新颖元素：Quick Scan 与 Quantity Scan 两种工作模式

日常可能存在两种极端：

## Quick Scan

适合：

```text
每次基本都是 1 件
```

设置：

```text
Quick Scan ON
```

流程：

```text
扫
→ 自动 Qty 1
→ 立即保存
→ beep
→ 等下一个
```

## Quantity Scan

适合：

```text
同款一次卖 / 进很多
```

流程：

```text
扫
→ Product Card
→ Qty / Carton
→ Confirm
```

建议第一版：

```text
默认 Quantity Scan
```

稳定后再加 Quick Scan 开关。

这样不会一开始因为“扫完直接扣库存”造成误操作。

---

# 23. 第十个模式：Cycle Count / Stocktake

这个不是最初 MVP 必须项，但如果考虑商业化，非常值得作为 Phase 1.5。

专业仓储系统经常需要：

```text
Cycle Counting
盘点
```

模式：

```text
Count Mode
盘点模式
```

工作人员：

```text
选择仓库
→ 扫商品
→ 输入实际数量
→ 系统比较 Expected vs Counted
```

更专业的做法可以做：

```text
Blind Count
```

也就是盘点时暂时隐藏系统预期数量，减少工作人员受到已有数字影响。

例如：

```text
Counted: 247

提交后：

Expected: 246
Difference: +1
```

差异进入：

```text
Pending Review
```

而不是普通员工直接修改库存。

这是比较标准的仓储库存控制思路。

---

# 24. UI 最终产品结构

第一版主导航控制在 4 个：

```text
Scan
扫描

Inventory
库存

History
记录

Data
数据
```

右上角：

```text
Active Warehouse
Operator
Language
Exceptions
Settings
```

设置中的二级功能：

```text
Barcode Setup
Employees
Backup
Preferences
```

不要做一个左侧十几项的 ERP Sidebar。

---

# 25. 启动流程

```text
StockScan
   ↓
First Run?
   │
   ├── Yes
   │    ↓
   │   Setup Wizard
   │    ├── Language
   │    ├── Company
   │    ├── Active Warehouse
   │    ├── Import ACCURATE XLS
   │    ├── Add Operators
   │    └── Barcode Mapping
   │
   └── No
        ↓
      Select Operator
        ↓
      Scan
```

首次设置完成后，不再每天出现复杂 Wizard。

---

# 26. First Run Setup Wizard

## Step 1

```text
Welcome to StockScan
欢迎使用 StockScan
```

选择：

```text
中文
English
Bahasa Indonesia
```

## Step 2

```text
Company
PT. CHANG PING INDONESIA
```

## Step 3

```text
Active Warehouse
当前仓库

GS 8A NO 21
```

或者从导入文件中识别。

## Step 4

```text
Import Stock Baseline
导入初始库存

stock gs8 09.09.2026.xls
```

## Step 5

Preview：

```text
Products       1,2xx
Stock Column   GS 8A NO 21
Pack Size      ISI
Price          HARGA
```

## Step 6

Operators：

```text
Employee ID
Name
```

## Step 7

Barcode：

```text
Import Barcode Master
or
Pair Later
```

完成：

```text
StockScan is ready.
```

---

# 27. Scan 页面推荐布局

```text
┌─────────────────────────────────────────────────────────────┐
│ StockScan   Scan Inventory History Data                     │
│              GS 8A NO 21       Alex #1024      中文         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ CURRENT MODE / 当前模式                                     │
│                                                             │
│ [ STOCK IN ]   [ SALE ]   [ RETURN ]   [ ADJUST ]           │
│                  ACTIVE                                     │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                     SCAN                                │ │
│ │                                                         │ │
│ │              Waiting for scanner...                    │ │
│ │              等待扫描                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ EMERGENCY LAMP KISEKI CK-EM296                             │
│ Barcode: 6914791234567                                     │
│                                                             │
│ STOCK                                                       │
│ Baseline    50          Live Delta   -4                     │
│ Current     46                                             │
│                                                             │
│ PACK                                                        │
│ ISI 100 pcs/carton                                         │
│                                                             │
│ [ PCS 件 ] [ CTN 箱 ]                                      │
│                                                             │
│ Quantity                                                    │
│                 [ - ]    3    [ + ]                        │
│                                                             │
│ Result                                                      │
│                   46 → 43                                  │
│                   SALE -3                                  │
│                                                             │
│                [ Confirm Sale ]                            │
├─────────────────────────────────────────────────────────────┤
│ Session #042 | 12 tx | 31 pcs | Net -31                   │
│                              Undo Last   Finish Session     │
└─────────────────────────────────────────────────────────────┘
```

---

# 28. Inventory 页面

建议列：

```text
Product
Model / Code
Barcode Status
Pack Size
Current Stock
Carton Eq.
Reference Price
Last Updated
```

例如：

| Product | Barcode | ISI | Stock | Cartons | Price |
|---|---|---:|---:|---:|---:|
| CK-EM296 | Linked | 100 | 50 | 0.50 | 32,500 |
| CK-EM196 | Linked | 100 | 4,697 | 46.97 | 36,500 |
| SM-K805 | Unlinked | 450 | 4,992 | 11.09 | 12,500 |

Filter：

```text
All
Barcode Unlinked
Negative Stock
Zero Stock
Recently Changed
Exceptions
```

Search：

```text
商品名
型号
Barcode
```

---

# 29. Product Drawer

点击商品不跳一个复杂页面。

右侧 Drawer：

```text
EMERGENCY LAMP KISEKI CK-EM296

Model
CK-EM296

Warehouse
GS 8A NO 21

Barcode
6914791234567

Current Stock
50 pcs

Pack Size
100 pcs / carton

Equivalent
0.50 carton

Reference Price
Rp 32,500

---------------------

Baseline
50

Live Delta
0

---------------------

Recent Activity
```

操作：

```text
Adjust Stock
Manage Barcode
View History
```

---

# 30. History 页面

每个库存变化都需要完整可追踪。

字段：

```text
Time
Operator
Warehouse
Product
Identifier
Action
Quantity
Unit
Actual Unit Change
Before
After
Session
Warning
Status
```

例如：

```text
2026-09-10 15:42:31
Alex #1024
GS 8A NO 21
CK-EM296
SALE
Qty 3 pcs
Change -3
50 → 47
Session #042
```

如果按 2 箱：

```text
Qty 2 CTN
ISI 100
Change -200 pcs
```

---

# 31. Undo 不能 Delete

错误交易：

```text
SALE -3
50 → 47
```

员工按 Undo。

数据库不要删除原记录。

新增：

```text
REVERSAL +3
47 → 50
reverses_transaction_id = original_id
```

这样 Audit Trail 完整。

UI 仍然可以写：

```text
Undo
撤销
```

但数据层必须是 reversal。

## 31.1 Undo 的范围（2026-09-10 补充）

- 普通员工只能撤销**自己当前 Session** 的交易，按时间倒序逐笔撤销
- 超出当前 Session 的更正走 ADJUST（需要 Reason，后续需要管理员 PIN）
- REVERSAL 本身不能再被撤销；撤错了就重新做一笔正常交易
- 已经 EXPORTED / SYNCED（§19.1）的交易，Undo 时提示"这笔已经导出给 ACCURATE，撤销后需要在下次导出中一并更正"

---

# 32. Negative Stock

已确定：

> 允许，但警告。

例如：

```text
Current Stock   2
Sale            5
After          -3
```

显示：

```text
⚠ Insufficient recorded stock
库存不足

Current stock: 2
Sale quantity: 5
Result: -3

[Cancel]
[Continue Sale]
```

如果继续：

```text
warning_acknowledged = true
```

并进入 Exception Inbox。

不能因为台账滞后而让现场完全无法继续操作。

---

# 33. Operator 模式

不要做 Email + Password。

启动：

```text
Select Operator
选择操作员工

[ Search name / employee ID ]
```

例如：

```text
1024 Alex
1031 Amy
1068 John
```

点一下进入。

主页面：

```text
Alex · #1024
```

下拉：

```text
Switch Operator
```

如果后续需要管理权限，再给管理员增加：

```text
PIN
```

普通员工继续无密码。

---

# 34. Excel / ACCURATE Import 需要重新设计

客户的文件属于格式化 Report，不是普通数据库表。

所以不要假设：

```text
Row 1 = headers
Row 2 = data
```

正确：

```text
Choose File
→ Detect Report
→ Read metadata
→ Find table headings
→ Detect stock column
→ Preview
→ Confirm
→ Import
```

已知可用于检测：

```text
Deskripsi Barang
ISI
KOLI
```

库存列可能动态变化：

```text
GS 8A NO 21
GD ONLINE
其他正式仓库名
```

因此不能数据库硬编码：

```text
gs_8a_no_21
```

应该：

```text
location.name = "GS 8A NO 21"
inventory.location_id = ...
```

---

# 35. Excel Import Preview

例如：

```text
Import ACCURATE Stock Report

File
stock gs8 09.09.2026.xls

Detected
Company        PT. CHANG PING INDONESIA
Warehouse      GS 8A NO 21
Report Date    09 Sep 2026
Products       1,284

Mappings
Deskripsi Barang → Product
ISI              → Pack Size
GS 8A NO 21      → Stock
KOLI             → Derived cartons
HARGA            → Reference Price
```

警告：

```text
No barcode column found.
352 / 1,284 products currently have no barcode mapping.
```

按钮：

```text
[Cancel]
[Import Baseline]
```

---

# 36. 不要把重新 Import 等同于覆盖

第一天：

```text
Baseline 100
```

StockScan 运行：

```text
-20
Current 80
```

第二天用户又导入一个 ACCURATE：

```text
100
```

StockScan 不能直接：

```text
80 → 100
```

这会抹掉 StockScan 的实时历史。

应该进入：

```text
Reconciliation
```

或者明确：

```text
Replace Baseline
```

并且要求：

```text
Preview
Difference
Confirmation
Audit
```

---

# 37. Data 页面

保持 5 个主要操作：

```text
Import Stock Report
导入库存报表

Import Barcode Mapping
导入条码对应表

Reconcile New Snapshot
核对新库存报表

Export Current Stock
导出当前库存

Export Transactions
导出操作记录
```

下方：

```text
Backup
Restore
```

---

# 38. Export 建议

## Current Stock

字段建议：

```text
Warehouse
Product
Product Code
Barcode
Pack Size
Current Stock
Carton Equivalent
Reference Price
Last Updated
```

## Transactions

```text
Transaction ID
Time
Operator ID
Operator Name
Warehouse
Product
Barcode
Action
Qty Input
Input UOM
Unit Multiplier
Quantity Change
Stock Before
Stock After
Session
Warning
Reversal Of
```

导出格式：

```text
.xlsx
.csv
```

客户如果提供 ACCURATE 固定 Import Template，再增加：

```text
Export for ACCURATE
```

---

# 39. 自动备份

离线工具最大风险：

> 电脑坏了，而不是服务器挂了。

建议：

```text
每天第一次启动自动备份
更换 Baseline 前自动备份
手动 Backup
手动 Restore
```

建议保留：

```text
14 个 daily backup
```

或者：

```text
最近 14 天
```

如果数据库正在打开，不要简单复制一个可能未 flush 的 SQLite 文件。

建议使用 SQLite backup API 或安全 snapshot 方式。

## 39.1 备份不能只放在同一块硬盘上（2026-09-10 补充）

上面说最大风险是"电脑坏了"，但 `backups/` 默认在同一台电脑的应用数据目录里。硬盘坏、电脑被偷、系统重装时，备份和数据库一起没了。

建议：

- 设置里增加"第二备份位置"：U 盘、共享文件夹、或同步盘的本地文件夹（OneDrive / Google Drive）
- 每日自动备份同时写一份到第二位置；第二位置不可用时，顶部显示提醒
- 选员工页面显示"上次备份时间"，超过 2 天显示警告
- Restore 前自动再备份一次当前数据库，恢复错了还能回去
- 网盘只用它的本地同步文件夹：StockScan 不直接调用网盘 API、不保存任何账号 token，所以没有 token 过期 / refresh 要处理
- 但网盘客户端自己登录过期时，文件照样写进本地文件夹，只是不会上传，StockScan 察觉不到。交付说明里写清楚：每月在网盘网页端看一眼最新备份的日期

---

# 40. 数据库架构 v3

## companies

```text
companies
---------
id
name
created_at
```

虽然第一版只有一家，也可以极简保留 company config。

---

## locations

```text
locations
---------
id
company_id
code
name
location_type
is_active
created_at
updated_at
```

例如：

```text
GS8-21
GS 8A NO 21
WAREHOUSE

ONLINE
GD ONLINE
WAREHOUSE

DAMAGED
Gudang Rusak
DAMAGED
```

MVP 可以只激活一个。

---

## products

```text
products
--------
id
company_id
name
product_code
pack_size
reference_price
currency
is_active
created_at
updated_at
```

注意：

**不要把 current_stock 放 products。**

因为现在已经确认正式 warehouse/location 是业务维度。

---

## inventory_balances

```text
inventory_balances
------------------
id
location_id
product_id
baseline_quantity
live_delta
current_quantity
baseline_import_id
updated_at
```

逻辑：

```text
current_quantity
=
baseline_quantity
+
live_delta
```

实际实现时也可以只存：

```text
baseline_quantity
current_quantity
```

然后 live_delta 计算。

但从产品解释角度：

```text
baseline + delta
```

非常重要。

---

## identifiers

```text
identifiers
-----------
id
product_id
code
identifier_type
unit_multiplier
is_active
created_at
```

Barcode 永远：

```text
TEXT
```

不存 INTEGER。

同一公司内，`is_active = 1` 的 `code` 必须唯一（partial unique index）。扫到重复条码时不猜，直接进入 `DUPLICATE_BARCODE` 异常。

---

## employees

```text
employees
---------
id
employee_code
name
role
pin_hash
is_active
created_at
updated_at
```

MVP：

```text
role = OPERATOR
pin_hash = NULL
```

为后续管理员 PIN 留接口。

---

## sessions

```text
sessions
--------
id
session_number
location_id
operator_id
status
started_at
completed_at
notes
```

`operation_type` 不放在 session 上，见 §18.1。

---

## transactions

```text
transactions
------------
id
session_id
location_id
product_id
identifier_code
operation_type

input_quantity
input_uom
unit_multiplier
quantity_change

stock_before
stock_after

operator_id

negative_stock_warning
warning_acknowledged

return_disposition

reverses_transaction_id

source
notes
reason_code            -- ADJUSTMENT 必填，见 §67

client_txn_id          -- 前端生成的 UUID，防止重复提交（唯一）
sync_status            -- LOCAL / EXPORTED / SYNCED，见 §19.1
export_batch_id
synced_at

created_at             -- 存 UTC，界面按 WIB (UTC+7) 显示
```

operation：

```text
BASELINE_IMPORT
STOCK_IN
SALE
RETURN
ADJUSTMENT
REVERSAL
RECONCILIATION_ADJUSTMENT
```

---

## imports

```text
imports
-------
id
filename
source_system
source_report_name
company_name
report_as_of_date
report_printed_at
source_location_name
imported_by
imported_at
row_count
status
notes
```

---

## barcode_pairing_events

可选，但商业版很有价值：

```text
barcode_pairing_events
----------------------
id
product_id
identifier_id
operator_id
action
created_at
```

记录：

```text
linked
changed
disabled
```

---

## export_batches（2026-09-10 新增）

```text
export_batches
--------------
id
export_type            -- STOCK / TRANSACTIONS / ACCURATE_TEMPLATE
file_name
from_time
to_time
row_count
exported_by
exported_at
synced_confirmed_by
synced_at
```

管理员在 ACCURATE 录入完成后，把批次标记为 Synced。对账依赖这个状态（§19.1）。

---

## exceptions

```text
exceptions
----------
id
type
severity
transaction_id
product_id
identifier_code
status
created_at
resolved_at
resolved_by
notes
```

类型：

```text
UNKNOWN_BARCODE
NEGATIVE_STOCK
IMPORT_DATE_WARNING
RECONCILIATION_MISMATCH
DUPLICATE_BARCODE
```

---

# 41. 事务完整性

每次 stock change 必须 atomic：

```text
BEGIN TRANSACTION

1. resolve operator
2. resolve active location
3. resolve barcode → product
4. read current balance
5. calculate multiplier
6. calculate unit quantity
7. calculate new balance
8. evaluate warning
9. insert transaction
10. update inventory balance
11. insert exception if needed

COMMIT
```

任何一步失败：

```text
ROLLBACK
```

不能出现：

```text
History 写进去了
但 Stock 没变
```

或者反过来。

---

# 42. Scanner 技术模式

从客户现有场景看：

扫码枪能够直接把内容输入 Excel。

这通常意味着扫码枪工作为：

```text
Keyboard Wedge / HID Keyboard
```

也就是：

```text
Scan
→ scanner sends characters
→ Enter
```

StockScan 应该优先利用这个行为。

不需要一开始集成复杂厂商 SDK。

## 42.1 Scanner Capture

应用应：

- 自动保持 scanner listener ready
- 不要求用户每次点输入框
- 允许扫码枪结尾 Enter
- 过滤过快的“键盘字符序列”作为 scanner event
- 仍保留人工输入 barcode 作为 fallback

扫码字符串：

```text
trim whitespace
remove CR/LF
preserve all leading zeros
do not numeric-convert
```

## 42.2 扫码枪 Enter 与 Confirm 的冲突（2026-09-10 补充）

扫码枪通常在条码后自动发送 Enter，而 §47 规定 Enter = Confirm。

如果不处理：

```text
扫第一个商品 → Product Card 出现
员工还没输数量
扫第二个商品 → 条码后面的 Enter 直接确认了第一个商品
```

规则：

1. Scanner Capture 在全局层面识别"扫码输入"（字符间隔约 < 30ms、以 Enter / Tab 结尾、长度 ≥ 6）。识别出来的 Enter 只结束这次扫码，**永远不触发 Confirm**
2. 数量输入框有焦点时，高速输入的字符串按扫码处理，不写进数量
3. 有待确认的 Product Card 时扫到新商品：前一张卡片默认**不提交**，提示音 + 提示"上一件未确认"，然后显示新商品。是否改为自动提交，等客户试用后再定
   （Quick Scan 模式例外：每次扫码直接以 Qty 1 提交）
4. 同一条码 300ms 内重复出现视为扫码枪抖动，忽略
5. 首次设置向导加一步"扫码测试"，识别扫码枪后缀（Enter / Tab / 无）和前缀

只有人按的 Enter 才是 Confirm。

---

# 43. 为什么 Barcode 一定是 TEXT

截图中 Excel 曾把扫码结果显示成科学计数法：

```text
6.91479E+12
```

这是典型 Excel 数字格式行为。

因此：

```text
barcode TEXT
```

绝对不要：

```text
barcode INTEGER
```

否则可能：

- leading zero 丢失
- 超长数字精度问题
- 字母条码无法处理
- Excel round / scientific notation 引起错误

---

# 44. UI 视觉方向

目标：

> 像现代 SaaS，但操作速度像专业仓库终端。

不要：

- 老 ERP 深蓝色密集表格
- 20 个菜单
- 小按钮
- 大量 Modal
- 过多图表
- 首页 Dashboard
- 华而不实 animation

要：

- 大操作模式按钮
- 明显 scanner 状态
- 大库存数字
- 充足留白
- 快速键盘操作
- 轻边框
- 微动画只用于扫描反馈
- 高对比 warning
- 双语

---

# 45. 推荐视觉系统

```text
Background
#F6F7F9

Surface
#FFFFFF

Text
#171A1F

Secondary Text
#6F7682

Border
#E5E7EB

Primary
#5B5FEF
```

语义色：

```text
Stock In / Success
Emerald

Sale
Indigo / Blue

Return
Cyan / Teal

Warning
Amber

Danger
Coral / Red
```

**调整（2026-09-10）：** Primary `#5B5FEF` 和 SALE 的 Indigo 几乎是同一个颜色，而 SALE 是最常用的模式，结果"品牌色"和"售出"混在一起。改为：

- 页面框架（导航选中、主按钮、Finish Session）用中性深色 `#171A1F`
- 彩色只留给四个模式 + 警告 / 错误
- 模式色：Stock In `#047857` · Sale `#4F46E5` · Return `#0E7490` · Adjust `#475569` · Warning `#B45309` · Negative `#C2410C`

雏形已按这个方案做。

不要只靠颜色识别。

例如 SALE：

```text
↑ SALE
售出
- Quantity
```

RETURN：

```text
↩ RETURN
退货
+ Quantity
```

---

# 46. Bilingual

右上：

```text
EN | 中文 | ID
```

采用真正 i18n 切换。

普通文案只显示当前语言。

关键模式允许双语常驻：

```text
SALE
售出
```

因为短且能减少误操作。

**补充（2026-09-10）：** 客户公司在印尼，仓库员工日常语言很可能是 Bahasa Indonesia，而不是中文或英文。i18n 从第一天按三种语言准备，成本很低：

```text
en.json
zh.json
id.json
```

**已确定（2026-09-10）：三种语言同时上线。**

模式名：`MASUK`（Stock In）/ `JUAL`（Sale）/ `RETUR`（Return）/ `KOREKSI`（Adjust）。

- Adjust 没用 ACCURATE 的 `Penyesuaian`：太长，放不进模式按钮。请员工确认 `KOREKSI` 是否自然
- 箱的单位用客户 ACCURATE 报表里已有的 `KOLI`，数量切换显示 `PCS / KOLI`，不另造词
- 印尼语用词请客户的仓库员工过一遍（§76 第 9 项）

---

# 47. 键盘快捷操作

为了仓库效率，建议：

```text
F1 = Stock In
F2 = Sale
F3 = Return
F4 = Adjust

+ / - = quantity
Enter = Confirm
Esc = Cancel
Ctrl+Z = Undo Last
Tab = PCS / CTN 切换
```

是否启用 F-key 可以放 Settings。

日常甚至可以：

```text
扫码枪 + 键盘
```

几乎不碰鼠标。

---

# 48. 是否符合“仓储标准”

需要准确区分：

## StockScan MVP 不是完整标准 WMS

完整 WMS 通常还会涉及：

```text
正式 warehouse/location/bin
receiving
putaway
picking
packing
shipping
transfer
cycle counting
lot/batch
serial
expiry
license plate / pallet
quarantine
orders
permissions
approvals
```

StockScan 第一版不应该假装自己是这些全部。

更准确的产品分类是：

> **WMS-lite Inventory Execution Layer**
>
> 或
>
> **Scan-based Inventory Operations Companion**

## 但核心数据设计应该和标准仓储实践兼容

第一版已经可以做到：

```text
Product identification
Location-aware inventory
Units / cartons
Operator traceability
Immutable transaction ledger
Stock adjustment
Return
Negative stock exception
Barcode mapping
Import audit
Backup
Reconciliation
```

这些都是后续扩展 WMS 很好的基础。

---

# 49. GS1 兼容原则

商业化时不要自己发明一个只能自己理解的 barcode 标准。

GS1 体系常见：

```text
GTIN
用于商品 / Trade Item

GLN
用于企业与位置

SSCC
用于物流单元，如 pallet / carton / shipment unit
```

StockScan 第一版不需要强制客户改成 GS1。

但数据模型应兼容：

```text
identifier_type = GTIN / EAN / UPC / INTERNAL
location.external_code = GLN optional
logistic_unit.sscc = optional future
```

这样以后接入标准供应链条码时不用重构。

官方参考：

https://www.gs1.org/standards/barcodes

https://ref.gs1.org/standards/genspecs/

---

# 50. 仓储标准对齐矩阵

| 能力 | StockScan MVP | Commercial Phase |
|---|---|---|
| Product Barcode | Yes | GS1 compatible |
| Multiple Barcode per Product | Yes | Yes |
| Pack / Carton UOM | Yes | Expanded UOM |
| Formal Warehouse Location | Data model Yes | Multi-location UI |
| Internal Bin Location | No | Optional |
| Stock In | Yes | Receiving workflow |
| Sale / Stock Out | Yes | Picking / order integration |
| Return | Yes | Disposition / damaged |
| Adjustment | Yes | Approval workflow |
| Audit Trail | Yes | Yes |
| Operator Tracking | Yes | Roles / PIN / RBAC |
| Negative Stock Warning | Yes | Policy configurable |
| Barcode Pairing | Yes | Bulk product master sync |
| Excel Import | Yes | Import templates / API |
| Reconciliation | Recommended | Core |
| Cycle Count | Phase 1.5 | Core |
| Lot / Batch | No | Optional |
| Serial Tracking | Data model future-safe | Optional |
| Expiry | No | Optional |
| Pallet / SSCC | No | Optional |
| Putaway | No | Future WMS |
| Wave Picking | No | Future WMS |
| Cloud Sync | No | Optional |
| Multi-PC Shared Live DB | No unless confirmed | Central service |

---

# 51. 为什么暂时不要做 Full WMS

客户已经有 ACCURATE。

如果第一版复制：

```text
采购
订单
财务
仓库
销售
供应商
客户
报表
```

会产生：

- 开发周期暴涨
- 数据冲突
- 员工培训成本高
- 两套 ERP
- 很难上线
- 客户反而不敢用

正确策略：

```text
解决一个极具体痛点
→ 扫码库存实时化
→ 员工愿意用
→ 数据可靠
→ 客户认可
→ 再逐步接入原系统
```

这是更合理的商业落地方式。

---

# 52. 是否可以商业化

可以，但不要把第一版直接称为完整商业 WMS。

StockScan 很适合从：

```text
Customer-specific utility
```

逐步变成：

```text
Configurable inventory scanning product
```

因为很多中小型批发、仓库、线下销售场景都有类似问题：

```text
已有会计 / ERP
但现场扫码流程差
Excel 临时记录
库存不是实时
系统太重
员工不愿意用
```

StockScan 的商业定位可以是：

> **A lightweight scanning layer for businesses that already have an ERP but need faster real-time stock operations.**

这比“我要和 SAP / Oracle / WMS 正面竞争”现实很多。

---

# 53. 商业版真正的差异化

不要以：

```text
我们也有库存表格
```

作为卖点。

应该强调：

## 1. ERP Companion

```text
不用替换现有系统
```

## 2. Offline-first

```text
网络不好也能正常扫描
```

## 3. Scanner-first

```text
不是鼠标优先，是扫码枪优先
```

## 4. Smart Quantity

```text
Units + Cartons
```

## 5. Baseline + Live Delta

```text
明确解释旧系统和实时台账之间的差异
```

## 6. Reconciliation

```text
重新导入 ERP snapshot 后自动比对，而不是覆盖
```

## 7. Flexible Barcode Mapping

```text
旧数据没有 barcode 也能上线
```

## 8. Low-training UX

```text
姓名 / 工号
选模式
扫
```

这几个组合起来，商业价值比单纯“漂亮 UI”更强。

---

# 54. 商业化版本等级

## Level 0 - 当前客户 MVP

```text
1 company
1 active formal warehouse
1 PC
offline
SQLite
manual Excel
operator select
scan + quantity
barcode pairing
history
backup
```

## Level 1 - Productized StockScan

```text
multiple import templates
multiple warehouse profiles
carton/unit mode
reconcile
cycle count
exception inbox
admin PIN
automatic update
better installer
```

## Level 2 - Team / LAN

```text
multiple PCs
central service
PostgreSQL
local network
real-time shared stock
role management
```

## Level 3 - Integration

```text
ACCURATE API / database integration if available and authorized
ERP connectors
automatic import/export
order links
```

## Level 4 - WMS-lite

```text
bins
putaway
pick
cycle count
damaged/quarantine
lot/serial
transfer
```

不要一开始跳到 Level 4。

---

# 55. 推荐技术架构

```text
┌──────────────────────────────────────────────┐
│                StockScan.exe                 │
│                                              │
│  Tauri 2                                     │
│  React                                       │
│  TypeScript                                  │
│  Vite                                        │
│  Tailwind CSS                                │
│  lightweight headless UI components         │
│                                              │
│  Scan                                        │
│  Inventory                                   │
│  History                                     │
│  Data                                        │
│  Barcode Setup                               │
└────────────────────┬─────────────────────────┘
                     │
                     ▼
             Rust / Native Layer
                     │
            ┌────────┼─────────┐
            ▼        ▼         ▼
         SQLite    Files     Backup
            │
            ▼
     Transaction Ledger

External:
Scanner HID
ACCURATE XLS/PDF/Excel Export
CSV/XLSX Export
```

---

# 56. 为什么选 Tauri

相比 Electron：

- 安装包通常更小
- 内存更轻
- Windows 内部工具很合适
- 可以保持现代 React UI
- 本地文件 / SQLite / installer 支持好
- 不需要运行一个独立 server

用户看到的是：

```text
StockScan.exe
```

而不是：

```text
网页 + localhost
```

## 56.1 Windows 交付的两个坑（2026-09-10 补充）

**SmartScreen：** 没有代码签名的 `StockScan_Setup.exe`，Windows 会弹"Windows 已保护你的电脑"，员工要点"更多信息 → 仍要运行"。这和"双击就能装"冲突。

- 正式交付前购买代码签名证书
- 证书到位前，交付时附一页带截图的安装说明

**WebView2：** Tauri 在 Windows 上依赖 Microsoft Edge WebView2 Runtime。Windows 11 自带；部分 Windows 10 没有。安装程序默认联网下载它，这和 offline-first 冲突。

- 打包时把 `bundle.windows.webviewInstallMode` 设为 `offlineInstaller`，安装包会大约 +130MB，但完全离线可装
- Phase 7 的 Offline test 要在一台**干净、不联网的 Windows 10** 上跑一次

---

# 57. 前端技术建议

```text
React
TypeScript
Vite
Tailwind CSS
react-i18next
Lucide icons
Zod
```

第一版不要：

```text
Redux
复杂 event bus
microfrontend
GraphQL
heavy design system
```

状态量不大。

可以：

```text
React Context
或
Zustand
```

如果 Context 足够，就不额外加依赖。

---

# 58. 本地数据库

推荐：

```text
SQLite
```

原因：

- 单机
- 无服务器
- 成熟
- 快
- 事务可靠
- 一个 DB 文件方便备份

建议：

```text
foreign_keys = ON
WAL mode
```

所有 stock change 走 transaction。

---

# 59. XLS 解析

必须支持客户真实使用的：

```text
.xls
```

不是只支持 `.xlsx`。

JS 层可以采用支持 legacy XLS 的 Excel parser，例如 SheetJS `xlsx`。

核心不是“读 Excel”，而是：

```text
ACCURATE Report Adapter
```

将报表结构转换成内部统一 schema。

建议：

```text
importers/
  accurateStockReport.ts
  genericSpreadsheet.ts
```

以后新的客户只需要加：

```text
newImporterAdapter
```

这对商业化特别重要。

---

# 60. Repo 结构

```text
stockscan/
│
├─ src/
│  ├─ app/
│  │  ├─ router.tsx
│  │  └─ providers.tsx
│  │
│  ├─ pages/
│  │  ├─ OperatorSelect/
│  │  ├─ Scan/
│  │  ├─ Inventory/
│  │  ├─ History/
│  │  ├─ Data/
│  │  ├─ Reconcile/
│  │  ├─ BarcodeSetup/
│  │  └─ Settings/
│  │
│  ├─ components/
│  │  ├─ ScannerStatus/
│  │  ├─ OperationMode/
│  │  ├─ QuantityControl/
│  │  ├─ StockDelta/
│  │  ├─ ProductCard/
│  │  ├─ WarningDialog/
│  │  └─ LanguageSwitch/
│  │
│  ├─ features/
│  │  ├─ scanner/
│  │  ├─ inventory/
│  │  ├─ transactions/
│  │  ├─ sessions/
│  │  ├─ employees/
│  │  ├─ barcodeMapping/
│  │  ├─ imports/
│  │  ├─ reconciliation/
│  │  ├─ exceptions/
│  │  ├─ exports/
│  │  └─ backups/
│  │
│  ├─ importers/
│  │  ├─ accurateStockReport.ts
│  │  └─ genericSpreadsheet.ts
│  │
│  ├─ i18n/
│  │  ├─ en.json
│  │  ├─ zh.json
│  │  └─ id.json
│  │
│  ├─ types/
│  └─ utils/
│
├─ src-tauri/
│  ├─ src/
│  │  ├─ db/
│  │  ├─ commands/
│  │  ├─ backup/
│  │  └─ main.rs
│  └─ tauri.conf.json
│
├─ migrations/
│
├─ docs/
│  └─ STOCKSCAN_MASTER_BLUEPRINT.md
│
├─ tests/
│  ├─ import/
│  ├─ inventory/
│  ├─ scanner/
│  └─ transactions/
│
├─ package.json
└─ README.md
```

---

# 61. 开发阶段

## Phase 0 - Real Data Validation

先用真实文件验证：

```text
stock gs8 09.09.2026.xls
EMERGENCY.pdf
后续 Barcode Master
```

确认：

```text
ISI
KOLI
HARGA
warehouse column
barcode source
```

---

## Phase 0.5 - Mockup Sign-off（2026-09-10 新增）

用界面雏形（§0.3）和客户过一遍，同时拿到 §76 的答案。

完成标准：

```text
客户确认四个模式和数量输入方式
客户确认 ISI / KOLI / HARGA
拿到 Barcode 来源结论
拿到电脑数量 / 员工语言 / 扫码枪型号 / 同步节奏
```

---

## Phase 1 - Shell + DB

完成：

```text
Tauri shell
React app
SQLite
migrations
language switch
company/location settings
operator selection
```

---

## Phase 2 - ACCURATE Import

完成：

```text
.xls import
report detection
metadata parsing
dynamic warehouse column detection
preview
baseline import
price optional
```

---

## Phase 3 - Barcode Mapping

完成：

```text
Barcode Setup
scan capture
link barcode to product
multiple identifiers
coverage
unknown barcode handling
```

---

## Phase 4 - Core Operations

完成：

```text
Stock In
Sale
Return
Adjustment
quantity +/- input
Unit / Carton
negative stock warning
atomic DB transaction
```

---

## Phase 5 - Reliability

完成：

```text
History
Undo / reversal
Session
sound feedback
Scanner Pulse
Exceptions
```

---

## Phase 6 - Data Exchange

完成：

```text
Export current stock
Export transactions
Backup
Restore
Reconcile
```

---

## Phase 7 - Windows Delivery

完成：

```text
Installer
Desktop shortcut
First-run wizard
No-dev-environment verification
Offline test
Real scanner test
```

---

## Phase 8 - Pilot（2026-09-10 新增）

正式切换前，StockScan 与现有 Excel 流程并行 1–2 周：

```text
每天收工对一次：StockScan Current vs 人工记录
每周导出一次，走一遍 ACCURATE 同步 + Reconcile
记录员工在哪一步停顿、提问、扫错
```

Pilot 通过标准：连续 5 个工作日，除已解释的差异外，StockScan 与实盘一致。

---

# 62. MVP 测试重点

## Barcode

```text
numeric barcode
leading-zero barcode
very long barcode
alphanumeric barcode
unknown barcode
duplicate barcode
Enter suffix
```

## Quantity

```text
1
3
100
carton multiplier
carton + remaining pcs
invalid 0
negative input
large number
```

## Inventory

```text
Stock In
Sale
Return
Adjustment
negative stock warning
reversal
```

## XLS

```text
legacy .xls
different report title rows
dynamic location heading
decimal comma
thousands formatting
missing HARGA
missing KOLI
empty rows
report date mismatch
```

## Crash Safety

```text
close app during scan
DB write failure
invalid file
backup restore
```

---

# 63. 关键快捷体验指标

如果这个产品真的好用，员工完成一个正常单件操作应该接近：

```text
选择 Sale 一次
→ scan
→ Enter
```

同款多件：

```text
scan
→ qty 3
→ Enter
```

整箱：

```text
scan
→ CTN
→ qty 2
→ Enter
```

不能变成：

```text
scan
→ dropdown
→ popup
→ search
→ select
→ click
→ click
→ submit
```

---

# 64. 目标性能

单机 SQLite 下目标非常容易达到：

```text
barcode lookup       < 50 ms
stock update         < 100 ms typical
UI feedback          immediate
inventory search     < 100 ms for normal catalogue
startup              a few seconds or less
```

即使商品几千、几万条也完全足够。

真正性能瓶颈不会是 SQLite，而是：

```text
错误 UX
重复点击
不稳定的 Excel mapping
```

---

# 65. 安全与权限

MVP 不需要企业级 auth。

但最低要求：

```text
Operator attribution
Admin-only setup optional
Immutable transaction log
Backup
No silent overwrite
```

普通员工：

```text
Sale
Stock In
Return
```

管理员可考虑 PIN：

```text
Adjustment
Replace Baseline
Restore Backup
Employee Management
Barcode remap
```

这个可以作为 Phase 1.5。

---

# 66. 数据可信度原则

StockScan 必须明确区分：

```text
Imported
Observed
Calculated
Manually Adjusted
```

例如：

```text
Baseline Source
ACCURATE report

Current Stock
calculated from baseline + local transactions

KOLI
derived

Adjustment
manual correction with operator
```

不能把所有数字都表现成“系统天然知道”。

---

# 67. 建议加入 Notes / Reason

Adjustment 时必须有：

```text
Reason
```

例如：

```text
Physical count correction
Damaged item
Data mismatch
Other
```

Sale 不需要 reason。

这样不会拖慢日常流程，又保持库存调整可解释。

**补充（2026-09-10）：ADJUST 的语义要固定。** 建议 ADJUST 在界面上是"改成实际数量"，不是"再加减 N"：

```text
系统 46
员工选 ADJUST，扫码，输入实际数到的 44，选 Reason
→ 系统记录 ADJUSTMENT −2（46 → 44）
```

原因：员工做调整时手里的信息几乎总是"我数到了多少"，而不是"差了多少"。±N 由系统算，避免心算错误。

MVP 里 Adjust 可以留在模式栏；Phase 1.5 加管理员 PIN 时，Adjust 是第一个需要 PIN 的动作（§65）。

---

# 68. Commercial Reconciliation 的更高级版本

后续可以做：

```text
New ACCURATE File
        ↓
StockScan parses
        ↓
Compare by product/location
        ↓
Match
Difference
Missing in Accurate
Missing in StockScan
        ↓
Review
        ↓
Export discrepancy report
```

这是非常有价值的 B2B 功能。

---

# 69. 多电脑问题

如果客户回答：

```text
只需要一台电脑
```

继续：

```text
Tauri + SQLite
```

这是最优方案。

如果：

```text
两台或以上同时更新同一份实时库存
```

不要用：

```text
PC1 SQLite
PC2 SQLite
然后人工同步
```

正式架构需要：

```text
        Central Inventory Service
                  │
          PostgreSQL / SQLite Server
                  │
       ┌──────────┴──────────┐
       │                     │
 StockScan PC 1        StockScan PC 2
```

如果都在同一办公室，可以先做 LAN，不一定上云。

---

# 70. 离线商业版可以怎么扩展多电脑

如果未来要求：

```text
互联网断了也要用
多电脑也要实时
```

这是更复杂的 offline sync 问题。

不要在 MVP 解决。

商业版有两个方向：

## LAN-first

```text
办公室本地 server
```

优点：

- 无互联网也能共享
- 架构简单

## Cloud + Local Queue

```text
local transaction queue
→ network available
→ sync
```

更强，但冲突处理明显复杂。

---

# 71. 产品命名

Repo：

```text
stockscan
```

第一版产品：

```text
StockScan
```

副标题可以写：

```text
Inventory Operations
```

中文：

```text
StockScan
扫码库存工作台
```

不要现在起特别花哨的品牌名。

等商业化后再做 trademark / brand naming。

---

# 72. 推荐最终产品定位文案

中文：

> StockScan 是一个面向中小型仓库和销售团队的轻量扫码库存工作台。它无需替换现有 ERP，可通过现有库存报表建立库存基线，并通过扫码、数量输入和员工操作记录实时追踪进货、售出、退货和库存调整。系统可离线运行，并通过 Excel/CSV 与现有平台进行人工同步。

英文：

> StockScan is a lightweight scan-based inventory operations tool for businesses that already have an ERP or accounting system but need faster real-time stock updates at the operational level. It imports an inventory baseline, tracks stock changes locally through barcode scanning and quantity-based transactions, and exports structured records for reconciliation with the existing system.

---

# 73. 哪些功能现在一定要做

## P0 Must Have

```text
Windows installer
offline
operator selection
active warehouse
.xls import
ACCURATE report parser
barcode pairing
barcode scan
Sale
Stock In
Return
Adjustment
quantity
pack/carton-aware model
negative stock warning
inventory
history
undo
backup
export
English / 中文 / Bahasa Indonesia
```

---

# 74. 哪些功能建议做，但可以稍后

## P1

```text
Reconciliation
Exception Inbox
Barcode Coverage
Admin PIN
Quick Scan
Cycle Count
```

其中：

```text
Reconciliation
```

我会排在 P1 最前面，因为非常符合当前“新平台是临时实时台账、旧平台人工 Excel 同步”的现状。

---

# 75. 现在明确不要做

## P2 / Future

```text
AI
dashboard analytics
mobile app
camera scanner
customer CRM
supplier management
payment
invoice
full sales order
full purchase order
route planning
pallet system
complex roles
cloud
live ACCURATE integration
```

先让扫码库存闭环真正被使用。

---

# 76. 客户剩余确认问题

根据目前真实数据，问题已经可以进一步精简。

## 必须确认 1：字段

```text
ISI 是否是每箱件数？
KOLI 是否是 Stock / ISI 的箱数？
HARGA 是什么价格：售价、进价还是其他？
```

## 必须确认 2：Barcode

库存报表没有 Barcode。

问：

```text
是否能从 ACCURATE 或其他文件导出 Barcode + Product 对应表？
```

如果没有：

```text
Barcode Pairing 进入 MVP
```

## 必须确认 3：Barcode 粒度

```text
同一种商品所有实物共用同一个 barcode？
还是每件有唯一 serial/barcode？
```

## 必须确认 4：电脑数量

```text
1 PC
还是
多 PC 实时共享
```

## 必须确认 5：Scanner

```text
型号
USB / Bluetooth
```

## 必须确认 6：Returns

因为现有系统有：

```text
Gudang Rusak
```

需要确认损坏退货是否应进入 damaged warehouse。

## 必须确认 7：Export

```text
现有 ACCURATE 最方便接受什么格式？
有没有固定 Import Template？
```

## 建议确认 8：Windows

```text
Windows 10 / Windows 11
```

## 必须确认 9：印尼语用词（2026-09-10 新增）

```text
三语已确定。请仓库员工确认印尼语界面用词，
特别是 MASUK / JUAL / RETUR / KOREKSI 和 PCS / KOLI。
```

## 必须确认 10：同步节奏（2026-09-10 新增）

```text
StockScan 导出后，多久、由谁录入 ACCURATE？
下次从 ACCURATE 导出的报表，是否已经包含这些录入？
```

决定 §19.1 的对账公式。

---

# 77. 推荐给客户的简洁问题

中文：

1. 请确认 `ISI` 是否是每箱件数、`KOLI` 是否是库存折合箱数，以及 `HARGA` 是哪一种价格。
2. 目前库存报表里没有 Barcode。ACCURATE 或其他文件能否另外导出 Barcode 和商品的对应关系？
3. 同一种商品的多件实物通常共用一个 Barcode，还是每一件都有唯一编号？
4. StockScan 是一台电脑使用，还是需要多台电脑同时共享同一份实时库存？
5. 请提供一下扫码枪型号或设备标签照片。
6. 现有系统里有 `Gudang Rusak`。损坏退货是否需要进入损坏品仓库，而不是直接回到可售库存？
7. 最后从 StockScan 导回现有系统时，有没有固定 Excel/CSV 模板？
8. 主要使用电脑是 Windows 10 还是 Windows 11？
9. 界面会提供印尼语、中文、英文三种语言。能否请一位仓库员工看一下印尼语版本的用词是否自然？
10. StockScan 导出的记录，一般多久、由谁录入 ACCURATE？之后再从 ACCURATE 导出的库存报表，是否已经包含这些录入？

---

# 78. English Client Questions

1. Could you please confirm whether `ISI` means units per carton/pack, whether `KOLI` is the carton-equivalent stock quantity, and what type of price `HARGA` represents?
2. The current stock report does not contain a Barcode column. Is there another export from ACCURATE or another system that maps barcodes to products?
3. For multiple units of the same product, do they normally share the same barcode, or does each physical unit have its own unique barcode/serial number?
4. Will StockScan normally run on one computer only, or do multiple computers need to update the same live inventory at the same time?
5. Could you send me the scanner model or a photo of its device label/connection?
6. I noticed the existing system has a `Gudang Rusak` report/location. Should damaged returns be moved to that damaged-stock warehouse instead of going directly back into sellable stock?
7. Is there a fixed Excel/CSV template that would be easiest for importing StockScan data back into the existing system?
8. What Windows version will the main StockScan computer use?
9. StockScan will ship in Bahasa Indonesia, Chinese and English. Could a warehouse staff member check whether the Indonesian wording feels natural?
10. After StockScan records are exported, how soon and by whom are they entered into ACCURATE? Will the next stock report exported from ACCURATE already include those entries?

---

# 79. 最终建议的产品边界

最推荐的第一版边界是：

```text
ACCURATE
= 正式企业库存 / 财务系统

StockScan
= 现场实时库存执行层
```

两者不是竞争关系。

```text
ACCURATE 提供 Baseline
StockScan 记录 Live Delta
StockScan 导出
双方 Reconcile
```

这也是为什么这个产品有商业化潜力。

---

# 80. 最终架构一句话

```text
Tauri Windows App
+ React UI
+ SQLite local ledger
+ ACCURATE XLS adapter
+ Barcode mapping
+ Scanner HID
+ Unit/Carton quantity
+ Operator sessions
+ Baseline/Live Delta
+ Export/Reconciliation
```

---

# 81. 最终用户体验一句话

```text
安装
→ 选择员工
→ 选 Sale / Stock In / Return
→ 扫一个商品
→ 输入件数或箱数
→ Enter
→ 库存立即更新
```

---

# 82. 最终产品价值一句话

> **不要替换客户已有系统，只把最慢、最容易出错的“现场扫码 + 实时库存”这一层做好。**

---

# 83. 推荐第一版 Acceptance Criteria

一个完全不会 coding 的客户员工应该能够：

1. 双击安装文件完成安装。
2. 从桌面图标打开 StockScan。
3. 不联网正常使用。
4. 通过姓名 / 工号选择 Operator。
5. 首次导入 ACCURATE `.xls` 库存报表。
6. 正确看到 Product、ISI、仓库库存、KOLI 折算和可选 HARGA。
7. 在没有 barcode master 时，为商品绑定实物条码。
8. 用现有扫码枪识别商品。
9. 选择 Sale / Stock In / Return / Adjustment。
10. 扫一次同款商品后输入 N 个，而不是必须扫 N 次。
11. 按件或按箱进行数量输入。
12. 立即看到库存 Before → After。
13. 在库存不足时收到 Warning，但可以选择继续。
14. 未知条码不会偷偷改变库存。
15. 每次库存改变都有 Operator、时间和 Session。
16. 错误交易可以 Undo，但历史不可被删除。
17. 搜索当前库存。
18. 查询历史记录。
19. 导出当前库存。
20. 导出 Transaction Ledger。
21. 创建备份。
22. 恢复备份。
23. English / 中文 / Bahasa Indonesia 切换。
24. 全过程不需要 localhost、命令行或开发环境。

---

# 84. 最后结论

基于客户现有 ACCURATE 5、真实 `.xls` 库存文件、EMERGENCY 报表、扫码枪工作方式以及“现有系统不实时”的痛点，最合理的产品不是重做一个 ERP，而是：

> **StockScan: 一个 Offline-first、Scanner-first、Quantity-aware 的实时库存执行层。**

它第一版应该非常轻：

```text
Windows
Single PC first
SQLite
Manual Excel
```

但数据模型从第一天就保留：

```text
formal warehouse/location
multiple identifiers
pack size
transaction ledger
operator
import provenance
```

因此将来可以自然演进：

```text
Single-PC Utility
→ Commercial StockScan
→ Multi-PC LAN
→ ACCURATE Integration
→ WMS-lite
```

最值得突出、也最贴合这个客户的新颖元素不是 AI，而是：

```text
1. Baseline + Live Delta
2. Unit / Carton Smart Quantity
3. Barcode Pairing
4. Mode-first Scanner UX
5. Scanner Pulse
6. Sessions
7. Reconciliation
8. Barcode Coverage
9. Exception Inbox
10. Future Blind Cycle Count
```

这些功能既能够保持第一版简单，也能够让 StockScan 看起来和真正的商业库存产品处于同一条演进路线，而不是一个临时 Excel 替代品。

---

# 85. External Standards / Commercial References

这些资料用于产品架构对齐，不代表第一版必须实现完整 WMS。

## GS1 Barcodes

https://www.gs1.org/standards/barcodes

GS1 barcode system covers product, shipment and location identification, and provides the foundation for GTIN and other identification keys.

## GS1 General Specifications

https://ref.gs1.org/standards/genspecs/

用于后续 GTIN / GS1 barcode compatibility。

## Microsoft Dynamics 365 Warehouse Management mobile workflows

https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/configure-mobile-devices-warehouse

可参考专业 WMS 如何组织 warehouse worker、scan confirmation、inventory adjustments、returns/disposition、warehouse/location workflows。

## Microsoft Dynamics 365 Cycle Counting

https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/cycle-counting

可用于后续 StockScan Cycle Count / Blind Count / discrepancy review 的产品设计参考。

---

# 86. Source Files Used For This Blueprint

```text
stock gs8 09.09.2026.xls
EMERGENCY.pdf
ACCURATE 5 screenshots supplied by client
scanner / Excel workflow screenshots supplied previously
```

这份文档应作为当前 repo 的主产品和架构文档：

```text
docs/STOCKSCAN_MASTER_BLUEPRINT.md
```

后续只维护这一份为 source of truth，避免 `SPEC_V1`、`SPEC_V2`、`QUESTIONS` 多份文件互相冲突。
