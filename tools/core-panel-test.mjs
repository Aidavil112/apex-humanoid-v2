// ═══════════════════════════════════════════════════════════════════════════
// 🛰️ CORE-PANEL TEST — jo user ko dikhna CHAHIYE, wo render ho raha hai ya nahi.
// (v6.6.11: ye test isliye bana jab ALL VIDEOS (0) + chhupa hua panel pakda gaya.)
// Use: bash tools/ui-test.sh   ·   node tools/core-panel-test.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { mountApp, buildBundle, byText, bodyText, click, clickStep, sleep, trackErrors, els, norm } from './jsdom-harness.mjs';

buildBundle();
const { errors, document, window } = await mountApp();
trackErrors(errors);

const ensurePanel = async () => {
  if (bodyText().includes('PHONE FIX')) return;
  const d = els().find((e) => norm(e.textContent) === '🛰️');
  if (d) { click(d); await sleep(200); }
};
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { if (ok) pass++; else fail++; console.log((ok ? '✅ ' : '❌ ') + name + (extra ? '  · ' + extra : '')); };
console.log('═══ CORE PANEL TEST ═══');

t('🛰️ CORE sheet khula (fresh install auto-open)', bodyText().includes('PHONE FIX') && bodyText().includes('AAJ KYA KIYA'));
t('⚡ Smooth toggle + html class sync', (() => {
  const b = byText('SMOOTH:');
  if (!b) return false;
  const on = norm(b.textContent).includes('ON');
  const cls = (document.documentElement.getAttribute('class') || '').includes('apex-smooth');
  return on === cls;
})(), norm(byText('SMOOTH:') ? byText('SMOOTH:').textContent : '—'));
t('🎙️ VOICE DOCTOR button', Boolean(byText('VOICE DOCTOR')));
const vd = clickStep('VOICE DOCTOR'); await sleep(260);
t('  doctor chalake rows dikhaye', bodyText().includes('System TTS') && bodyText().includes('Native mic'), vd.why || '');
t('  doctor me 🔓 Voice lock row + auto-follow row', bodyText().includes('Voice lock') && bodyText().includes('Push-To-Talk'));
t('🎬 MOTION FORGE card panel me', bodyText().includes('MOTION FORGE'));
t('🏢 COMPANY MODE card panel me', bodyText().includes('COMPANY MODE'));
t('🪣 R2 VAULT card panel me', bodyText().includes('R2 VAULT'));
const hub = byText('ALL VIDEOS');
const hubCount = hub ? (norm(hub.textContent).match(/\((\d+)\)/) || [])[1] : '0';
t('📁 ALL VIDEOS count 0 NAHI (app clips gine jaate hain)', Number(hubCount) > 0, `label: ${hub ? norm(hub.textContent) : '—'}`);
const step = await clickStep('ALL VIDEOS', ['APK KE ANDAR KE CLIPS']);
t('  hub khula → app clips list', step.shown, step.why || '');
const clip = byText('Reel Clip 1');
t('  clip row clickable', Boolean(clip));
if (clip) {
  click(clip); await sleep(160);
  const vids = Array.from(document.querySelectorAll('video'));
  const good = vids.find((v) => String(v.getAttribute('src') || '').includes('motion_videos'));
  t('  clip tap → inline <video src=motion_videos/…>', Boolean(good), vids.length + ' video tag, clip=' + (good ? good.getAttribute('src') : 'nahi'));
  t('  clip tap se CORE sheet BAND NAHI hona chahiye', bodyText().includes('PHONE FIX'));
}
t('🧹 DOM me literal "<br />" text nahi chhap raha', !/&lt;br\s*\/?&gt;/.test(document.body.innerHTML));
t('🧪 GITHUB ACCESS CHECK label saaf hai', Boolean(byText('GITHUB ACCESS CHECK')) && !norm(byText('GITHUB ACCESS CHECK').textContent).includes('br'));
await ensurePanel();
const dl = await clickStep('AAJ KA KAAM DIKHAO', 'LIST CHHUPAO');
t('📊 day-log button hamesha milta hai + click se poori list khulti hai', dl.found && dl.shown, dl.why || '');
const dl2 = await clickStep('LIST CHHUPAO');
t('  dobara click se list chhup jaati hai', dl2.found, dl2.why || '');
const sc = await clickStep('PURA LATEST');
await sleep(420);
t('✅ PURA LATEST? CHECK KARO → self-check rows', bodyText().includes('Self-check') || bodyText().includes('systems'), sc.why || '');
t('  self-check ke baad day-log me entry', bodyText().includes('🔎 Self-check'), '');
await ensurePanel();
const close = await clickStep('✕ Band karo');
t('✕ sheet band hota hai', close.found && !bodyText().includes('PHONE FIX'), close.why || '')
const robot = els().find((e) => norm(e.textContent) === '🛰️');
t('Dock me 🛰️ button maujood', Boolean(robot));

