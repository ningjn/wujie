# app-rendering Specification

## Purpose

定义无界框架把子应用模板构建为可运行渲染根的完整流程契约：渲染根的准备（head/body 归属、DOM 副作用劫持安装、相对路径基准注入）与模板内容的渲染是两个独立职责，任一方失败或缺省都不应让另一方留下半初始化状态。

## Requirements

### Requirement: 渲染根准备独立于模板内容
系统 SHALL 保证无论模板内容是否为空，渲染根都完成 head/body 赋值与 DOM 副作用劫持的安装，使子应用运行期动态注入的样式与脚本始终被 wujie 接管。

#### Scenario: 模板为空时渲染根仍完成 head/body 赋值
- **WHEN** 系统在模板为空的情况下准备渲染根
- **THEN** 系统 SHALL 仍为渲染根的 head 与 body 建立可用的引用
- **AND** 子应用运行期向该 head 插入样式元素时，系统 SHALL 按非空模板的同等路径接管该元素

#### Scenario: 模板为空时仍安装副作用劫持
- **WHEN** 系统在模板为空的情况下准备渲染根
- **THEN** 系统 SHALL 仍对渲染根的 head/body 安装 appendChild、insertBefore 等副作用劫持
- **AND** 子应用运行期插入的外链样式 SHALL 被转换为 `<style>` 而非原样插入

#### Scenario: 降级模式同样完成渲染根准备
- **WHEN** 系统在模板为空的情况下准备降级渲染的 iframe 文档
- **THEN** 系统 SHALL 仍为该文档安装副作用劫持
- **AND** 系统 SHALL 仍完成相对路径基准的注入

### Requirement: 空模板不产生字面量 undefined 文本
系统 SHALL 在模板为空或未定义时跳过模板内容的渲染，不得把字符串 `undefined` 渲染进渲染根或渲染 iframe 文档。

#### Scenario: 渲染根中不出现 undefined 文本
- **WHEN** 系统在模板为空的情况下准备渲染根
- **THEN** 系统 SHALL NOT 在渲染根中渲染出 `undefined` 文本

#### Scenario: 渲染 iframe 文档中不出现 undefined 文本
- **WHEN** 系统在模板为空的情况下准备降级渲染的 iframe 文档
- **THEN** 系统 SHALL NOT 在该文档中渲染出 `undefined` 文本

### Requirement: 空模板给出可观测告警
系统 SHALL 在因模板为空而跳过内容渲染时输出一次告警，说明子应用标识与被跳过的原因。

#### Scenario: 空模板触发告警
- **WHEN** 系统因模板为空而跳过内容渲染
- **THEN** 系统 SHALL 输出包含子应用标识的告警信息

### Requirement: 非空模板的渲染行为保持不变
系统 SHALL 在模板非空时，按既有流程完成模板解析、样式补丁处理与内容渲染。

#### Scenario: 正常模板完成渲染
- **WHEN** 系统收到非空模板
- **THEN** 系统 SHALL 将模板渲染进渲染根
- **AND** 系统 SHALL 完成渲染根的 head/body 赋值与副作用劫持安装
