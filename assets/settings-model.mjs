import './appearance-core.js?v=drive-transfer-20261104';
export const {DEFAULT_APPEARANCE,DEFAULT_SETTINGS,FONT_NAMES,normalizeSettings,applyCompanionDisplay,validHex,luminance,themeTokens,applyAppearance}=globalThis.LifeAppearance;

export function greetingPageEnabled(settings,page){return settings?.companionDisplay?.greetingPages?.[page]!==false;}
