// Arabic text and prayer metadata used by the Smart Time section.
// The UI is English; only Quran, hadith and dhikr are rendered in Arabic, with
// a translation line underneath.

import type { PrayerName } from './types';

export const PRAYER_AR: Record<PrayerName, string> = {
  Fajr:    'الفجر',
  Dhuhr:   'الظهر',
  Asr:     'العصر',
  Maghrib: 'المغرب',
  Isha:    'العشاء',
};

export const PRAYER_ORDER: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** Maghrib runs a little longer by default (sunset + settling in). */
export const PRAYER_WEIGHT: Record<PrayerName, number> = {
  Fajr: 1, Dhuhr: 1, Asr: 1, Maghrib: 1.3, Isha: 1,
};

export type Quote = { arabic: string; translation: string; source: string };

/** The verse the whole section is built on: prayer as the day's timekeeper. */
export const VERSE_PRAYER_TIMES: Quote = {
  arabic: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا',
  translation: 'Indeed, prayer has been decreed upon the believers a decree of specified times.',
  source: 'Quran 4:103',
};

/** Shown over the priority board — the five-before-five narration. */
export const HADITH_FIVE_BEFORE_FIVE: Quote = {
  arabic:
    'اغْتَنِمْ خَمْسًا قَبْلَ خَمْسٍ: شَبَابَكَ قَبْلَ هَرَمِكَ، وَصِحَّتَكَ قَبْلَ سَقَمِكَ، وَغِنَاكَ قَبْلَ فَقْرِكَ، وَفَرَاغَكَ قَبْلَ شُغْلِكَ، وَحَيَاتَكَ قَبْلَ مَوْتِكَ',
  translation:
    'Take benefit of five before five: your youth before your old age, your health before your sickness, your wealth before your poverty, your free time before you are preoccupied, and your life before your death.',
  source: 'Narrated from Ibn Abbas · Al-Hakim',
};

/** Shown over the weekly review — self-accounting. */
export const HADITH_MUHASABAH: Quote = {
  arabic: 'الْكَيِّسُ مَنْ دَانَ نَفْسَهُ وَعَمِلَ لِمَا بَعْدَ الْمَوْتِ',
  translation: 'The wise one is he who takes account of himself and works for what comes after death.',
  source: 'Tirmidhi',
};

/** Shown on the first deep-work block after Fajr. */
export const DUA_EARLY_MORNING: Quote = {
  arabic: 'اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا',
  translation: 'O Allah, bless my nation in their early mornings.',
  source: 'Ibn Majah',
};

/** Shown on Quran blocks. */
export const VERSE_RECITE: Quote = {
  arabic: 'فَاقْرَءُوا مَا تَيَسَّرَ مِنْهُ',
  translation: 'So recite what is easy from it.',
  source: 'Quran 73:20',
};

/** Rotated through the short breaks between Pomodoro sittings. */
export const DHIKR: Quote[] = [
  {
    arabic: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ، سُبْحَانَ اللهِ الْعَظِيمِ',
    translation: 'Glory be to Allah and praise Him; glory be to Allah the Most Great.',
    source: 'Bukhari',
  },
  {
    arabic: 'أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ',
    translation: 'I seek Allah’s forgiveness and turn to Him in repentance.',
    source: 'Bukhari',
  },
  {
    arabic: 'سُبْحَانَ اللهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللهُ، وَاللهُ أَكْبَرُ',
    translation: 'Glory be to Allah; praise be to Allah; there is no god but Allah; Allah is the Greatest.',
    source: 'Muslim',
  },
  {
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ',
    translation: 'There is no power and no strength except with Allah.',
    source: 'Bukhari',
  },
  {
    arabic: 'حَسْبِيَ اللهُ وَنِعْمَ الْوَكِيلُ',
    translation: 'Allah is sufficient for me, and He is the best disposer of affairs.',
    source: 'Bukhari',
  },
  {
    arabic: 'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    translation:
      'There is no god but Allah alone, with no partner. His is the dominion and His is the praise, and He is able to do all things.',
    source: 'Bukhari',
  },
];

/** Suggested Quran sittings, used to label period-mode and break blocks. */
export const QURAN_SITTINGS = [
  'Surah Al-Mulk',
  'Surah Ar-Rahman',
  'Surah Yaseen',
  'Surah Al-Kahf',
  'Juz Amma (78–114)',
  'Surah Al-Waqiah',
  'Surah Maryam',
  'Continue your current juz',
];

export function dhikrFor(index: number): Quote {
  return DHIKR[index % DHIKR.length];
}

export function quranSittingFor(index: number): string {
  return QURAN_SITTINGS[index % QURAN_SITTINGS.length];
}
