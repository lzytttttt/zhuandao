# 全 Boss 清单（代码数据源）

> 上级：[INDEX](../00-INDEX.md) ｜ 机制详述：[BOSS设计](../05-tower/03-BOSS设计.md)
> **本表是 Boss 数值的唯一权威来源**。

---

## 一、字段定义

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 前缀 boss_ |
| name | string | 中文名（含称号） |
| sys | enum | 系别 |
| domain | int | 所属域 |
| hp / atk / armor | number | 基础面板 |
| phases | int | 阶段数 |
| moves | string[] | 行为池（按阶段分组） |
| drops_first / drops_repeat | string | 首通/重复掉落 |

## 二、Boss 全量表（MVP 5 个）

| id | name | sys | domain | hp | atk | armor | phases | moves |
|---|---|---|---|---|---|---|---|---|
| boss_huyan | 黑风寨主·呼延豹 | 刚 | 1 | 600 | 20 | 0 | 2 | [slash, summon_minion, jump_slam, rage] |
| boss_baihe | 衡岚掌门·白鹤真人 | 风 | 2 | 1200 | 28 | 40 | 3 | [sword_beam, guard_stance, swallow_dash, qi_wall, sword_rain] |
| boss_aoshi | 沧澜龙王·敖十三 | 水 | 3 | 1800 | 32 | 30 | 3 | [water_barrage, poison_ring, vortex_pull, summon_pirate, tidal_wave] |
| boss_helian | 孤城刀魔·赫连霸 | 刚 | 4 | 2600 | 40 | 100 | 3 | [great_slash, charge, stomp, armor_field, triple_charge, armor_break] |
| boss_jianwuji | 前任武林至尊·剑无极 | 玄 | 5 | 3800 | 45 | 60 | 3 | [blade_clash, chase_slash, mirror_style, clash_burst, ultimate_field, blade_tomb] |

## 三、技能定义表

| move ID | 名 | 阶段 | 前摇 | 判定 | 伤害系数 | 备注 |
|---|---|---|---|---|---|---|
| slash | 砍山双斩 | 呼延豹P1 | 0.6s | 近战扇形 | 1.0×atk | 基础平A |
| summon_minion | 呼喝聚匪 | P1 | 1.0s | — | — | 召 2 喽啰（≤4 在场） |
| jump_slam | 跳劈震地 | P2 | 0.8s | 落点大圈 | 1.5×atk | 落点红圈预警 |
| rage | 狂暴 | P2 | — | — | — | 移速/攻速 +30%，可被冰缓 |
| sword_beam | 剑气斩 | 白鹤P1 | 0.7s | 直线穿透 | 1.2×atk | 可走位躲 |
| guard_stance | 拔刀式 | P1 | — | — | — | 正面 120° 格挡 3s |
| swallow_dash | 燕返 | P2 | 0.5s | 突进两段 | 1.0×atk | 每段独立预警 |
| qi_wall | 气墙 | P2 | 1.2s | — | — | 圆形护罩 4s，刀被弹开，背面无防护 |
| sword_rain | 万剑归宗 | P3 | 1.5s | 全屏 8 向 | 0.8×atk | 间隙走位 |
| water_barrage | 水弹幕 | 敖十三P1 | 1.0s | 环形弹幕 | 0.8×atk | 慢速可穿缝 |
| poison_ring | 毒环 | P1 | 0.8s | 地面圈×3 | DoT | 10%/s 3s |
| vortex_pull | 龙吸水 | P2 | 1.0s | 牵引 | — | 1.5s 反向走位挣脱 |
| summon_pirate | 召唤水贼 | P2 | 1.0s | — | — | ×2 |
| tidal_wave | 惊涛 | P3 | 1.5s | 全屏三连 | 1.0×atk | 安全区随机 |
| great_slash | 巨刃横扫 | 赫连霸P1 | 0.8s | 半屏扇形 | 1.5×atk | — |
| charge | 冲锋 | P1 | 0.8s | 直线 | 1.8×atk | 撞墙自晕 2s |
| stomp | 跺地冲击 | P2 | 1.0s | 全屏波 | 1.0×atk | 走位至落点边缘 |
| armor_field | 重甲领域 | P2 | — | — | — | 周身 DR 80% |
| triple_charge | 暴走三连冲 | P3 | 0.6s×3 | 直线×3 | 1.5×atk | 撞墙才停 |
| armor_break | 甲碎 | P3 | — | — | — | 护甲归零、攻击 +60% |
| blade_clash | 刀阵对拼 | 剑无极P1 | — | — | — | 敌方刀阵演出碰撞 |
| chase_slash | 追身斩 | P1 | 0.5s | 突进平A | 1.0×atk | — |
| mirror_style | 镜像流派 | P2 | 1.5s | — | — | 复制玩家主系强化 |
| clash_burst | 收势对轰 | P2 | 2.0s | 大圈 | 2.0×atk | 红圈预警，走出炸点 |
| ultimate_field | 无极领域 | P3 | — | — | — | 全屏减速 20%，中央安全 |
| blade_tomb | 刀冢万鸣 | P3 | 1.5s | — | — | 召 4 把敌方野刀绕体 |

## 四、掉落表

| id | 首通 | 重复 |
|---|---|---|
| boss_huyan | 声望 200 + 蓝刀×1 + gang×3 + 30 金 | 声望 60 + gang×1 + 15 金 |
| boss_baihe | 声望 350 + 蓝刀×1 + gang×5 + 40 金 | 声望 100 + gang×2 + 20 金 |
| boss_aoshi | 声望 500 + 紫刀×1 + han×5 + 50 金 | 声望 150 + han×2 + 25 金 |
| boss_helian | 声望 750 + 紫刀×1 + jin×5 + 60 金 | 声望 200 + jin×2 + 30 金 |
| boss_jianwuji | 声望 1500 + 橙刀自选 + yun×5 + 100 金 + 称号 | 声望 300 + yun×2 + 50 金 |

## 五、Boss 战前对白（一句话，战前演出 2s）

| Boss | 台词 |
|---|---|
| 呼延豹 | "又来一个送刀的！" |
| 白鹤真人 | "刀剑无眼，阁下自重。" |
| 敖十三 | "水里养的刀，见血才快。" |
| 赫连霸 | "俺这把刀，劈过城门。" |
| 剑无极 | "等你很久了。来，取走我的名号。" |

## 六、一致性检查记录

- [x] 5 个 = 五域各一（目标达成）
- [x] 技能前摇全部 ≥0.5s（走位红线）
- [x] 血量曲线 600→3800 匹配 DPS 自检表区间
- [x] 剑无极镜像机制与 [流派](../04-build/02-流派build示范.md) 六系联动（mirror_style 读取玩家主系）
