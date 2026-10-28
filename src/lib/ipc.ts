// IPC 调用封装 — 类型化的 window.weave 包装
// 前端所有 IPC 调用统一走此文件，不直接调用 window.weave

const weave = (window as unknown as { weave: import('../types/weave-api').WeaveAPI }).weave;

export const scanApi = weave.scan;
export const fileApi = weave.file;
export const projectApi = weave.project;
export const calendarApi = weave.calendar;
export const lockApi = weave.lock;
export const kbApi = weave.kb;
export const tagApi = weave.tag;
export const contactApi = weave.contact;
export const graphApi = weave.graph;
export const settingsApi = weave.settings;
export const webApi = weave.web;

export default weave;
