# styles-loading Specification

## Purpose

定义无界框架在子应用渲染过程中对外链样式（`<link rel="stylesheet">`）的劫持加载、入口 HTML 内联转换，以及相同绝对地址去重的行为契约，确保同一份样式在任一渲染模式下都不会被重复注入。

## Requirements

### Requirement: 渲染根内的外链样式按绝对地址去重
系统 SHALL 在同一渲染根（shadow-root 模式的 ShadowRoot，或降级模式的渲染 iframe 文档）内，对绝对地址相同的外链样式只生成一份 `<style>` 元素。

#### Scenario: 入口 HTML 已内联同地址样式时不再重复注入
- **WHEN** 子应用运行时向渲染根动态插入 `<link rel="stylesheet" href="X">`，且该渲染根内已存在绝对地址为 X 的 `<style>`
- **THEN** 系统 SHALL 不为 X 生成第二份 `<style>`
- **AND** 系统 SHALL 将该 `<link>` 从渲染根中移除（沿用既有的注释占位策略）

#### Scenario: 降级模式下同样按渲染根去重
- **WHEN** 降级渲染场景下子应用向渲染 iframe 文档动态插入 `<link rel="stylesheet" href="X">`，且该文档内已存在绝对地址为 X 的 `<style>`
- **THEN** 系统 SHALL 不为 X 生成第二份 `<style>`

#### Scenario: 不同地址的样式互不影响
- **WHEN** 渲染根内已存在绝对地址为 X 的 `<style>`，子应用插入绝对地址为 Y 的 `<link>`
- **THEN** 系统 SHALL 为 Y 正常生成 `<style>` 并加载其内容

### Requirement: 去重命中时补发样式 load 事件
系统 SHALL 对因去重而被跳过的原始 `<link>` 补发 `load` 事件，且该事件 SHALL 异步派发，以兼容「先 appendChild、后注册监听」的加载器。

#### Scenario: 监听注册晚于插入时仍能收到 load
- **WHEN** 消费方在 `<link>` 被插入返回之后才注册 `load` 监听
- **THEN** 系统 SHALL 在之后的宏任务中向该 `<link>` 派发 `load` 事件
- **AND** 该监听 SHALL 被触发一次

#### Scenario: 不在调用栈内同步派发
- **WHEN** 去重命中发生在 `<link>` 插入的同一个调用栈内
- **THEN** 系统 SHALL 不在该调用栈内同步派发 `load` 事件

### Requirement: 加载失败的样式不阻断后续重试
系统 SHALL 仅在该绝对地址的样式内容实际存在时，才把该地址视为「已加载」；当样式请求失败、内容为空时，系统 SHALL NOT 保留该地址的去重标记，使得后续对同一地址的插入能够重新加载并注入内容。

#### Scenario: 首次加载失败后再次插入同一地址
- **WHEN** 子应用首次插入的 `<link>` 指向的 CSS 请求失败，且随后再次插入同一地址的 `<link>`
- **THEN** 系统 SHALL 重新请求该地址的 CSS
- **AND** 系统 SHALL 将请求到的 CSS 内容注入渲染根

#### Scenario: 入口 HTML 内联失败时不得留下已加载标记
- **WHEN** 入口 HTML 中的外链 CSS 加载失败、内容为空
- **THEN** 系统 SHALL NOT 在渲染根内留下带该地址去重标记的样式元素
- **AND** 系统 SHALL 保留原始 `<link>` 以便浏览器自行重试
