import runtime from './opencli-runtime.cjs';
const registry=await import(runtime.url('dist/src/registry-api.js'));
const errors=await import(runtime.url('dist/src/errors.js'));
const common=await import(runtime.url('clis/_shared/common.js'));
export const {cli,Strategy,getRegistry}=registry;
export const {AuthRequiredError}=errors;
export const {clampInt,requireNonEmptyQuery}=common;
