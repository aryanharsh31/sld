export interface NotePagePayload {
  strokes: any[];
}

export interface NoteCapturePayload {
  version: 2;
  pages: NotePagePayload[];
  recognizedText?: string;
  voiceTranscript?: string;
  combinedText?: string;
  source?: 'tablet' | 'smart-pen' | 'hybrid';
  deviceId?: string;
  updatedAt: string;
}

export function buildNotePayload(input: {
  pages: NotePagePayload[];
  recognizedText?: string;
  voiceTranscript?: string;
  source?: 'tablet' | 'smart-pen' | 'hybrid';
  deviceId?: string;
}): NoteCapturePayload {
  const recognizedText = normalizeText(input.recognizedText);
  const voiceTranscript = normalizeText(input.voiceTranscript);
  const combinedText = normalizeText([recognizedText, voiceTranscript].filter(Boolean).join('\n').trim());

  return {
    version: 2,
    pages: input.pages,
    recognizedText,
    voiceTranscript,
    combinedText,
    source: input.source ?? 'tablet',
    deviceId: input.deviceId,
    updatedAt: new Date().toISOString(),
  };
}

export function parseNotePayload(rawContent: string | null | undefined): NoteCapturePayload {
  if (!rawContent) {
    return emptyPayload();
  }

  try {
    const parsed = JSON.parse(rawContent);

    if (Array.isArray(parsed)) {
      return {
        version: 2,
        pages: parsed.map(pageStrokes => ({
          strokes: Array.isArray(pageStrokes) ? pageStrokes : [],
        })),
        updatedAt: new Date().toISOString(),
      };
    }

    if (parsed && typeof parsed === 'object') {
      const pages = Array.isArray(parsed.pages)
        ? parsed.pages.map((page: any) => ({
            strokes: Array.isArray(page?.strokes) ? page.strokes : Array.isArray(page) ? page : [],
          }))
        : [];

      return {
        version: 2,
        pages,
        recognizedText: normalizeText(parsed.recognizedText),
        voiceTranscript: normalizeText(parsed.voiceTranscript),
        combinedText: normalizeText(parsed.combinedText),
        source: parsed.source,
        deviceId: parsed.deviceId,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch {
    return {
      version: 2,
      pages: [{ strokes: [] }],
      combinedText: normalizeText(rawContent),
      updatedAt: new Date().toISOString(),
    };
  }

  return emptyPayload();
}

export function serializeNotePayload(payload: NoteCapturePayload): string {
  return JSON.stringify(payload);
}

export function getNotePreview(rawContent: string | null | undefined): string {
  const payload = parseNotePayload(rawContent);

  if (payload.combinedText) {
    return truncate(payload.combinedText, 80);
  }

  if (payload.recognizedText) {
    return truncate(payload.recognizedText, 80);
  }

  if (payload.voiceTranscript) {
    return truncate(payload.voiceTranscript, 80);
  }

  const hasStrokes = payload.pages.some(page => Array.isArray(page.strokes) && page.strokes.length > 0);
  return hasStrokes ? 'Handwritten Note' : 'Empty Note';
}

function emptyPayload(): NoteCapturePayload {
  return {
    version: 2,
    pages: [{ strokes: [] }],
    updatedAt: new Date().toISOString(),
  };
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function normalizeText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
