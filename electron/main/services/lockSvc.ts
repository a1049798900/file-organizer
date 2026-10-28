// 应用锁状态 — 主进程内存状态，用于通知内容脱敏与渲染进程同步
let locked = false;

export function setAppLocked(value: boolean): void {
  locked = value;
}

export function getAppLocked(): boolean {
  return locked;
}
