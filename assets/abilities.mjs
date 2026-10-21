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
export const VALUE_RULES = Object.freeze({ initialValue: 0, experiencePerLevel: 100, growth: Object.freeze({ experienceMultiplier: 1, currencyMultiplier: 1, abilityAllocationMustEqualReward: true, description: '貨幣增加量 = 總經驗值增加量 = 五項能力增加量合計' }), manual: '各數值獨立修改；等級僅由經驗值計算', spending: '只扣貨幣且不得低於 0', activityRewards: null });
export const levelFromExperience = experience => Math.floor(experience / VALUE_RULES.experiencePerLevel);
export function integerValue(value, field) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) {
    const error = new Error('請填寫非負整數（可填 0），不可留白、填負數或小數。'); error.field = field; throw error;
  }
  return Number(text);
}
// Only missing legacy values become zero; existing values and unknown data stay.
export function normalizeStats(stats = {}) {
  const experience = stats.experience ?? 0;
  const previous = stats.abilities ?? [];
  const abilities = ABILITIES.map(a => ({ id: a.id, name: a.name, value: previous.find(x => x.id === a.id || x.name === a.name)?.value ?? 0 }));
  const unknown = previous.filter(x => !ABILITIES.some(a => a.id === x.id || a.name === x.name));
  const result = { ...stats, experience, level: levelFromExperience(experience), currency: stats.currency ?? 0, abilities };
  if (unknown.length) result.legacyAbilities = [...(stats.legacyAbilities ?? []), ...unknown];
  return result;
}
export function validateManualStats(values, current = {}) {
  const experience = integerValue(values.experience, 'experience');
  const currency = integerValue(values.currency, 'currency');
  return { ...current, experience, currency, level: levelFromExperience(experience), abilities: ABILITIES.map(a => ({id:a.id,name:a.name,value:integerValue(values[a.id],a.id)})) };
}
