# Spec Delta

## Purpose

定义无界框架向子应用暴露的 `document` 代理在元素查询时的行为契约：查询优先在子应用渲染根（shadow-root 模式下的 ShadowRoot）内进行，未命中时回退到 iframe 文档，并保证各查询方法的返回值类型符合 Web 标准。

## ADDED Requirements

### Requirement: 元素查询优先在渲染根内进行
系统 SHALL 在子应用侧 `document` 上执行 `querySelector`、`querySelectorAll`、`getElementById` 时，优先在渲染根内查找；仅当渲染根内无匹配时，才回退到 iframe 文档查询。

#### Scenario: 渲染根内存在匹配元素
- **WHEN** 子应用在渲染根已包含目标元素的情况下调用 `document.querySelector`
- **THEN** 系统 SHALL 返回渲染根内的该元素
- **AND** 系统 SHALL 不返回 iframe 文档内的同名元素

#### Scenario: 渲染根内无匹配时回退到 iframe 文档
- **WHEN** 子应用调用 `document.querySelector` 且渲染根内不存在匹配元素
- **THEN** 系统 SHALL 返回 iframe 文档内的匹配元素（若存在）

### Requirement: querySelectorAll 始终返回 NodeList
系统 SHALL 保证 `document.querySelectorAll` 的返回值始终是 NodeList，不得返回 `null` 或其他类型。

#### Scenario: 选择器在渲染根与 iframe 文档内均无匹配
- **WHEN** 子应用调用 `document.querySelectorAll` 且渲染根内无匹配元素
- **THEN** 系统 SHALL 返回一个空的 NodeList
- **AND** 该返回值 SHALL 具备可用的 `length` 属性

#### Scenario: 选择 base 时不返回 null
- **WHEN** 子应用调用 `document.querySelectorAll("base")`
- **THEN** 系统 SHALL 返回 NodeList
- **AND** 系统 SHALL NOT 返回 `null`

### Requirement: base 元素的查询特判仅作用于 querySelector
系统 SHALL 在 `document.querySelector` 查询 `base` 元素且渲染根内无匹配时返回 `null`，而不回退到 iframe 文档中的 base 元素。

#### Scenario: querySelector 查询 base
- **WHEN** 子应用调用 `document.querySelector("base")` 且渲染根内无 base 元素
- **THEN** 系统 SHALL 返回 `null`
- **AND** 系统 SHALL NOT 返回 iframe 文档内的 base 元素
