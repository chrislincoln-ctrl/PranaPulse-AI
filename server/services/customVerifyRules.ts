import type { SupportedLanguage } from '../../src/validators/schemas.js';

export type CustomCategory = 'role' | 'tightness' | 'cookingFuel';

export const ALLOWED_CUSTOM_TARGETS: Record<CustomCategory, readonly string[]> = {
  role: ['child', 'senior-respiratory', 'commuter', 'caregiver'],
  tightness: ['leaky', 'standard', 'weather-sealed'],
  cookingFuel: ['induction', 'lpg-vented', 'lpg-unvented', 'solid-biomass'],
};

export const DEFAULT_CUSTOM_TARGET: Record<CustomCategory, string> = {
  role: 'senior-respiratory',
  tightness: 'standard',
  cookingFuel: 'lpg-unvented',
};

export const CUSTOM_REJECTION_MESSAGES: Record<
  SupportedLanguage,
  Record<CustomCategory, string>
> = {
  en: {
    role: 'This entry does not satisfy the required condition for a valid health or vulnerability profile. Please enter a genuine profile (e.g., pregnant woman, infant, bronchitis patient, outdoor athlete).',
    tightness:
      'This entry does not satisfy the required condition for window or building sealing. Please enter a genuine envelope type (e.g., double-glazed UPVC, wooden shutters, AC sealed room).',
    cookingFuel:
      'This entry does not satisfy the required condition for a cooking fuel or stove. Please enter a genuine fuel or appliance (e.g., biogas, piped PNG, kerosene stove, microwave).',
  },
  hi: {
    role: 'यह प्रविष्टि वैध स्वास्थ्य या संवेदनशीलता प्रोफ़ाइल की आवश्यक शर्त को पूरा नहीं करती है। कृपया सही विवरण दर्ज करें (जैसे गर्भवती महिला, शिशु, ब्रोंकाइटिस रोगी, धावक)।',
    tightness:
      'यह प्रविष्टि खिड़की या भवन सीलिंग की आवश्यक शर्त को पूरा नहीं करती है। कृपया सही खिड़की/कमरा प्रकार लिखें (जैसे डबल-ग्लेज़्ड UPVC, लकड़ी की खिड़की)।',
    cookingFuel:
      'यह प्रविष्टि खाना पकाने के ईंधन या चूल्हे की आवश्यक शर्त को पूरा नहीं करती है। कृपया सही ईंधन लिखें (जैसे बायोगैस, PNG गैस, केरोसिन स्टोव, माइक्रोवेव)।',
  },
  ta: {
    role: 'இந்த உள்ளீடு சரியான உடல்நலம் அல்லது பாதிப்பு நிலைக்கான நிபந்தனையை பூர்த்தி செய்யவில்லை. சரியான விவரத்தை உள்ளிடவும் (எ.கா. கர்ப்பிணி, குழந்தை, மூச்சுக்குழாய் நோயாளி).',
    tightness:
      'இந்த உள்ளீடு ஜன்னல் அல்லது கட்டிட அடைப்புக்கான நிபந்தனையை பூர்த்தி செய்யவில்லை. சரியான ஜன்னல் வகையை உள்ளிடவும் (எ.கா. UPVC கண்ணாடி ஜன்னல், மர ஜன்னல்).',
    cookingFuel:
      'இந்த உள்ளீடு சமையல் எரிபொருள் அல்லது அடுப்புக்கான நிபந்தனையை பூர்த்தி செய்யவில்லை. சரியான எரிபொருளை உள்ளிடவும் (எ.கா. உயிரிவாயு, மண்ணெண்ணெய் அடுப்பு, மைக்ரோவேவ்).',
  },
};

export const CUSTOM_APPROVAL_PREFIX: Record<SupportedLanguage, string> = {
  en: 'Verified custom profile applied:',
  hi: 'सत्यापित कस्टम विकल्प लागू:',
  ta: 'சரிபார்க்கப்பட்ட தனிப்பயன் விருப்பம்:',
};

export const CUSTOM_KEYWORD_MATCHERS: Record<
  CustomCategory,
  readonly { readonly re: RegExp; readonly target: string }[]
> = {
  role: [
    {
      re: /pregnant|infant|baby|toddler|newborn|kid|teen|school|गर्भवती|शिशु|बच्चा|கர்ப்பிணி|குழந்தை/i,
      target: 'child',
    },
    {
      re: /asthma|copd|bronchitis|heart|cardiac|lung|elder|senior|patient|smoker|allergy|sinus|diabetic|अस्थमा|हृदय|बुजुर्ग|रोगी|ஆஸ்துமா|இதய|நோயாளி/i,
      target: 'senior-respiratory',
    },
    {
      re: /college|university|undergrad|grad|student|runner|athlete|cyclist|delivery|driver|police|guard|worker|jogger|commuter|धावक|पुलिस|मजदूर|ஓட்டப்பந்தய|தொழிலாளி/i,
      target: 'commuter',
    },
    {
      re: /adult|office|remote|wfh|homemaker|parent|mother|father|teacher|वयस्क|गृहिणी|शिक्षक|பெரியவர்|ஆசிரியர்/i,
      target: 'caregiver',
    },
  ],
  tightness: [
    {
      re: /upvc|double|glazed|airtight|weather|ac\b|insulated|tape|sealed|डबल|सीलबंद|கண்ணாடி/i,
      target: 'weather-sealed',
    },
    {
      re: /open|broken|jali|mesh|bamboo|curtain|old|wooden|draft|gap|crack|टूटी|जाली|खुली|பழைய|மர/i,
      target: 'leaky',
    },
    {
      re: /window|door|apartment|flat|slider|aluminum|glass|room|खिड़की|फ्लैट|ஜன்னல்|அறை/i,
      target: 'standard',
    },
  ],
  cookingFuel: [
    {
      re: /microwave|oven|air\s*fryer|kettle|electric|heater|infrared|solar|माइक्रोवेव|इलेक्ट्रिक|सोलर|மின்சார|மைக்ரோவேவ்/i,
      target: 'induction',
    },
    {
      re: /png|piped|chimney|hood|exhaust|biogas|बायोगैस|पाइप|चिमनी|உயிரிவாயு/i,
      target: 'lpg-vented',
    },
    {
      re: /kerosene|kersosene|stove|cylinder|gas|butane|केरोसिन|गैस|स्टोव|மண்ணெண்ணெய்|கேஸ்/i,
      target: 'lpg-unvented',
    },
    {
      re: /coal|charcoal|wood|dung|angithi|tandoor|pellet|sawdust|कोयला|लकड़ी|अंगीठी|उपले|நிலக்கரி|விறகு/i,
      target: 'solid-biomass',
    },
  ],
};
