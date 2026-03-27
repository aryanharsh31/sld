import AsyncStorage from '@react-native-async-storage/async-storage';
import { piIntegrationService } from './piIntegrationService';

const PROGRESS_KEY = 'assistive_progress_v1';

export interface AssistiveProgressSummary {
  notesCreated: number;
  notesSaved: number;
  handwritingSessions: number;
  voiceCaptures: number;
  recognizedWords: number;
  lastActivityAt?: string;
  queuedSyncItems: number;
}

const DEFAULT_SUMMARY: AssistiveProgressSummary = {
  notesCreated: 0,
  notesSaved: 0,
  handwritingSessions: 0,
  voiceCaptures: 0,
  recognizedWords: 0,
  queuedSyncItems: 0,
};

class ProgressTrackingService {
  async getSummary(): Promise<AssistiveProgressSummary> {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    const queuedSyncItems = await piIntegrationService.getQueuedItemCount();
    return {
      ...DEFAULT_SUMMARY,
      ...stored,
      queuedSyncItems,
    };
  }

  async recordNoteCreated(): Promise<void> {
    await this.patch({ notesCreated: 1 });
  }

  async recordNoteSaved(): Promise<void> {
    await this.patch({ notesSaved: 1 });
  }

  async recordVoiceCapture(text: string): Promise<void> {
    await this.patch({
      voiceCaptures: 1,
      recognizedWords: countWords(text),
    });
  }

  async recordHandwritingRecognition(text: string): Promise<void> {
    await this.patch({
      handwritingSessions: 1,
      recognizedWords: countWords(text),
    });
  }

  private async patch(delta: Partial<Record<keyof AssistiveProgressSummary, number>>): Promise<void> {
    const current = await this.getSummary();
    const next: AssistiveProgressSummary = {
      ...current,
      notesCreated: current.notesCreated + (delta.notesCreated || 0),
      notesSaved: current.notesSaved + (delta.notesSaved || 0),
      handwritingSessions: current.handwritingSessions + (delta.handwritingSessions || 0),
      voiceCaptures: current.voiceCaptures + (delta.voiceCaptures || 0),
      recognizedWords: current.recognizedWords + (delta.recognizedWords || 0),
      queuedSyncItems: current.queuedSyncItems,
      lastActivityAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export const progressTrackingService = new ProgressTrackingService();
