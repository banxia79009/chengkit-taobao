"use strict";

const fs = require("node:fs");
const path = require("node:path");

const NORMAL_COOLDOWN_MS = 90_000;
const VERIFICATION_COOLDOWN_MS = 30 * 60_000;

function createBrowserGuard(deps = {}) {
  const directory = deps.directory || path.join(__dirname,'..','state');
  const stateFile = path.join(directory, "taobao-browser-activity.json");
  const now = deps.now || Date.now;
  const normalCooldownMs = deps.normalCooldownMs ?? NORMAL_COOLDOWN_MS;
  let busy = false;
  let memoryState = {};

  function readState() {
    try {
      const data = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      const saved = data && typeof data === "object" ? data : {};
      return (memoryState.next_allowed_at || 0) > (saved.next_allowed_at || 0) ? memoryState : saved;
    } catch { return memoryState; }
  }

  function writeState(data) {
    memoryState = data;
    fs.mkdirSync(directory, { recursive: true });
    const temporary = `${stateFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(data)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, stateFile);
  }

  async function run(kind, task) {
    if (busy) throw new Error("已有淘宝任务正在运行。为减少风控，本次没有打开或操作淘宝，请稍后再试。");
    const state = readState();
    const current = now();
    if (Number.isFinite(state.next_allowed_at) && current < state.next_allowed_at) {
      const seconds = Math.max(1, Math.ceil((state.next_allowed_at - current) / 1000));
      throw new Error(`淘宝工具正在冷却，还需约 ${seconds} 秒。本次没有打开或操作淘宝，请勿连续重试。`);
    }

    busy = true;
    let extraBlockMs = 0;
    try {
      return await task({ blockFor(ms) { if (Number.isFinite(ms)) extraBlockMs = Math.max(extraBlockMs, ms); } });
    } finally {
      const finished = now();
      try {
        writeState({
          last_action: kind,
          finished_at: finished,
          next_allowed_at: finished + Math.max(normalCooldownMs, extraBlockMs),
        });
      } finally {
        busy = false;
      }
    }
  }

  function releaseVerification(){
    if(busy)throw Error('已有淘宝操作进行中，不能解除协助状态。');
    const state=readState();
    // A successful explicit assistance check removes only the verification extension.
    writeState({...state,next_allowed_at:Math.max(now(),(state.finished_at||now())+normalCooldownMs)});
  }
  return { run, readState, releaseVerification };
}

module.exports = {
  NORMAL_COOLDOWN_MS,
  VERIFICATION_COOLDOWN_MS,
  createBrowserGuard,
  browserGuard: createBrowserGuard(),
};
