## 1. Implementation
- [ ] 1.1 为 isolated runtime 端口选择新增“自动回退”流程（默认端口被占用则申请下一组可用端口）
- [ ] 1.2 扩展 e2e-port-config / port-allocator 支持端口池与步进
- [ ] 1.3 e2e-runtime-registry 记录动态端口组，清理逻辑能回收
- [ ] 1.4 更新 runner 报错信息：端口耗尽时列出冲突 runtime 与端口组
- [ ] 1.5 补充/更新相关测试或校验脚本
