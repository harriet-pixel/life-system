import {distribution} from './habits-model.mjs';
// Tolerate presentation wrappers, never alter, round or invent reward numbers.
export function parseHabitAllocation(text,points){if(typeof text!=='string')throw new Error('AI 沒有回傳能力分配。');const raw=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');let value;try{value=JSON.parse(raw);}catch{throw new Error('AI 回傳不是完整 JSON；請重新評估。');}return distribution(value.abilities??value,points);}
