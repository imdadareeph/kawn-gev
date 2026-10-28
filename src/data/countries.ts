// Owner codes follow the CelesTrak SATCAT. Names are for display; a code with no entry is shown as the raw code.
export const OWNER_NAME: Record<string, { en: string; ar: string }> = {
  US: { en: 'United States', ar: 'الولايات المتحدة' },
  CIS: { en: 'Russia / CIS', ar: 'روسيا / رابطة الدول المستقلة' },
  PRC: { en: 'China', ar: 'الصين' },
  JPN: { en: 'Japan', ar: 'اليابان' },
  IND: { en: 'India', ar: 'الهند' },
  ESA: { en: 'Europe (ESA)', ar: 'أوروبا (وكالة الفضاء الأوروبية)' },
  FR: { en: 'France', ar: 'فرنسا' },
  GER: { en: 'Germany', ar: 'ألمانيا' },
  UK: { en: 'United Kingdom', ar: 'المملكة المتحدة' },
  IT: { en: 'Italy', ar: 'إيطاليا' },
  SPN: { en: 'Spain', ar: 'إسبانيا' },
  CA: { en: 'Canada', ar: 'كندا' },
  UAE: { en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' },
  SAUD: { en: 'Saudi Arabia', ar: 'المملكة العربية السعودية' },
  ARGN: { en: 'Argentina', ar: 'الأرجنتين' },
  AUS: { en: 'Australia', ar: 'أستراليا' },
  BRAZ: { en: 'Brazil', ar: 'البرازيل' },
  EGYP: { en: 'Egypt', ar: 'مصر' },
  IRAN: { en: 'Iran', ar: 'إيران' },
  ISRA: { en: 'Israel', ar: 'إسرائيل' },
  KAZ: { en: 'Kazakhstan', ar: 'كازاخستان' },
  MEX: { en: 'Mexico', ar: 'المكسيك' },
  NKOR: { en: 'North Korea', ar: 'كوريا الشمالية' },
  SKOR: { en: 'South Korea', ar: 'كوريا الجنوبية' },
  TURK: { en: 'Türkiye', ar: 'تركيا' },
  UKR: { en: 'Ukraine', ar: 'أوكرانيا' },
  SING: { en: 'Singapore', ar: 'سنغافورة' },
  INDO: { en: 'Indonesia', ar: 'إندونيسيا' },
  THAI: { en: 'Thailand', ar: 'تايلاند' },
  PAKI: { en: 'Pakistan', ar: 'باكستان' },
  QAT: { en: 'Qatar', ar: 'قطر' },
  ISS: { en: 'International Space Station', ar: 'محطة الفضاء الدولية' },
  NATO: { en: 'NATO', ar: 'حلف الناتو' },
  AB: { en: 'Arab Satellite Org.', ar: 'المنظمة العربية للاتصالات الفضائية' },
  SES: { en: 'SES (Luxembourg)', ar: 'SES (لوكسمبورغ)' },
  ITSO: { en: 'Intelsat', ar: 'إنتلسات' },
  EUTE: { en: 'Eutelsat', ar: 'يوتلسات' },
  GLOB: { en: 'Globalstar', ar: 'غلوبال ستار' },
  IRID: { en: 'Iridium', ar: 'إيريديوم' },
  O3B: { en: 'O3b / SES', ar: 'O3b / SES' },
  UNK: { en: 'Unknown', ar: 'غير معروف' },
};

/** A joint programme counts for every partner, so picking any partner country shows it. */
const PARTNERS: Record<string, string[]> = {
  ISS: ['US', 'CIS', 'JPN', 'ESA', 'CA'],
};

/** Every country filter a code belongs to. */
export function expandOwner(code: string): string[] {
  return PARTNERS[code] ?? [code];
}

export function ownerLabel(code: string, lang: 'en' | 'ar'): string {
  return OWNER_NAME[code]?.[lang] ?? code;
}

/**
 * Countries for one object. Uses the SATCAT owner when the server supplied it, otherwise falls back to what the
 * group or name makes certain (a GPS satellite is American, the ISS is a five-partner programme).
 */
export function ownersFor(owner: string | undefined, group: string, name: string): string[] {
  if (owner) return expandOwner(owner);
  if (group === 'gps') return ['US'];
  if (group === 'glonass') return ['CIS'];
  if (group === 'galileo') return ['ESA'];
  if (group === 'dense') return ['US'];
  if (/\b(ISS|ZARYA)\b/i.test(name)) return expandOwner('ISS');
  if (/\b(CSS|TIANHE|TIANGONG|MENGTIAN|WENTIAN)\b/i.test(name)) return ['PRC'];
  return ['UNK'];
}
