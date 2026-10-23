// Shared policy for all present/future real AI entry points. Never mutate source data.
export const AI_LANGUAGE_RULE='預設以繁體中文及臺灣常用詞彙回覆所有面向使用者的文字，包括測試、分析建議、能力分配說明及角色對話。角色個性或風格不得覆蓋此語言規則。JSON 等結構化輸出的欄位名稱、固定代碼與數字格式必須維持程式契約，僅面向使用者的文字採繁體中文。程式碼、網址、模型 ID、必要專有名詞與使用者明確要求保留的原文，不強制翻譯。不要改寫使用者原始資料。';
export const AI_TEST_TEXT='請只回覆「測試成功」。';
export function assembleAIPrompt(text){return Object.freeze({system:AI_LANGUAGE_RULE,user:text});}
