import './appearance-core.js?v=storage-quota-20261106';
export const {DEFAULT_APPEARANCE,DEFAULT_SETTINGS,FONT_NAMES,normalizeSettings,applyCompanionDisplay,validHex,luminance,themeTokens,applyAppearance}=globalThis.LifeAppearance;

export function greetingPageEnabled(settings,page){return settings?.companionDisplay?.greetingPages?.[page]!==false;}
