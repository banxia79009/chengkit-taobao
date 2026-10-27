"use strict";
const fs = require("node:fs");
const path = require("node:path");
const FILE = path.join(__dirname,'..','state','search-last-diagnostic.json');
function safeError(error) {
  // Local diagnostic only: no stdout, query, products or environment values.
  // Keys are not inherited by the subprocess. Still redact credential-like text.
  const detail = String(error?.stderr || error?.message || "")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/(?:cookie|authorization|token|api[_-]?key|password)[^\r\n]*/gi, "[REDACTED]")
    .replace(/https?:\/\/[^\s"']+/gi, "[URL]")
    .slice(0, 2500);
  const failure=require('./search-failure.cjs').inspect(error);
  return { code: typeof error?.code === "number" ? error.code : String(error?.code || "unknown").slice(0, 40), killed: !!error?.killed, stage:failure.stage,failure_code:failure.failure_code,detail };
}
function record(data) {
  try { fs.mkdirSync(path.dirname(FILE),{recursive:true});fs.writeFileSync(FILE, JSON.stringify({time:new Date().toISOString(),pid:process.pid,...data},null,2),{mode:0o600}); }
  catch { /* Diagnostics must not change tool behavior. */ }
}
module.exports = { record, safeError };
