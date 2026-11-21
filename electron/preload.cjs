/**
 * 预加载脚本：当前不需要向渲染进程暴露任何 node 能力。
 * 保留文件是为了未来需要（如导出到系统文件）时不必改动主进程配置。
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  isDesktop: true,
});