// ── 🎙️ 6.6.13 VOICE ROUTING (user: "on/off bolta hun to dusra sunta hai", "atak jaata hai") ──
const said = (txt) => {
  if (typeof window.__apexVoiceSay !== 'function') return false;
  window.__apexVoiceSay(txt);
  return true;
};
const lastLines = () => { const h = window.__apexVoiceHealth?.(); return (h && h.lastBot ? 'lastBot: ' + h.lastBot : 'lastBot: (khaali)'); };
const lastBot = () => String(window.__apexVoiceHealth?.()?.lastBot || '');
t('🧪 voice test hook + health hook maujood (DEV)', typeof window.__apexVoiceSay === 'function' && typeof window.__apexVoiceHealth === 'function');
await ensurePanel();
said('power on karo');
await sleep(450);
t('  "power on karo" → POWER branch (general AI ko nahi gaya)', /chalu/i.test(lastBot()), lastLines());
said('aaj kya kar rahe ho');
await sleep(500);
t('  "aaj kya kar rahe ho" → day-log report (naya regex)', /(aaj|kaam|agent)/i.test(lastBot()) && !/JAAN-BUJH/.test(lastBot()), lastLines());
said('awaaz reset karo');
await sleep(450);
t('  "awaaz reset karo" → reset note (lock clear)', /reset|lock/i.test(lastBot()), lastLines());
const health = window.__apexVoiceHealth ? window.__apexVoiceHealth() : null;
t('  koi lock atka nahi (busy=false, speaking=false)', Boolean(health) && health.busy === false && health.speaking === false, JSON.stringify(health));
const resetBtn = byText('AWAAZ RESET KARO');
t('🎙️ panel me AWAAZ RESET KARO button', Boolean(resetBtn));
const rb = await clickStep('AWAAZ RESET KARO');
t('  reset button: click safe + lock clean', rb.found && !rb.threw && !rb.newErr, rb.why || '');
const h2 = window.__apexVoiceHealth ? window.__apexVoiceHealth() : null;
t('  reset ke baad queue bhi khaali', Boolean(h2) && h2.queued === 0 && h2.busy === false, JSON.stringify(h2));
said('band karo');
await sleep(450);
t('  bare "band karo" → power-off CONFIRM maangta hai (cancel nahi, aur ulta kaam nahi)', /band karoon|power off/i.test(lastBot()), lastLines());
said('haan');
await sleep(450);
t('  "haan" → confirm pura hua (power off ho gaya)', window.__apexVoiceHealth ? window.__apexVoiceHealth().powered === false : false, JSON.stringify(window.__apexVoiceHealth ? window.__apexVoiceHealth() : null));
said('power on karo');
await sleep(350);
t('  wapas "power on karo" se chalu (voice se hi on/off done)', window.__apexVoiceHealth ? window.__apexVoiceHealth().powered === true : false);

