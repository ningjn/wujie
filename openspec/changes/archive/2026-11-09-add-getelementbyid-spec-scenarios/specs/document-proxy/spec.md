# Spec Delta

## MODIFIED Requirements

### Requirement: 元素查询优先在渲染根内进行
系统 SHALL 在子应用侧 `document` 上执行 `querySelector`、`querySelectorAll`、`getElementById` 时，优先在渲染根内查找；仅当渲染根内无匹配时，才回退到 iframe 文档查询。

#### Scenario: 渲染根内存在匹配元素
- **WHEN** 子应用在渲染根已包含目标元素的情况下调用 `document.querySelector`
- **THEN** 系统 SHALL 返回渲染根内的该元素
- **AND** 系统 SHALL 不返回 iframe 文档内的同名元素

#### Scenario: 渲染根内无匹配时回退到 iframe 文档
- **WHEN** 子应用调用 `document.querySelector` 且渲染根内不存在匹配元素
- **THEN** 系统 SHALL 返回 iframe 文档内的匹配元素（若存在）

#### Scenario: getElementById 在渲染根内命中
- **WHEN** 子应用调用 `document.getElementById` 且渲染根内存在该 id 的元素
- **THEN** 系统 SHALL 返回渲染根内的该元素
- **AND** 系统 SHALL 不返回 iframe 文档内的同 id 元素

#### Scenario: getElementById 在渲染根内无匹配时回退到 iframe 文档
- **WHEN** 子应用调用 `document.getElementById` 且渲染根内不存在该 id 的元素
- **THEN** 系统 SHALL 返回 iframe 文档内的该元素（若存在）
