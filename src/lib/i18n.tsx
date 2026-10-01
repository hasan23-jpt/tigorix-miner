import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "bn", label: "বাংলা", flag: "🇧🇩" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];

const en = {
  home: "Home",
  tasks: "Tasks",
  earn: "Earn",
  refer: "Refer",
  profile: "Profile",
  balance: "Balance",
  online: "Online",
  mining: "Tiger Mining",
  rewardCode: "Reward Code",
  dailyReward: "Daily Reward",
  withdraw: "Withdraw",
  community: "Community",
  payments: "Payments",
  finance: "Finance",
  walletWithdraw: "Wallet & Withdraw",
  transactions: "Transactions",
  social: "Social",
  referFriends: "Refer Friends",
  leaderboard: "Leaderboard",
  communityChannel: "Community Channel",
  paymentChannel: "Payment Channel",
  payoutProofs: "Payout Proofs (public)",
  preferences: "Preferences",
  notifications: "Notifications",
  language: "Language",
  about: "About Tigorix",
  back: "Back to profile",
  on: "On",
  off: "Off",
  chooseLanguage: "Choose language",
  suspendedTitle: "Account suspended",
  maintenanceTitle: "We are upgrading Tigorix",
};

type Dict = typeof en;

const ru: Dict = {
  home: "Главная", tasks: "Задания", earn: "Заработок", refer: "Друзья", profile: "Профиль",
  balance: "Баланс", online: "Онлайн", mining: "Тигриный майнинг", rewardCode: "Промокод",
  dailyReward: "Ежедневная награда", withdraw: "Вывод", community: "Сообщество",
  payments: "Выплаты", finance: "Финансы", walletWithdraw: "Кошелёк и вывод",
  transactions: "Транзакции", social: "Социальное", referFriends: "Пригласить друзей",
  leaderboard: "Рейтинг", communityChannel: "Канал сообщества", paymentChannel: "Канал выплат",
  payoutProofs: "Доказательства выплат", preferences: "Настройки", notifications: "Уведомления",
  language: "Язык", about: "О Tigorix", back: "Назад в профиль", on: "Вкл", off: "Выкл",
  chooseLanguage: "Выберите язык", suspendedTitle: "Аккаунт заблокирован",
  maintenanceTitle: "Мы обновляем Tigorix",
};

const hi: Dict = {
  home: "होम", tasks: "टास्क", earn: "कमाएँ", refer: "रेफ़र", profile: "प्रोफ़ाइल",
  balance: "बैलेंस", online: "ऑनलाइन", mining: "टाइगर माइनिंग", rewardCode: "रिवॉर्ड कोड",
  dailyReward: "दैनिक इनाम", withdraw: "निकासी", community: "कम्युनिटी", payments: "भुगतान",
  finance: "फ़ाइनेंस", walletWithdraw: "वॉलेट और निकासी", transactions: "लेन-देन",
  social: "सोशल", referFriends: "दोस्तों को बुलाएँ", leaderboard: "लीडरबोर्ड",
  communityChannel: "कम्युनिटी चैनल", paymentChannel: "पेमेंट चैनल",
  payoutProofs: "भुगतान प्रमाण", preferences: "सेटिंग्स", notifications: "सूचनाएँ",
  language: "भाषा", about: "Tigorix के बारे में", back: "प्रोफ़ाइल पर वापस", on: "चालू",
  off: "बंद", chooseLanguage: "भाषा चुनें", suspendedTitle: "खाता निलंबित",
  maintenanceTitle: "हम Tigorix को अपग्रेड कर रहे हैं",
};

const bn: Dict = {
  home: "হোম", tasks: "টাস্ক", earn: "আয়", refer: "রেফার", profile: "প্রোফাইল",
  balance: "ব্যালেন্স", online: "অনলাইন", mining: "টাইগার মাইনিং", rewardCode: "রিওয়ার্ড কোড",
  dailyReward: "দৈনিক পুরস্কার", withdraw: "উত্তোলন", community: "কমিউনিটি",
  payments: "পেমেন্ট", finance: "ফিন্যান্স", walletWithdraw: "ওয়ালেট ও উত্তোলন",
  transactions: "লেনদেন", social: "সোশ্যাল", referFriends: "বন্ধুদের আমন্ত্রণ",
  leaderboard: "লিডারবোর্ড", communityChannel: "কমিউনিটি চ্যানেল",
  paymentChannel: "পেমেন্ট চ্যানেল", payoutProofs: "পেমেন্ট প্রমাণ", preferences: "সেটিংস",
  notifications: "নোটিফিকেশন", language: "ভাষা", about: "Tigorix সম্পর্কে",
  back: "প্রোফাইলে ফিরুন", on: "চালু", off: "বন্ধ", chooseLanguage: "ভাষা বেছে নিন",
  suspendedTitle: "অ্যাকাউন্ট স্থগিত", maintenanceTitle: "আমরা Tigorix আপগ্রেড করছি",
};

const DICTS: Record<Lang, Dict> = { en, ru, hi, bn };

export function normLang(code: string | undefined | null): Lang {
  const c = String(code ?? "").slice(0, 2).toLowerCase();
  return (LANGS.some((l) => l.code === c) ? c : "en") as Lang;
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof Dict) => string };
const I18n = createContext<Ctx>({ lang: "en", setLang: () => undefined, t: (k) => en[k] });

export function I18nProvider({ initial, children }: { initial: string; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(normLang(initial));
  useEffect(() => {
    const saved = window.localStorage.getItem("tgx_lang");
    if (saved) setLangState(normLang(saved));
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("tgx_lang", l);
  }, []);
  const t = useCallback((k: keyof Dict) => DICTS[lang][k] ?? en[k], [lang]);
  return <I18n.Provider value={{ lang, setLang, t }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
