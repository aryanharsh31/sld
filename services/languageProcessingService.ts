export interface SupportedLanguage {
  code: string;
  label: string;
  speechLocale: string;
  inkLocale: string;
}

export interface LanguageProcessingResult {
  cleanedText: string;
  simplifiedText: string;
  languageCode: string;
}

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', speechLocale: 'en-US', inkLocale: 'en-US' },
  { code: 'hi', label: 'Hindi', speechLocale: 'hi-IN', inkLocale: 'en-US' },
  { code: 'mr', label: 'Marathi', speechLocale: 'mr-IN', inkLocale: 'en-US' },
];

class LanguageProcessingService {
  getSupportedLanguages(): SupportedLanguage[] {
    return SUPPORTED_LANGUAGES;
  }

  getLanguage(code: string): SupportedLanguage {
    return SUPPORTED_LANGUAGES.find(language => language.code === code) || SUPPORTED_LANGUAGES[0];
  }

  processText(text: string, languageCode: string, simplificationEnabled: boolean): LanguageProcessingResult {
    const cleanedText = normalizeSpacing(text);
    return {
      cleanedText,
      simplifiedText: simplificationEnabled ? simplifyText(cleanedText) : cleanedText,
      languageCode: this.getLanguage(languageCode).code,
    };
  }
}

function normalizeSpacing(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}

function simplifyText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\butilize\b/gi, 'use')
    .replace(/\bassistance\b/gi, 'help')
    .replace(/\bapproximately\b/gi, 'about')
    .replace(/,\s*/g, ', ')
    .replace(/\.\s*/g, '. ')
    .trim();
}

export const languageProcessingService = new LanguageProcessingService();
