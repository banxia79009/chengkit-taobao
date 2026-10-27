"use strict";

// Serialized into the page. No arbitrary selectors, URLs or code are accepted from callers.
function pageActions(action, spec) {
  const visible = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none";
  const disabled = e => !visible(e) || e.disabled || e.getAttribute("aria-disabled") === "true" || /disabled|gray/i.test(e.className || "");
  const norm = s => String(s || "").replace(/\s+/g, " ").trim();
  if (/^https:\/\/login\.taobao\.com\//.test(location.href)) return {error:"淘宝登录已失效；请用户在电脑 Chrome 完成登录后再试，未执行加购。"};
  if (!/^https:\/\/(item\.taobao\.com|detail\.tmall\.com)\//.test(location.href)) return {error:"不在淘宝或天猫商品页，已停止。"};
  const foot = document.querySelector("#tbpcDetail_SkuPanelFoot");
  const panel = foot?.closest('[class*="GeneralSkuPanel--"]') || document.querySelector('[class*="GeneralSkuPanel--"]');
  if (!panel || !foot) return { error: "商品规格面板未识别；为避免点错，已停止。" };
  const groups = new Map();
  for (const el of panel.querySelectorAll('[class*="valueItem--"]')) {
    const group = el.closest('[class*="skuItem--"], [class*="prop--"]') || el.parentElement;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(el);
  }
  const keywords = norm(spec).split(" ").filter(Boolean);
  const selected = [];
  for (const items of groups.values()) {
    let chosen = items.find(e => /selected|active/i.test(e.className) && !disabled(e));
    if (action === "select") {
      if (keywords.length) {
        let score = 0;
        for (const el of items.filter(e => !disabled(e))) {
          const n = keywords.filter(k => norm(el.textContent).includes(k)).length;
          if (n > score) { chosen = el; score = n; }
        }
        if (!score) return {error:"未匹配到指定规格，未加购。请提供各组选项的准确名称。"};
      } else chosen ||= items.find(e => !disabled(e));
      if (!chosen) return {error:"没有可用规格，未加购。"};
      if (!/selected|active/i.test(chosen.className)) chosen.click();
    }
    if (!chosen) return {error:"规格尚未选全，未加购。"};
    selected.push(norm(chosen.textContent));
  }
  if (keywords.some(k => !selected.some(s => s.includes(k)))) return {error:"所选规格与要求不符，未加购。"};
  const quantityInputs = Array.from(panel.querySelectorAll('input[class*="countValue--"]')).filter(visible);
  if (quantityInputs.length !== 1 || quantityInputs[0].value !== "1") return {error:"仅允许数量为 1；当前数量无法确认，未加购。"};
  const candidates = new Set();
  for (const icon of foot.querySelectorAll('[class*="icon-taobaojiarugouwuche"]')) {
    const button = icon.closest('[class*="btnItem--"], button, [role="button"]');
    if (button && !disabled(button) && !/购买|结算|付款/.test(button.textContent)) candidates.add(button);
  }
  for (const el of foot.querySelectorAll('button, [role="button"], a, div, span')) {
    if (/^加入\s*购物车$/.test(norm(el.textContent))) {
      const button = el.closest('[class*="btnItem--"], button, [role="button"]') || el;
      if (!disabled(button)) candidates.add(button);
    }
  }
  // Collapse nested wrappers for the same button; refuse distinct ambiguous buttons.
  const buttons = [...candidates].filter(a => ![...candidates].some(b => a !== b && a.contains(b)));
  if (buttons.length !== 1) return {error:`发现 ${buttons.length} 个可用加购按钮，无法唯一确定，未加购。`};
  const button = buttons[0];
  // Newer Tmall pages put the currently selected SKU title and live price in
  // this fixed item header instead of the older hashed class names. Prefer it:
  // it is scoped to the product/SKU panel and avoids coupon or recommendation prices.
  const itemHead = document.querySelector('#tbpcDetail_SkuPanelItemhead_fixed');
  const legacyPriceEl = Array.from(panel.querySelectorAll('[class*="normalPrice--"], [class*="priceWrap--"]'))
    .find(e => visible(e) && /[￥¥]\s*\d/.test(e.textContent));
  const match = norm(itemHead?.textContent).match(/[￥¥]\s*(\d+(?:\.\d{1,2})?)/)
    || norm(legacyPriceEl?.textContent).match(/[￥¥]\s*(\d+(?:\.\d{1,2})?)/);
  const itemHeadTitle = itemHead && Array.from(itemHead.querySelectorAll('span[title]'))
    .find(e => visible(e) && norm(e.getAttribute('title')).length > 3);
  const title = norm(itemHeadTitle?.getAttribute('title')
    || document.querySelector('[class*="mainTitle--"]')?.textContent
    || document.title.replace(/-.*$/, ""));
  const result = { item_id: new URL(location.href).searchParams.get("id"), title: title.slice(0,200),
    price: match ? `¥${match[1]}` : "", selected_spec: selected.join(" | "), quantity: 1,
    button_kind: button.querySelector('[class*="icon-taobaojiarugouwuche"]') ? "cart-icon" : "text" };
  if (!result.price || !result.title) return {error:"无法确认商品标题或价格，未加购。"};
  if (action === "mark") {
    // The only marked element is the positively identified add-to-cart button.
    for (const old of document.querySelectorAll('[data-home-taobao-cart]')) old.removeAttribute('data-home-taobao-cart');
    button.setAttribute('data-home-taobao-cart', 'one');
    // Retain the adapter's stable element reference for compatibility.
    button.setAttribute('data-opencli-ref', 'home-taobao-cart-one');
  }
  return result;
}

function successMessages() {
  const phrases = /(成功加入购物车|已加入购物车|加入购物车成功|商品已成功加入购物车|宝贝已成功加入购物车|加购成功)/;
  const found = Array.from(document.querySelectorAll('span, div, p, [role="status"], [role="alert"], [class*="toast"], [class*="message"]'))
    .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
    .map(e => (e.textContent || '').replace(/\s+/g,' ').trim())
    .filter(text => text.length <= 100 && phrases.test(text));
  return [...new Set(found)].sort((a,b)=>a.length-b.length);
}

function cartCount() {
  const candidates = ['#J_MiniCartNum','[class*="cartNum--"]','[class*="cartCount--"]'];
  for (const selector of candidates) {
    const text = (document.querySelector(selector)?.textContent || '').trim();
    if (/^\d+$/.test(text)) return Number(text);
  }
  return null;
}

function clickMarkedCart() {
  const marked = Array.from(document.querySelectorAll('[data-home-taobao-cart="one"]'));
  if (marked.length !== 1) return {error:`加购按钮标记数量为 ${marked.length}，未点击。`};
  const el = marked[0];
  const style = getComputedStyle(el);
  if (!el.getClientRects().length || style.visibility === 'hidden' || style.display === 'none' || el.disabled || el.getAttribute('aria-disabled') === 'true')
    return {error:'加购按钮当前不可用，未点击。'};
  // New Tmall pages can visually receive a CDP mouse event without running
  // their delegated add-cart handler. Invoke this validated button once.
  el.click();
  return {click_method:'dom',hit:'target'};
}

function postClickState() {
  const body = document.body?.innerText || '';
  let count = null;
  for (const selector of ['#J_MiniCartNum','[class*="cartNum--"]','[class*="cartCount--"]']) {
    const text = (document.querySelector(selector)?.textContent || '').trim();
    if (/^\d+$/.test(text)) { count = Number(text); break; }
  }
  const checks = [
    ['login',/请登录|登录后/],['captcha',/验证码|滑块验证|安全验证/],
    ['busy',/操作太频繁|系统繁忙|稍后再试/],['network',/网络异常|请求失败/],
    ['choose',/请选择[^\n]{0,30}(规格|颜色|款式)/],['cart_text',/去购物车结算|查看购物车/]
  ];
  return {count,signals:checks.filter(([,re])=>re.test(body)).map(([name])=>name)};
}

function validate(id, spec = "") {
  if (typeof id !== "string" || !/^\d{5,24}$/.test(id)) throw new Error("商品 ID 必须是 5–24 位数字。");
  if (typeof spec !== "string" || spec.length > 200 || /^[\s]*-/.test(spec) || /[\x00-\x1f\x7f]/.test(spec)) throw new Error("规格格式不正确。");
  return { id, spec: spec.trim() };
}

async function runAdapter(page, args) {
  const {id, spec} = validate(String(args.id || ""), args.spec || "");
  const evaluate = (fn, ...a) => page.evaluate(`(${fn.toString()})(${a.map(x => JSON.stringify(x)).join(',')})`);
  let current=await page.evaluate('location.href');if(current&&typeof current==='object'&&'data'in current)current=current.data;
  let same=false;try{const u=new URL(current);same=['item.taobao.com','detail.tmall.com'].includes(u.hostname)&&u.searchParams.get('id')===id;}catch{}
  if(!same){await page.goto(`https://item.taobao.com/item.htm?id=${id}`);await page.wait(6);}
  const selected = await evaluate(pageActions, "select", spec);
  if (selected.error) throw new Error(selected.error);
  await page.wait(1);
  const snapshot = await evaluate(pageActions, "mark", spec);
  if (snapshot.error) throw new Error(snapshot.error);
  if (snapshot.item_id !== id) throw new Error("页面商品 ID 不符，未加购。");
  if (args['max-price'] !== undefined) {
    const maximum=Number(args['max-price']),actual=Number(String(snapshot.price).replace(/^[￥¥]\s*/,''));
    if(!Number.isFinite(maximum)||maximum<=0||!Number.isFinite(actual)||actual<=0||actual>maximum)throw new Error('实际规格价格超过预算或无法确认，未加购。');
  }
  if (args['dry-run']) return [{status:"dry-run", ...snapshot}];
  if ((await evaluate(successMessages)).length) throw new Error("页面已有成功提示，不能区分本次操作；已停止，未重复点击。");
  const countBefore = await evaluate(cartCount);
  // Invoke the uniquely marked, visible and enabled cart button exactly once.
  const clickResult = await evaluate(clickMarkedCart);
  if (clickResult?.error) throw new Error(clickResult.error);
  const clickMethod = ['cdp','js','dom'].includes(clickResult?.click_method) ? clickResult.click_method : 'unknown';
  const clickHit = ['target','ancestor','other'].includes(clickResult?.hit) ? clickResult.hit : 'unknown';
  for (let i=0; i<12; i++) {
    await page.wait(0.5);
    const messages = await evaluate(successMessages);
    if (messages.length) return [{status:"success", ...snapshot, evidence:messages[0]}];
    const countAfter = await evaluate(cartCount);
    if (Number.isInteger(countBefore) && Number.isInteger(countAfter) && countAfter > countBefore)
      return [{status:"success", ...snapshot, evidence:`购物车数量从 ${countBefore} 增加到 ${countAfter}`}];
  }
  const post = await evaluate(postClickState);
  const signals = Array.isArray(post?.signals) && post.signals.length ? ` 页面信号：${post.signals.join(',')}` : '';
  return [{status:"unknown", ...snapshot, evidence:`已点击一次，但没有读到明确成功提示；购物车数量 ${countBefore ?? '未知'}→${post?.count ?? '未知'}。 点击方式：${clickMethod}，落点：${clickHit}。${signals} 请检查购物车，不要自动重试。`}];
}

module.exports = {pageActions, successMessages, cartCount, clickMarkedCart, postClickState, validate, runAdapter};