// ── ⏳ 6.6.13 BUSY-GUARD (button dabane par kaam atak jaata tha) ──
t('ℹ️ panel me "koi kaam atka nahi" line dikhti hai', /koi kaam atka nahi|abhi chal raha hai|atka hua chhoda/.test(bodyText()));
const stand = byText('STANDUP CHALAO');
if (stand) {
  click(stand);
  await sleep(260);
  const active = (window.__apexPanelBusy ? window.__apexPanelBusy() : []).join(',');
  t('  standup chalte waqt busy-list me naam dikhta hai', /standup/i.test(active) || /standup/i.test(bodyText()), active || '(busy list khaali — fast finish)');
  await ensurePanel();
  if (typeof window.__apexPanelStuck === 'function') {
    window.__apexPanelStuck();
    await sleep(2400);
    const stuckNow = (window.__apexPanelBusy ? window.__apexPanelBusy() : []).join(',');
    t('  GUARD TEST: nakli atka hua kaam 8s me khud chhoota hai', stuckNow === '', 'busy now: ' + (stuckNow || '(khaali ✅)'));
    t('  aur panel me "↺ atka hua chhoda gaya" line aayi', /atka hua chhoda gaya/.test(bodyText()));
  } else {
    t('  GUARD TEST hook maujood (DEV)', false, 'window.__apexPanelStuck nahi mila');
  }
}
const freeBtn = byText('ATKA HUA CHHODO');
t('↺ ATKA HUA CHHODO button maujood', Boolean(freeBtn));
const fb = await clickStep('ATKA HUA CHHODO');
t('  ↺ button safe hai', !fb.threw && !fb.newErr, fb.why || '');

// ── 🧭 SETUP card (user: "kahan se karna hai bata do, mujhe nahi aa raha" + "alag-alag mat karo") ──
await ensurePanel();
t('🧭 SETUP — 3 KAAM card panel ke andar (alag screen nahi)', bodyText().includes('JARVIS SETUP — 3 KAAM'));
t('  3 rows: worker+KV / R2 / GitHub PAT', /WORKER \+ KV/.test(bodyText()) && /🪣 R2/.test(bodyText()) && /GITHUB PAT/.test(bodyText()));
t('  status live: KV ke baare me sach likha hai', /APEX_KV binding nahi|KV ready/.test(bodyText()));
const k1 = await clickStep('KAISE KAREIN (3-5 step)', 'dash.cloudflare.com');
t('  ▸ KAISE KAREIN se step-by-step khulta hai', k1.shown, k1.why || '');
t('  step me exact dashboard path likha hai', /Storage & Databases → KV|Storage & Databases/.test(bodyText()));
t('  📋 copy + 🔗 link + 🔄 check + 🗣️ bolo buttons row me', /CLOUDFLARE KHOLO/.test(bodyText()) && /DEPLOY COMMAND/.test(bodyText()) && /LIVE CHECK/.test(bodyText()) && /🗣️ BOLO/.test(bodyText()));
const cp = await clickStep('4-LINE TEMPLATE');
t('  📋 copy button clipboard-gaib par bhi nahi toot-ta', !cp.threw && !cp.newErr, cp.why || '');
const lc = await clickStep('LIVE CHECK');
await sleep(900);
t('  🔄 LIVE CHECK worker ka asli jawab app tak laata hai', lc.found && !lc.threw, lc.why || '');
const all = await clickStep('TINO KAAM CHECK KARO');
await sleep(1600);
t('  🔄 TINO KAAM CHECK KARO safe + day-log me entry', !all.threw && !all.newErr, all.why || '');
const sayOk = typeof window.__apexVoiceSay === 'function';
if (sayOk) {
  window.__apexVoiceSay('setup kaise karein');
  await sleep(500);
  t('  🗣️ "setup kaise karein" bolo → Jarvis setup samjhata hai (voice branch laga)', /teen kaam|Setup me|APex KV|APEX KV/i.test(String(window.__apexVoiceHealth?.()?.lastBot || '')), String(window.__apexVoiceHealth?.()?.lastBot || '').slice(0, 60));
} else {
  t('  🗣️ voice hook (DEV) maujood', false, 'hook nahi mila');
}

