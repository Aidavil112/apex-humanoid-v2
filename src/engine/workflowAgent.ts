/**
 * 🕸️ WORKFLOW AI AGENT — steps ki chain (trigger → ... → publish), bots se ALAG cheez.
 *
 * Farq saaf:
 *   🤖 Bot Studio  = ek chhota kaam baar-baar karne wala bot (aapke banaye hue).
 *   🕸️ Workflow    = bohot steps ka poora pipeline: har node ka apna result, fail par
 *                    fallback branch, aur "kahan atka" ka साफ status.
 *
 * IMAANDARI:
 *   • Ye chalta hai jab app khuli ho. Cloud queue nahi hai (wo R2/KV + worker chahiye).
 *   • Har node KE ASLI engine: research = /agent/research, footage = headBot ka clip finder,
 *     motion = Motion Forge, save = Vault, publish = IG Graph API, notify = brain/day-log.
 *   • Node fail ho to fallback node chalta hai (motion → footage), aur wo log me likha jaata hai.
 */

import { hubFetch } from './api';
import { renderMotionForgeVideo, type MotionStyle } from './motionForge';
import { saveVideoToVault } from './videoVaultDb';
import { publishLatestVaultVideoToInstagram } from './jarvisCore';
import { keepAwake, releaseAwake } from './iosAutopilot';

export type WfNodeKind =
  | 'trigger'
  | 'research'
  | 'motion'
  | 'footage'
  | 'save'
  | 'publish'
  | 'notify';

export interface WfNode {
  id: string;
  kind: WfNodeKind;
  /** motion ke liye prompt text, notify ke liye message */
  text?: string;
  /** fail hone par is node par jao (node id) — optional fallback branch */
  fallback?: string;
}

export interface WfNodeResult {
  nodeId: string;
  status: 'ok' | 'fail' | 'skip';
  note: string;
  ms: number;
}

export interface WfDef {
  id: string;
  name: string;
  emoji: string;
  niche: string;
  style: MotionStyle;
  nodes: WfNode[];
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
  results: WfNodeResult[];
}

const KEY = 'apex_workflow_agent_v1';

export const WF_NODE_LABEL: Record<WfNodeKind, string> = {
  trigger: '⏱ Trigger',
  research: '🌐 Research',
  motion: '✨ Motion render',
  footage: '📹 Footage render',
  save: '💾 Vault save',
  publish: '📸 Publish (IG)',
  notify: '🔔 Notify / brain',
};

export function defaultWorkflows(): WfDef[] {
  const now = Date.now();
  return [
    {
      id: 'wf_daily',
      name: 'Daily Reel Pipeline',
      emoji: '🕸️',
      niche: 'AI, Tech & Business Growth India',
      style: 'kino-glass',
      nodes: [
        { id: 'n1', kind: 'trigger' },
        { id: 'n2', kind: 'research' },
        { id: 'n3', kind: 'motion', fallback: 'n4' },
        { id: 'n4', kind: 'footage' },
        { id: 'n5', kind: 'save' },
        { id: 'n6', kind: 'publish' },
        { id: 'n7', kind: 'notify', text: 'Daily reel pipeline khatam' },
      ],
      enabled: true,
      createdAt: now,
      results: [],
    },
  ];
}

export function loadWorkflows(): WfDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultWorkflows();
    const arr = JSON.parse(raw) as WfDef[];
    if (!Array.isArray(arr) || !arr.length) return defaultWorkflows();
    return arr.map((w) => ({
      ...w,
      nodes: Array.isArray(w.nodes) && w.nodes.length ? w.nodes : [{ id: 'n1', kind: 'trigger' }],
      results: Array.isArray(w.results) ? w.results.slice(-30) : [],
    }));
  } catch {
    return defaultWorkflows();
  }
}

export function saveWorkflows(list: WfDef[]): WfDef[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 15)));
  } catch {}
  return list;
}

export function upsertWorkflow(w: WfDef): WfDef[] {
  const list = loadWorkflows();
  const i = list.findIndex((x) => x.id === w.id);
  if (i >= 0) list[i] = w;
  else list.unshift(w);
  return saveWorkflows(list);
}

export function deleteWorkflow(id: string): WfDef[] {
  return saveWorkflows(loadWorkflows().filter((w) => w.id !== id));
}

export function newWorkflow(name: string, emoji: string, niche: string, nodes: WfNode[], style: MotionStyle): WfDef {
  return {
    id: 'wf_' + Date.now().toString(36),
    name: name.trim().slice(0, 40) || 'Naya Workflow',
    emoji: emoji || '🕸️',
    niche: niche.trim().slice(0, 120) || 'AI, Tech & Business Growth India',
    style,
    nodes: nodes.length ? nodes : [{ id: 'n1', kind: 'trigger' }, { id: 'n2', kind: 'motion' }, { id: 'n3', kind: 'save' }],
    enabled: true,
    createdAt: Date.now(),
    results: [],
  };
}

