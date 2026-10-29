// Presentation only. Saved greetings, replies and chat text stay intact.
export function floatingDialogue(text,limit=40){const value=String(text??''),parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('zh-TW',{granularity:'grapheme'}).segment(value)].map(s=>s.segment):Array.from(value);return parts.length<=limit?value:parts.slice(0,limit-1).join('')+'…';}