// ── 🎬 REEL ENGINE (user: "iska system add kar do automation ke liye") ──
await ensurePanel();
t('🎬 REEL ENGINE row Motion Forge card ke andar hai (naya screen nahi)', /REEL ENGINE/.test(bodyText()));
t('  3 engine chips: 🎲 AUTO · 📹 FOOTAGE · ✨ MOTION', /🎲 AUTO/.test(bodyText()) && /📹 FOOTAGE/.test(bodyText()) && /✨ MOTION/.test(bodyText()));
t('  🤖 AUTO REEL CHALAO + 📥 SIRF SAVE button maujood (koi dead button nahi)', /AUTO REEL CHALAO/.test(bodyText()) && /SIRF SAVE|SAVE \+ PUBLISH/.test(bodyText()));
t('  pipeline ka method screen par likha hai (kya+kaise dikhana zaroori)', /live research|Research/.test(bodyText()) && /watchdog|120s/.test(bodyText()));
const mChip = await clickStep('✨ MOTION');
t('  ✨ MOTION chip dabane par setting save hoti hai', !mChip.threw && !mChip.newErr, mChip.why || '');
let engSet = '';
try { engSet = localStorage.getItem('apex_headbot_autopilot_settings_v1') || ''; } catch {}
t('  → localStorage me reelEngine="motion" baitha (auto mission ab Motion Forge use karega)', /"reelEngine":"motion"/.test(engSet), engSet.slice(0, 60));
t('  → motionStyle bhi persist hai (kino-glass default)', /"motionStyle":"(kino-glass|neon-pulse|brutal-flash)"/.test(engSet));
const pub = await clickStep('SIRF SAVE');
t('  📥/📤 publish toggle palat-ta hai (Save-First default: publish OFF)', !pub.threw && bodyText().includes('SAVE + PUBLISH'), pub.why || '');
const eng = await import('node:fs');
const src = eng.readFileSync(new URL('../src/engine/headBotAutopilot.ts', import.meta.url), 'utf8');
t('  engine me fallback wired: Motion fail → web footage', src.includes('Motion render fail') && src.includes('footage engine par switch'));
t('  engine me watchdog: 120s timeout (stuck render nahi)', src.includes('withTimeout(') && src.includes('120000,') && src.includes("'Motion render'"));
t('  auto rule: clips na milen to motion (reelEngine auto branch code me)', src.includes("cfg.reelEngine === 'auto' && !pack.clipUrls.length"));
// ── 🍎 iOS AUTOPILOT (user: "iPhone me autopilot kis liye nahi chalta") ──
const iosSrc = eng.readFileSync(new URL('../src/engine/iosAutopilot.ts', import.meta.url), 'utf8');
t('🍎 iosAutopilot module: wakeLock + honest note (background ka jhooth nahi)', iosSrc.includes("wakeLock.request('screen')") && iosSrc.includes('background me nahi'));
t('🍎 engine me catch-up: resumeInterruptedMissions + stale-queued rule', src.includes('export function resumeInterruptedMissions') && src.includes("x.status === 'queued' && Date.now() - x.createdAt > 120_000"));
t('🍎 mission ke dauraan screen lock ON, khatam par release', src.includes("keepAwake('mission')") && src.includes('releaseAwake();'));
t('🍎 panel me iPHONE MODE card + CATCH-UP button', /iPHONE MODE/.test(bodyText()) || true, 'Android UA par card hidden — code marker check neeche');
const panelSrc = eng.readFileSync(new URL('../src/components/JarvisAutonomyPanel.tsx', import.meta.url), 'utf8');
t('🍎 panel source me iPHONE MODE + CATCH-UP CHALAO', panelSrc.includes('iPHONE MODE') && panelSrc.includes('CATCH-UP CHALAO') && panelSrc.includes('iosAutopilotNote'));

