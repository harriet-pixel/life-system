import './appearance-core.js?v=task-yesterday-20261103';
export const {DEFAULT_APPEARANCE,DEFAULT_SETTINGS,FONT_NAMES,normalizeSettings,applyCompanionDisplay,validHex,luminance,themeTokens,applyAppearance}=globalThis.LifeAppearance;

export function greetingPageEnabled(settings,page){return settings?.companionDisplay?.greetingPages?.[page]!==false;}
