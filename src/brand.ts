import brand from '../brand.json';

export type Lang = 'en' | 'ar';

/** The only place the product name enters the code. Everything else reads from here. */
export const BRAND = {
  name: brand.name,
  nameAr: brand.name_ar ?? brand.name,
  slug: brand.slug,
  tagline: brand.tagline,
  taglineAr: brand.tagline_ar ?? brand.tagline,
} as const;

export function brandName(lang: Lang): string {
  return lang === 'ar' ? BRAND.nameAr : BRAND.name;
}

export function brandTagline(lang: Lang): string {
  return lang === 'ar' ? BRAND.taglineAr : BRAND.tagline;
}

/** Replaces {{brand.*}} placeholders in a localized string. */
export function fillBrand(text: string, lang: Lang): string {
  return text
    .replaceAll('{{brand.name}}', brandName(lang))
    .replaceAll('{{brand.tagline}}', brandTagline(lang));
}

export const STORAGE_KEY = `${BRAND.slug}:profile:v1`;
export const LOG_PREFIX = `[${BRAND.slug}]`;
