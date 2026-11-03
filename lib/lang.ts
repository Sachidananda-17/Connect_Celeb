// Cheap, deterministic detection of the language/script of the user's message,
// so the character is told exactly how to reply (Hinglish etc. is easy to miss otherwise).

const SCRIPTS: [RegExp, string][] = [
  [/[ఀ-౿]/, "Telugu, written in Telugu script (తెలుగు) — do NOT use Roman letters"],
  [/[஀-௿]/, "Tamil, written in Tamil script (தமிழ்) — do NOT use Roman letters"],
  [/[ऀ-ॿ]/, "Hindi, written in Devanagari script (देवनागरी) — do NOT use Roman letters; example style: आप कैसे हैं?"],
  [/[ಀ-೿]/, "Kannada (in Kannada script)"],
  [/[ഀ-ൿ]/, "Malayalam (in Malayalam script)"],
  [/[ঀ-৿]/, "Bengali (in Bengali script)"],
  [/[਀-੿]/, "Punjabi (in Gurmukhi script)"],
  [/[઀-૿]/, "Gujarati (in Gujarati script)"],
];

const HINGLISH = new Set(
  "kaise kya kyun kyu hai hain hoon hu ho tha thi the mujhe mujhko tumhe aap aapne aapka aapki tum tumhara mera meri mere ka ki ke ko se me mein par pe nahi nahin kaun kaunsa kab kahan kitna batao bataiye bataao sunao bhai yaar dost accha achha thoda bahut bohot abhi phir lekin magar toh to kuch koi sab kar karo karna kiya gaana gaane film banaya banayi aur ya".split(" ")
);
const TELUGU_ROMAN = new Set(
  "enti emiti ela ekkada eppudu meeku mee naku nenu nuvvu meru garu cheppandi cheppu chala bagundi undi unnaru ledu avunu kadu em emi ante oka ippudu ayyindi chesaru chesav cheyandi ra anna".split(" ")
);
const TAMIL_ROMAN = new Set("enna epdi eppadi ungalukku unga naan nee neenga sollunga romba irukku illai seri vanakkam".split(" "));

export function detectLanguage(text: string): string {
  for (const [re, label] of SCRIPTS) if (re.test(text)) return label;
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const count = (set: Set<string>) => words.filter((w) => set.has(w)).length;
  const hi = count(HINGLISH), te = count(TELUGU_ROMAN), ta = count(TAMIL_ROMAN);
  const best = Math.max(hi, te, ta);
  if (best >= 2 || (best >= 1 && words.length <= 4)) {
    if (best === te) return "Telugu written in Roman/English letters (Tenglish)";
    if (best === ta) return "Tamil written in Roman/English letters (Tanglish)";
    return "Hinglish (Hindi written in Roman/English letters)";
  }
  return "English";
}
