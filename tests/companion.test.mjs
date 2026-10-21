import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanionController, validateReply } from '../assets/companion.mjs';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const action = (id, type = 'task.completed') => ({ type, actionId: id, label: `行動 ${id}` });
const reply = (dialogue, emotion = 'pleased') => ({ dialogue, emotion });
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await pause(5); }
  assert.fail('Timed out waiting for test condition');
}

test('batches rapid successful actions, deduplicates targets, ignores non-success events', async () => {
  const requests = [], rendered = [];
  const c = createCompanionController({ debounceMs: 15, generate: async (r) => { requests.push(r); return reply('合併完成'); }, render: (r) => rendered.push(r) });
  try {
    for (const type of ['scroll', 'mousemove', 'focus', 'menu.opened', 'task.failed', 'task.unchecked']) assert.equal(c.recordSuccess(action('x', type)), false);
    assert.equal(c.recordSuccess(null), false);
    c.recordSuccess(action('1')); c.recordSuccess(action('1')); c.recordSuccess(action('2', 'habit.checked-in'));
    await until(() => rendered.length === 1);
    assert.equal(requests.length, 1); assert.equal(requests[0].actions.length, 2);
    assert.deepEqual(requests[0].context, { character: null, affinity: null });
  } finally { c.dispose(); }
});

test('keeps original dialogue while generating and commits dialogue/emotion together', async () => {
  let resolve; let view = reply('原對話', 'neutral'); const states = [];
  const c = createCompanionController({ debounceMs: 0, generate: () => new Promise((r) => { resolve = r; }), render: (r) => { view = r; }, onStateChange: (s) => states.push(s) });
  try {
    c.recordSuccess(action('1')); await until(() => resolve);
    assert.deepEqual(view, reply('原對話', 'neutral')); assert.equal(states.at(-1), 'generating');
    resolve(reply('新對話', 'calm')); await until(() => states.at(-1) === 'ready');
    assert.deepEqual(view, reply('新對話', 'calm'));
  } finally { c.dispose(); }
});

test('new events invalidate old replies immediately, even during the next debounce', async () => {
  const requests = [], renders = [];
  const c = createCompanionController({ debounceMs: 15, generate: () => new Promise((resolve, reject) => requests.push({ resolve, reject })), render: (r) => renders.push(r) });
  try {
    c.recordSuccess(action('1')); await until(() => requests.length === 1);
    c.recordSuccess(action('2')); requests[0].resolve(reply('過時結果'));
    await pause(5); assert.equal(renders.length, 0);
    await until(() => requests.length === 2); requests[1].resolve(reply('最新結果', 'calm'));
    await until(() => renders.length === 1); assert.deepEqual(renders, [reply('最新結果', 'calm')]);
  } finally { c.dispose(); }
});

test('late old errors cannot replace a newer success with a fallback', async () => {
  const requests = [], renders = [];
  const c = createCompanionController({ debounceMs: 0, generate: () => new Promise((resolve, reject) => requests.push({ resolve, reject })), render: (r) => renders.push(r) });
  try {
    c.recordSuccess(action('1')); await until(() => requests.length === 1);
    c.recordSuccess(action('2')); await until(() => requests.length === 2);
    requests[1].resolve(reply('最新')); await until(() => renders.length === 1);
    requests[0].reject(new Error('舊請求失敗')); await pause(10);
    assert.deepEqual(renders, [reply('最新')]);
  } finally { c.dispose(); }
});

for (const [name, generate] of [
  ['provider rejection', async () => { throw new Error('offline'); }],
  ['unknown emotion', async () => reply('格式錯誤', 'unknown')],
  ['missing dialogue', async () => ({ emotion: 'neutral' })],
  ['timeout', () => new Promise(() => {})],
]) test(`${name} uses a fallback and remains available for later actions`, async () => {
  const rendered = [], states = [];
  let succeed = false;
  const c = createCompanionController({ debounceMs: 0, timeoutMs: 20, generate: (...args) => succeed ? reply('恢復') : generate(...args), render: (r) => rendered.push(r), onStateChange: (s) => states.push(s) });
  try {
    c.recordSuccess(action('1')); await until(() => states.at(-1) === 'fallback');
    assert.equal(rendered[0].emotion, 'neutral'); assert.match(rendered[0].dialogue, /示意操作已完成/);
    succeed = true; c.recordSuccess(action('2')); await until(() => states.at(-1) === 'ready');
    assert.equal(rendered[1].dialogue, '恢復');
  } finally { c.dispose(); }
});

test('passes context without modifying affinity, permits approved role-specific fallback', async () => {
  const context = Object.freeze({ character: null, affinity: null }); let got; let result;
  const c = createCompanionController({ debounceMs: 0, getContext: () => context, generate: async (r) => { got = r.context; throw new Error(); }, fallback: (ctx) => { assert.equal(ctx, context); return reply('經確認的測試備援', 'neutral'); }, render: (r) => { result = r; } });
  try { c.recordSuccess(action('1')); await until(() => result); assert.equal(got, context); assert.deepEqual(context, { character: null, affinity: null }); assert.equal(result.dialogue, '經確認的測試備援'); }
  finally { c.dispose(); }
});

test('dispose cancels pending work and suppresses late results', async () => {
  let resolve; const rendered = [];
  const c = createCompanionController({ debounceMs: 0, generate: () => new Promise((r) => { resolve = r; }), render: (r) => rendered.push(r) });
  c.recordSuccess(action('1')); await until(() => resolve); c.dispose(); resolve(reply('不能顯示'));
  await pause(10); assert.equal(rendered.length, 0); assert.equal(c.recordSuccess(action('2')), false);
});

test('reply validation refuses empty, oversized or partial responses', () => {
  for (const r of [null, {}, reply(' '), reply('x'.repeat(1001)), { dialogue: '文字' }]) assert.throws(() => validateReply(r));
  assert.deepEqual(validateReply(reply(' 正常 ', 'neutral')), reply('正常', 'neutral'));
});
