import {integerValue} from './validation.mjs?v=amount-images-20261031';
export {integerValue};
// Shared order and stable IDs for charts, settings and future allocation adapters.
export const ABILITIES = Object.freeze([
  { id: 'physique', name: '體魄', definition: '身體健康、體力、協調與身體照護。', examples: ['運動', '伸展', '睡眠管理', '飲食照護'] },
  { id: 'wisdom', name: '智慧', definition: '知識理解、邏輯思考、問題解決與技能學習。', examples: ['閱讀', '進修', '研究', '程式練習', '分析問題'] },
  { id: 'charisma', name: '魅力', definition: '溝通表達、人際互動、協作與建立關係的能力。不以外貌、受歡迎程度或他人是否認同作為評分依據。', examples: ['練習表達', '主動交流', '協作', '維繫關係'] },
  { id: 'resilience', name: '韌性', definition: '面對困難時的持續投入、情緒調節，以及挫折後的恢復與調適。合理休息、求助與調整方法也可能屬於韌性，不鼓勵硬撐或過度消耗。', examples: ['克服拖延', '持續練習', '調適挫折', '建立界線'] },
  { id: 'perception', name: '感知', definition: '對自身、他人與環境的觀察、覺察及細節感受。', examples: ['情緒日記', '正念練習', '藝術欣賞', '觀察自然', '傾聽'] },
].map(a => Object.freeze({ ...a, examples: Object.freeze(a.examples) })));
export const ALLOCATION_PRINCIPLES = Object.freeze([
  '依行動的實際內容與投入判斷，不只比對關鍵字。',
  '同一行動可分配給一項或多項能力，不必每次涵蓋五項。',
  '韌性著重應對與恢復；感知著重觀察與覺察，避免混為一談。',
  '能力值代表累積投入，不是對人格、健康或真實能力的診斷與評分。',
  '獎勵總點數由各功能的獎勵規則提供，AI 只分配至能力，各能力分配量加總必須等於該次獎勵總點數。',
]);
export const VALUE_RULES = Object.freeze({ initialValue: 0, initialLevel: 1, minimumExperience: 100, experiencePerLevel: 100, growth: Object.freeze({ experienceMultiplier: 1, currencyMultiplier: 1, abilityAllocationMustEqualReward: true, description: '貨幣增加量 = 總經驗值增加量 = 五項能力增加量合計' }), manual: '能力差額增減內部總經驗，最低 100；畫面經驗為內部總經驗減 100；手動等級至少 1，先設等級 × 100 再套用能力差額；貨幣獨立修改', spending: '只扣貨幣且不得低於 0', activityRewards: null });
export const levelFromExperience = experience => Math.max(VALUE_RULES.initialLevel, Math.floor(experience / VALUE_RULES.experiencePerLevel));
export const visibleExperience = experience => Math.max(0, (experience ?? VALUE_RULES.minimumExperience) - VALUE_RULES.minimumExperience);
// Old rule versions are reset once by the store, not reinterpreted here.
export function normalizeStats(stats = {}) {
  if(Object.hasOwn(stats,'currencyEarned')&&(!Number.isSafeInteger(stats.currencyEarned)||stats.currencyEarned<0))throw new Error('累積取得貨幣須為非負安全整數。');
  const experience = Math.max(VALUE_RULES.minimumExperience, stats.experience ?? VALUE_RULES.minimumExperience);
  const previous = stats.abilities ?? [];
  const abilities = ABILITIES.map(a => ({ id: a.id, name: a.name, value: previous.find(x => x.id === a.id || x.name === a.name)?.value ?? 0 }));
  const unknown = previous.filter(x => !ABILITIES.some(a => a.id === x.id || a.name === x.name));
  // Current-version loads preserve snapshots; only actual edits recalculate levels.
  // Extra offset data is inert and removed when experience or abilities change.
  const level = Number.isSafeInteger(stats.level) && stats.level >= VALUE_RULES.initialLevel ? stats.level : levelFromExperience(experience);
  const result = { ...stats, experience, level, currency: stats.currency ?? 0, currencyEarned: stats.currencyEarned ?? stats.currency ?? 0, abilities };
  if (unknown.length) result.legacyAbilities = [...(stats.legacyAbilities ?? []), ...unknown];
  return result;
}
export const createInitialStats = () => normalizeStats();
// Full transactions validate data without applying reward or spending rules.
export function validateStats(value, current) {
  integerValue(value.experience ?? VALUE_RULES.minimumExperience, 'experience');
  integerValue(value.level ?? VALUE_RULES.initialLevel, 'level');
  if(value.level<VALUE_RULES.initialLevel||value.experience<VALUE_RULES.minimumExperience)throw new Error('等級最低為 1，內部經驗最低為 100。');
  const stats = normalizeStats(value);
  integerValue(stats.currencyEarned, 'currencyEarned'); integerValue(stats.experience, 'experience'); integerValue(stats.currency, 'currency'); integerValue(stats.level, 'level');
  if (current && stats.experience !== current.experience) {
    stats.level = levelFromExperience(stats.experience);
    delete stats.levelOffset;
  }
  stats.abilities.forEach(a => integerValue(a.value, a.id));
  return stats;
}
export function validateManualStats(values, current = {}) {
  const stats = normalizeStats(current);
  const currency = integerValue(values.currency, 'currency');
  const level = integerValue(values.level, 'level');
  if(level < VALUE_RULES.initialLevel){const error=new Error('等級最低為 1。');error.field='level';throw error;}
  const abilities = stats.abilities.map(ability => ({ ...ability, value: Object.hasOwn(values, ability.id) ? integerValue(values[ability.id], ability.id) : ability.value }));
  const changed = abilities.filter((ability,i) => ability.value !== stats.abilities[i].value);
  // BigInt keeps signed sums exact even when several individually safe values change.
  const delta = abilities.reduce((sum,ability,i) => sum + BigInt(ability.value) - BigInt(stats.abilities[i].value), 0n);
  // Apply an edited level first, then the net ability delta from the same draft.
  const signedExperience = (level !== stats.level ? BigInt(level) * 100n : BigInt(stats.experience)) + delta;
  const experience = signedExperience < BigInt(VALUE_RULES.minimumExperience) ? BigInt(VALUE_RULES.minimumExperience) : signedExperience;
  if (experience > BigInt(Number.MAX_SAFE_INTEGER)) {
    const error = new Error('修改後的總經驗值超出可精確保存的範圍，請降低數值。');
    error.field = level !== stats.level ? 'level' : changed[0]?.id ?? 'level'; throw error;
  }
  if (!changed.length && level === stats.level) return { ...stats, currency };
  const result = { ...stats, currency, abilities, experience: Number(experience), level: levelFromExperience(Number(experience)) };
  delete result.levelOffset;
  return result;
}