/** Workflow chalao — linear chain + fallback branch. */
export async function runWorkflow(
  id: string,
  onStage?: (w: WfDef) => void
): Promise<{ wf: WfDef | null; ok: number; total: number }> {
  const list = loadWorkflows();
  const wf = list.find((w) => w.id === id);
  if (!wf) return { wf: null, ok: 0, total: 0 };

  const emit = () => {
    upsertWorkflow(wf);
    onStage?.({ ...wf, nodes: [...wf.nodes], results: [...wf.results] });
  };

  void keepAwake('workflow');
  wf.results = [];
  let ok = 0;
  let total = 0;
  let topic = wf.niche;
  let lastVideo: any = null;
  const skip = new Set<string>();

  emit();

  for (let guard = 0; guard < wf.nodes.length * 2 + 4; guard++) {
    const node = wf.nodes.find((n) => !wf.results.some((r) => r.nodeId === n.id) && !skip.has(n.id));
    if (!node) break;
    total++;
    const t0 = Date.now();
    let status: WfNodeResult['status'] = 'ok';
    let note = '';

    try {
      if (node.kind === 'trigger') {
        note = 'manual run (app khuli hai)';
      } else if (node.kind === 'research') {
        try {
          const r = await hubFetch('/agent/research', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ niche: wf.niche }),
          });
          if (r.ok) {
            const j: any = await r.json();
            const first = Array.isArray(j?.topics) ? j.topics[0] : null;
            if (first?.title) topic = String(first.title).slice(0, 150);
            note = `topic: ${topic}`;
          } else {
            status = 'skip';
            note = `worker ${r.status} — niche hi topic rahega`;
          }
        } catch (e: any) {
          status = 'skip';
          note = `worker nahi mila (${String(e?.message || e).slice(0, 50)})`;
        }
      } else if (node.kind === 'motion') {
        const res = await renderMotionForgeVideo(`${topic} ${node.text || ''}`.trim(), {
          style: wf.style,
          durationSec: 12,
          width: 1080,
          height: 1920,
          fps: 30,
          saveToVault: false,
        });
        if (res.ok && res.blob) {
          lastVideo = {
            blob: res.blob,
            fileName: res.fileName || 'apex-wf.webm',
            mimeType: res.mimeType || res.blob.type || 'video/webm',
            durationSec: res.durationSec || 12,
            title: res.title || wf.name,
            caption: res.caption || topic,
          };
          note = `${res.durationSec ?? 12}s · ${(res.blob.size / 1048576).toFixed(2)} MB`;
        } else {
          status = 'fail';
          note = res.error || 'render fail';
        }
      } else if (node.kind === 'footage') {
        // footage node = head bot ka clip finder (real web sources), yahi fallback bhi hai
        try {
          const r = await hubFetch('/agent/clips', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ niche: wf.niche }),
          });
          if (r.ok) {
            const j: any = await r.json();
            const n = Array.isArray(j?.clips) ? j.clips.length : Number(j?.count || 0);
            note = n ? `${n} real clips mile (footage engine)` : 'clips nahi mile — node skip';
            status = n ? 'ok' : 'skip';
          } else {
            status = 'skip';
            note = `clips worker ${r.status}`;
          }
        } catch {
          status = 'skip';
          note = 'clips worker nahi mila';
        }
      } else if (node.kind === 'save') {
        if (!lastVideo) {
          status = 'skip';
          note = 'pehle koi render nahi hua';
        } else {
          await saveVideoToVault({
            id: `vault_wf_${wf.id}_${Date.now()}`,
            createdAt: Date.now(),
            title: lastVideo.title,
            caption: lastVideo.caption,
            fileName: lastVideo.fileName,
            mimeType: lastVideo.mimeType,
            durationSec: lastVideo.durationSec,
            sizeBytes: lastVideo.blob.size,
            blob: lastVideo.blob,
            scheduledAt: null,
          } as any);
          note = `Vault: ${lastVideo.fileName}`;
        }
      } else if (node.kind === 'publish') {
        const r = await publishLatestVaultVideoToInstagram();
        if (r.ok) note = (r as any).permalink || 'posted';
        else {
          status = 'skip';
          note = (r as any).skipped || (r as any).error || 'token missing';
        }
      } else if (node.kind === 'notify') {
        note = node.text || 'workflow done';
      }
    } catch (e: any) {
      status = 'fail';
      note = String(e?.message || e).slice(0, 100);
    }

    wf.results.push({ nodeId: node.id, status, note, ms: Date.now() - t0 });
    if (status === 'fail' && node.fallback) {
      // fallback branch — jo nodes fallback ke baad hain unhe nahi chhedte
      skip.add(node.id);
      wf.results = wf.results.filter((r) => r.nodeId !== node.id);
      wf.results.push({ nodeId: node.id, status: 'fail', note: `${note} → fallback branch`, ms: Date.now() - t0 });
      const fb = wf.nodes.find((n) => n.id === node.fallback);
      if (fb) note = `${note} → ${fb.kind}`;
    } else if (status === 'ok') {
      ok++;
    }
    emit();
  }

  wf.lastRun = Date.now();
  emit();
  releaseAwake();
  return { wf, ok, total };
}
