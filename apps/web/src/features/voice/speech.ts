import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Speaking and listening with the browser's own tools: no key, no server of ours.
 *  - Speech to text: the Web Speech API (Chrome and Edge; Safari partly). The browser sends
 *    the audio to its own speech service; Kalpix never stores or uploads recordings.
 *  - Text to speech: speechSynthesis, with a Hindi / Marathi / Indian-English voice if the
 *    device has one.
 * Where a browser has neither, the screens offer typing instead.
 */
export type SpeechLang = 'hi' | 'mr' | 'en';
export const SPEECH_LOCALE: Record<SpeechLang, string> = { hi: 'hi-IN', mr: 'mr-IN', en: 'en-IN' };
export const SPEECH_LANG_LABEL: Record<SpeechLang, string> = {
  hi: 'हिंदी',
  mr: 'मराठी',
  en: 'English',
};

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => recognitionCtor() !== null;
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Plain words for the errors the browser reports. */
export function listenErrorText(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow the microphone for this site in your browser, then try again.';
    case 'no-speech':
      return 'We did not hear anything. Tap the mic and speak a little closer.';
    case 'audio-capture':
      return 'No microphone was found on this device.';
    case 'network':
      return 'Speech needs an internet connection. Check it, or type instead.';
    case 'language-not-supported':
      return 'This browser cannot listen in that language. Try Hindi or English, or type instead.';
    case 'unsupported':
      return 'This browser cannot listen. Use Chrome or Edge, or type instead.';
    default:
      return 'Listening stopped. Please try again, or type instead.';
  }
}

/**
 * Live listening for the "Speak your ad" panel: words appear as they are recognised.
 * `final` is what was said once the owner stops (or pauses long enough).
 */
export function useListening() {
  const rec = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [final, setFinal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback((lang: SpeechLang) => {
    const Ctor = recognitionCtor();
    setError(null);
    setInterim('');
    setFinal('');
    if (!Ctor) {
      setError('unsupported');
      return;
    }
    rec.current?.abort();
    const r = new Ctor();
    r.lang = SPEECH_LOCALE[lang];
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    let done = '';
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res) continue;
        if (res.isFinal) done = `${done} ${res[0].transcript}`.trim();
        else live += res[0].transcript;
      }
      setFinal(done);
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(e.error);
    };
    r.onend = () => {
      setListening(false);
      setInterim('');
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('unknown');
    }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { listening, interim, final, error, start, stop, setFinal };
}

/** Listen for one short answer ("pandrah sau", "haan"); resolves with the words, or "" on silence. */
export function listenOnce(lang: SpeechLang, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const Ctor = recognitionCtor();
    if (!Ctor) return reject(new Error('unsupported'));
    const r = new Ctor();
    r.lang = SPEECH_LOCALE[lang];
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    let heard = '';
    const timer = setTimeout(() => r.stop(), timeoutMs);
    r.onresult = (e) => {
      heard = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(' ');
    };
    r.onerror = (e) => {
      clearTimeout(timer);
      if (e.error === 'no-speech' || e.error === 'aborted') resolve('');
      else reject(new Error(e.error));
    };
    r.onend = () => {
      clearTimeout(timer);
      resolve(heard.trim());
    };
    try {
      r.start();
    } catch (e) {
      clearTimeout(timer);
      reject(e instanceof Error ? e : new Error('unknown'));
    }
  });
}

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const lang = locale.split('-')[0];
  return (
    voices.find((v) => v.lang === locale) ??
    voices.find((v) => v.lang.startsWith(lang + '-')) ??
    (lang === 'mr' ? voices.find((v) => v.lang.startsWith('hi')) : undefined) // Hindi voices read Marathi well
  );
}

/** Say a line aloud; resolves when it has finished (immediately where speech is not available). */
export function speak(text: string, lang: SpeechLang): Promise<void> {
  if (!canSpeak()) return Promise.resolve();
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LOCALE[lang];
    const voice = pickVoice(u.lang);
    if (voice) u.voice = voice;
    u.rate = 0.95;
    const done = () => resolve();
    u.onend = done;
    u.onerror = done;
    // Some browsers never fire onend for long lines; don't wait forever.
    setTimeout(done, Math.min(15000, 1500 + text.length * 90));
    synth.speak(u);
  });
}

export const stopSpeaking = () => {
  if (canSpeak()) window.speechSynthesis.cancel();
};
