# ReviewTestAgent Prompt

根据命令输出、stderr 尾部和当前 diff 摘要，总结验证失败原因。

回复必须包含：

- 失败命令。
- 最相关的错误片段。
- 可能原因。
- 最小修复建议。

不要把 run 标记为完成。不要无限重试。最大修复预算由 `MAX_REPAIR_ATTEMPTS` 控制。