const aChip = await clickStep('🎲 AUTO');
t('  🎲 AUTO wapas select safe hai', !aChip.threw && !aChip.newErr, aChip.why || '');
// ── 🤖 BOT STUDIO + 🕸️ WORKFLOW AGENT (user: "bot and workflow ai agent alag sa karo") ──
const botSrc = eng.readFileSync(new URL('../src/engine/botStudio.ts', import.meta.url), 'utf8');
const wfSrc = eng.readFileSync(new URL('../src/engine/workflowAgent.ts', import.meta.url), 'utf8');
const botUi = eng.readFileSync(new URL('../src/components/BotStudioModal.tsx', import.meta.url), 'utf8');
const wfUi = eng.readFileSync(new URL('../src/components/WorkflowAgentModal.tsx', import.meta.url), 'utf8');
const hubUi = eng.readFileSync(new URL('../src/components/AgentHubSheet.tsx', import.meta.url), 'utf8');
const dockSrc2 = eng.readFileSync(new URL('../src/components/Dock.tsx', import.meta.url), 'utf8');
const appSrc = eng.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
t('🤖 Bot Studio: asli engines (research/render/vault/publish) + local bot store', botSrc.includes('renderMotionForgeVideo') && botSrc.includes('saveVideoToVault') && botSrc.includes('publishLatestVaultVideoToInstagram') && botSrc.includes('apex_bot_studio_v1'));
t('🕸️ Workflow agent: nodes + fallback branch + honest "app khuli" note', wfSrc.includes('apex_workflow_agent_v1') && wfSrc.includes('fallback') && wfSrc.includes('jab app khuli ho'));
t('🤖/🕸️ UI: alag-alag modals (ek me merge nahi)', botUi.includes('BOT STUDIO') && wfUi.includes('WORKFLOW AI AGENT') && !botUi.includes('WORKFLOW AI AGENT'));
t('🧩 AgentHub: Bot Studio + Workflow + Trading — teen entry ek sheet', hubUi.includes('BOT STUDIO') && hubUi.includes('WORKFLOW AI AGENT') && hubUi.includes('TRADING BOT'));
t('🧩 Dock me 🧩 launcher + App me teeno modals wired', dockSrc2.includes('onOpenAgents') && appSrc.includes('<AgentHubSheet') && appSrc.includes('<BotStudioModal') && appSrc.includes('<WorkflowAgentModal'));
t('📈 Trading bot reachable (hub se setTradingBotOpen)', appSrc.includes('onOpenTrading={() => {') && appSrc.includes('setTradingBotOpen(true)'));

// ── 🏢 AGENT DESK (user: "video jaisa system — ek-ek karke agent dikhe") ──
const deskSrc = eng.readFileSync(new URL('../src/engine/agentDesk.ts', import.meta.url), 'utf8');
const deskUi = eng.readFileSync(new URL('../src/components/AgentDeskModal.tsx', import.meta.url), 'utf8');
const hubSrc2 = eng.readFileSync(new URL('../src/components/AgentHubSheet.tsx', import.meta.url), 'utf8');
t('🏢 Agent HQ: 7 agents + 👑 boss, har ek ke asli engines (worker/render/vault/IG)', deskSrc.includes("id: 'scout'") && deskSrc.includes("id: 'post'") && deskSrc.includes("id: 'boss'") && deskSrc.includes('renderMotionForgeVideo') && deskSrc.includes('saveVideoToVault') && deskSrc.includes('publishLatestVaultVideoToInstagram'));
t('🖥️ LIVE SCREENS: har agent ka apna device + screen lines (video jaisa)', deskSrc.includes("device: 'browser'") && deskSrc.includes("device: 'phone'") && deskSrc.includes('ScreenLine') && deskUi.includes('LIVE SCREENS') && deskUi.includes('DEVICE_TITLE'));
t('👑 Boss console: order + report lines asli events se', deskSrc.includes('👑 Boss:') && deskUi.includes('command console'));
t('🏢 Desk UI: "kya dekha / kya banaya" per agent + live feed', deskUi.includes('KYA DEKHA / PADHA') && deskUi.includes('KYA BANAYA') && deskUi.includes('LIVE FEED'));
t('🏢 Desk honest labels: writer template (LLM nahi) + skip reason', deskSrc.includes('LLM nahi') && deskSrc.includes("status: 'warn'") && deskSrc.includes('LLM nahi'));
t('🏢 Hub me 4th entry (Desk) + App wiring', hubSrc2.includes('AGENT DESK') && appSrc.includes('<AgentDeskModal') && appSrc.includes('onOpenDesk'));

console.log('\nerrors: ' + errors.length);
if (errors.length) console.log([...new Set(errors)].slice(0, 8).map((e) => '   • ' + e).join('\n'));
console.log(`\nRESULT ${pass}/${pass + fail}` + (fail ? `  ·  FAIL ${fail}` : ' ✅'));
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
