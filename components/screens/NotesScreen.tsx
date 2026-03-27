import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  PanResponder,
} from 'react-native';
import { DigitalInkCanvas } from '../features/DigitalInkCanvas';
import { RecognitionCandidate } from '../../modules/digital-ink-recognition/src/DigitalInkRecognition';
import { Toolbar, ToolKey } from '../features/Toolbar';
import { Ionicons } from '@expo/vector-icons';
import type { InsertedShape } from '../features/DigitalInkCanvas';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { voiceRecognitionService, VoiceRecognitionCallbacks } from '../features/VoiceRecognitionService';
import { notesService } from '../../services/notesService';
import { buildNotePayload, parseNotePayload, serializeNotePayload } from '../../services/notePayload';
import { piIntegrationService } from '../../services/piIntegrationService';
import { appProfileService } from '../../services/appProfileService';
import { progressTrackingService } from '../../services/progressTrackingService';
import { languageProcessingService } from '../../services/languageProcessingService';
 
// A4 aspect ratio
const A4_ASPECT_RATIO = 1 / Math.sqrt(2);
const PAGE_MARGIN_HORIZONTAL = 20;
const { width: screenWidth } = Dimensions.get('window');

export interface Note {
  id: string | number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  type: 'text' | 'handwritten';
  color?: string;
  folderId?: string | number;
}

interface NotesScreenProps {
  initialNotes?: Note[];
  onBack?: () => void;
  onSave?: (noteContent: string, folderId: string | number, noteId: string | number) => void;
  onNoteChange?: (note: string) => void;
  folders?: any[];
  setFolders?: any;
}

export default function NotesScreen({ initialNotes = [], onBack, onSave, onNoteChange, folders = [], setFolders }: NotesScreenProps) {
  const [activeTool, setActiveTool] = useState<ToolKey | undefined>(undefined);
  const [recognitionResults, setRecognitionResults] = useState<RecognitionCandidate[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [recognitionEnabled, setRecognitionEnabled] = useState(false);
  const [recognitionMode, setRecognitionMode] = useState<'alphabet' | 'words'>('words');
  const [pageLayout, setPageLayout] = useState<{ layout: 'blank' | 'ruled' | 'grid' | 'dot', density: number, lineWidth: number }>({ layout: 'blank', density: 40, lineWidth: 1 });
  const undoRef = useRef<(() => void) | undefined>(undefined);
  const redoRef = useRef<(() => void) | undefined>(undefined);
  const clearRef = useRef<(() => void) | undefined>(undefined);
  const [insertedShape, setInsertedShape] = useState<InsertedShape | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPageNumber, setShowPageNumber] = useState(false);
  const pageNumberTimeout = useRef<number | null>(null);
  const [autoAlignText, setAutoAlignText] = useState(false);
  const [wordGapMs, setWordGapMs] = useState(1200);
  const [pendingText, setPendingText] = useState('');
  const lastRecognizedRef = useRef('');
  
  // Voice recognition state
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [speechFeedbackEnabled, setSpeechFeedbackEnabled] = useState(true);
  const [simplificationEnabled, setSimplificationEnabled] = useState(true);
  const [assistiveProfileLoaded, setAssistiveProfileLoaded] = useState(false);

  // Pen color and width state
  const [penColor, setPenColor] = useState('#222');
  const [penWidth, setPenWidth] = useState(3);
  const availableColors = ['#222', '#007AFF', '#FF3B30', '#4CD964', '#FF9500', '#AF52DE', '#FFD60A', '#5AC8FA', '#8E8E93'];
  const availableWidths = [1, 2, 3, 5, 8, 12];

  const [pages, setPages] = useState<Array<{ strokes: any[] }>>([{ strokes: [] }]);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (initialNotes.length > 0 && initialNotes[0].content) {
      const payload = parseNotePayload(initialNotes[0].content);
      setPages(payload.pages.length > 0 ? payload.pages : [{ strokes: [] }]);
      setVoiceTranscript(payload.voiceTranscript || '');
      setPendingText(payload.combinedText || payload.recognizedText || '');
      if (payload.languageCode) setSelectedLanguage(payload.languageCode);
    }
  }, [initialNotes]);

  useEffect(() => {
    const loadAssistiveProfile = async () => {
      const profile = await appProfileService.getProfile();
      setSelectedLanguage(profile.preferredLanguage);
      setSpeechFeedbackEnabled(profile.speechFeedbackEnabled);
      setSimplificationEnabled(profile.simplificationEnabled);
      setAssistiveProfileLoaded(true);
    };

    loadAssistiveProfile().catch(error => console.error('Failed to load assistive profile', error));
  }, []);

  // Handler for updating strokes of the current page
  const handleSetStrokes = (pageIndex: number, newStrokes: any[]) => {
    setPages(prevPages => prevPages.map((page, idx) => idx === pageIndex ? { ...page, strokes: newStrokes } : page));
  };

  // Navigation handlers
  // These are kept for potential future use but are not used with vertical scrolling
  const goToPrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };
  const goToNextPage = () => {
    if (currentPage < pages.length - 1) setCurrentPage(currentPage + 1);
  };
  const addPage = () => {
    setPages(prev => [...prev, { strokes: [] }]);
    // No need to set current page, scroll view will just extend
  };

  const handleToolSelect = (tool: ToolKey) => {
    setActiveTool(tool);
    // If shapes tool is selected, ensure pen is off (activeTool is 'shapes')
    // No extra logic needed, as DigitalInkCanvas uses activeTool to determine pen/shape mode
  };

  const handleUndo = () => {
    if (undoRef.current) undoRef.current();
  };

  const handleRedo = () => {
    if (redoRef.current) redoRef.current();
  };

  const handleClear = () => {
    if (clearRef.current) clearRef.current();
    setInsertedShape(null);
  };

  const handleRecognitionResult = (candidates: RecognitionCandidate[]) => {
    setRecognitionResults(candidates);
  };

  const handleShapeInsert = (shape: InsertedShape['type']) => {
    setInsertedShape({ type: shape, x: 100, y: 100, width: 120, height: 120 });
  };

  const handleContentChange = (content: string) => {
    setNoteContent(content);
    if (onNoteChange) onNoteChange(content);
  };

  // Save all pages as part of the note
  const handleSave = async () => {
    try {
      const currentNote = initialNotes?.[0];
      if (currentNote && currentNote.folderId && currentNote.id) {
        const rawCombinedText = [recognitionResults[0]?.text || pendingText, voiceTranscript]
          .filter(Boolean)
          .join('\n')
          .trim();
        const languageResult = languageProcessingService.processText(
          rawCombinedText,
          selectedLanguage,
          simplificationEnabled
        );
        const payload = buildNotePayload({
          pages,
          languageCode: languageResult.languageCode,
          recognizedText: languageResult.cleanedText,
          voiceTranscript,
          simplifiedText: languageResult.simplifiedText,
          source: 'tablet',
        });
        const serializedPayload = serializeNotePayload(payload);
        
        await notesService.updateNote(String(currentNote.id), {
          content: serializedPayload
        });

        await piIntegrationService.submitRecognizedNote({
          noteId: String(currentNote.id),
          folderId: String(currentNote.folderId),
          pages: payload.pages,
          languageCode: payload.languageCode,
          recognizedText: payload.recognizedText,
          voiceTranscript: payload.voiceTranscript,
          combinedText: payload.combinedText,
          simplifiedText: payload.simplifiedText,
          capturedAt: payload.updatedAt,
        });

        await progressTrackingService.recordNoteSaved();
        await progressTrackingService.recordHandwritingRecognition(payload.recognizedText || '');
        
        Alert.alert('Success', 'Note saved successfully!');
        
        if (onSave) {
          onSave(serializedPayload, currentNote.folderId, currentNote.id);
        }
      } else {
        Alert.alert("Save Error", "Cannot save note. Missing folder or note ID.");
      }
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    }
  };

  // Voice recognition handlers
  const startVoiceRecognition = async () => {
    if (!voiceEnabled) {
      Alert.alert('Voice Recognition', 'Voice recognition is not available on this device.');
      return;
    }

    try {
      const success = await voiceRecognitionService.startWithOptions({
        language: languageProcessingService.getLanguage(selectedLanguage).speechLocale,
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
      });
      
      if (!success) {
        Alert.alert('Error', 'Failed to start voice recognition.');
      }
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      Alert.alert('Error', 'Failed to start voice recognition.');
    }
  };

  const stopVoiceRecognition = async () => {
    try {
      await voiceRecognitionService.stop();
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  const insertVoiceText = () => {
    if (voiceText.trim()) {
      const cleanText = voiceText.trim();
      setVoiceTranscript(prev => [prev, cleanText].filter(Boolean).join('\n'));
      setPendingText(prev => [prev, cleanText].filter(Boolean).join('\n'));
      setVoiceText('');
      progressTrackingService.recordVoiceCapture(cleanText).catch(error => console.error('Failed to record voice capture', error));
    }
  };

  const speakText = async (text: string) => {
    if (!speechFeedbackEnabled) {
      return;
    }
    try {
      await voiceRecognitionService.speak(text, {
        language: languageProcessingService.getLanguage(selectedLanguage).speechLocale,
        rate: 1.0,
        pitch: 1.0,
      });
    } catch (error) {
      console.error('Error speaking text:', error);
      Alert.alert('Error', 'Failed to speak text.');
    }
  };

  // Add a handler to insert a space in alphabet mode
  const handleInsertSpace = () => {
    setPendingText(prev => prev + ' ');
  };

  // Handle voice text insertion
  const handleVoiceTextInsert = () => {
    insertVoiceText();
  };

  // When recognition result comes in, append only the new character(s) to pendingText in alphabet mode
  useEffect(() => {
    if (recognitionMode === 'alphabet' && recognitionResults.length > 0) {
      const newText = recognitionResults[0].text;
      const lastText = lastRecognizedRef.current;
      if (newText && newText.length > lastText.length) {
        const diff = newText.slice(lastText.length);
        setPendingText(prev => prev + diff);
      }
      lastRecognizedRef.current = newText;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognitionResults]);

  // Reset pendingText and lastRecognizedRef when switching modes or clearing
  useEffect(() => {
    setPendingText('');
    lastRecognizedRef.current = '';
  }, [recognitionMode, clearRef]);

  useEffect(() => {
    if (activeTool !== 'pen') {
      setInsertedShape(null);
    }
  }, [activeTool]);

  // Initialize voice recognition
  useEffect(() => {
    const initVoice = async () => {
      const callbacks: VoiceRecognitionCallbacks = {
        onStart: () => {
          setIsListening(true);
          console.log('Voice recognition started');
        },
        onEnd: () => {
          setIsListening(false);
          console.log('Voice recognition ended');
        },
        onResults: (results) => {
          if (results && results.length > 0) {
            setVoiceText(results[0]);
            console.log('Voice recognition results:', results[0]);
          }
        },
        onError: (error) => {
          setIsListening(false);
          console.error('Voice recognition error:', error);
          Alert.alert('Voice Recognition Error', error);
        },
        onPartialResults: (results) => {
          if (results && results.length > 0) {
            setVoiceText(results[0]);
          }
        },
      };

      const initialized = await voiceRecognitionService.initialize(callbacks);
      setVoiceEnabled(initialized);
    };

    initVoice();

    return () => {
      voiceRecognitionService.destroy();
    };
  }, []);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('digitalInkApp:recognitionSettings');
        if (saved) {
          const settings = JSON.parse(saved);
          if (typeof settings.recognitionEnabled === 'boolean') setRecognitionEnabled(settings.recognitionEnabled);
          if (typeof settings.recognitionMode === 'string') setRecognitionMode(settings.recognitionMode);
          if (typeof settings.wordGapMs === 'number') setWordGapMs(settings.wordGapMs);
          if (typeof settings.autoAlignText === 'boolean') setAutoAlignText(settings.autoAlignText);
        }
      } catch (e) { console.warn('Failed to load recognition settings', e); }
    })();
  }, []);

  // Save settings to AsyncStorage whenever they change
  useEffect(() => {
    const settings = {
      recognitionEnabled,
      recognitionMode,
      wordGapMs,
      autoAlignText,
    };
    AsyncStorage.setItem('digitalInkApp:recognitionSettings', JSON.stringify(settings)).catch(() => {});
  }, [recognitionEnabled, recognitionMode, wordGapMs, autoAlignText]);

  useEffect(() => {
    if (!assistiveProfileLoaded) {
      return;
    }
    appProfileService.updateProfile({
      preferredLanguage: selectedLanguage,
      speechFeedbackEnabled,
      simplificationEnabled,
    }).catch(error => console.error('Failed to persist assistive profile settings', error));
  }, [assistiveProfileLoaded, selectedLanguage, speechFeedbackEnabled, simplificationEnabled]);

  return (
    <View style={styles.container}>
      <Toolbar
        activeTool={activeTool}
        onToolSelect={setActiveTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onShapeInsert={handleShapeInsert}
        onPageLayoutChange={setPageLayout}
        onSave={onSave ? handleSave : undefined}
        onOpenSettings={() => setSettingsVisible(true)}
        onBack={onBack}
        noteName={initialNotes?.[0]?.title}
        noteColor={initialNotes?.[0]?.color}
        penColor={penColor}
        onPenColorChange={setPenColor}
        penWidth={penWidth}
        onPenWidthChange={setPenWidth}
        availableColors={availableColors}
        availableWidths={availableWidths}
        onAddPage={addPage}
      />
      {/* Page number overlay */}
      {/* This can be re-enabled with scroll position detection if needed */}
      {/* {showPageNumber && (
        <View style={styles.pageNumberOverlay} pointerEvents="none">
          <Text style={styles.pageNumberText}>Page {currentPage + 1} / {pages.length}</Text>
        </View>
      )} */}
      {/* Main Content: Digital Ink Canvas with gesture navigation */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {pages.map((page, index) => (
          <View key={index} style={styles.pageContainer}>
            <DigitalInkCanvas
              languageTag={languageProcessingService.getLanguage(selectedLanguage).inkLocale}
              onRecognitionResult={setRecognitionResults}
              undoRef={undoRef}
              redoRef={redoRef}
              clearRef={clearRef}
              eraserActive={activeTool === 'eraser'}
              recognitionEnabled={recognitionEnabled}
              recognitionMode={recognitionMode}
              wordGapMs={wordGapMs}
              insertedShape={insertedShape}
              setInsertedShape={setInsertedShape}
              activeTool={activeTool}
              pageLayout={pageLayout}
              strokes={page.strokes}
              setStrokes={(newStrokes) => handleSetStrokes(index, newStrokes)}
              autoAlignText={autoAlignText}
              penColor={penColor}
              penWidth={penWidth}
            />
          </View>
        ))}
      </ScrollView>
      {/* Voice Recognition Controls */}
      {voiceEnabled && (
        <View style={styles.voiceControls}>
          <TouchableOpacity
            style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
            onPress={isListening ? stopVoiceRecognition : startVoiceRecognition}
          >
            <Ionicons 
              name={isListening ? "stop" : "mic"} 
              size={24} 
              color={isListening ? "#fff" : "#007AFF"} 
            />
          </TouchableOpacity>
          
          {voiceText && (
            <View style={styles.voiceTextContainer}>
              <Text style={styles.voiceText}>{voiceText}</Text>
              <TouchableOpacity style={styles.insertVoiceButton} onPress={handleVoiceTextInsert}>
                <Text style={styles.insertVoiceButtonText}>Insert</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.speakButton} onPress={() => speakText(voiceText)}>
                <Ionicons name="volume-high" size={20} color="#4CAF50" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      {/* Settings Modal */}
      {settingsVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.settingsTitle}>Settings</Text>
            <View style={styles.settingsBlock}>
              <Text style={styles.sectionTitle}>Language Support</Text>
              <View style={styles.languageChipRow}>
                {languageProcessingService.getSupportedLanguages().map(language => (
                  <TouchableOpacity
                    key={language.code}
                    style={[
                      styles.languageChip,
                      selectedLanguage === language.code && styles.languageChipActive
                    ]}
                    onPress={() => setSelectedLanguage(language.code)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.languageChipText,
                        selectedLanguage === language.code && styles.languageChipTextActive
                      ]}
                    >
                      {language.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Recognition</Text>
              <TouchableOpacity
                style={[styles.switchPill, recognitionEnabled && styles.switchPillActive]}
                onPress={() => setRecognitionEnabled(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={[styles.switchPillText, recognitionEnabled && styles.switchPillTextActive]}>
                  {recognitionEnabled ? 'On' : 'Off'}
                </Text>
              </TouchableOpacity>
            </View>
            {recognitionEnabled && (
              <>
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionTitle}>Recognition Mode</Text>
                <View style={[styles.settingsRow, { marginTop: 8 }]}> 
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      recognitionMode === 'alphabet' && styles.modeButtonActive,
                      { marginRight: 10 }
                    ]}
                    onPress={() => setRecognitionMode('alphabet')}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.modeButtonText,
                      recognitionMode === 'alphabet' && styles.modeButtonTextActive
                    ]}>Alphabet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      recognitionMode === 'words' && styles.modeButtonActive
                    ]}
                    onPress={() => setRecognitionMode('words')}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.modeButtonText,
                      recognitionMode === 'words' && styles.modeButtonTextActive
                    ]}>Words</Text>
                  </TouchableOpacity>
                </View>
                {recognitionMode === 'words' && (
                  <View style={{ width: '100%', marginBottom: 18 }}>
                    <Text style={[styles.settingsLabel, { marginBottom: 4 }]}>Word Gap (ms): <Text style={{ fontWeight: 'bold' }}>{wordGapMs}</Text></Text>
                    <Slider
                      style={{ width: '100%', height: 32 }}
                      minimumValue={300}
                      maximumValue={3000}
                      step={50}
                      value={wordGapMs}
                      onValueChange={setWordGapMs}
                      minimumTrackTintColor="#4CAF50"
                      maximumTrackTintColor="#ccc"
                      thumbTintColor="#4CAF50"
                    />
                  </View>
                )}
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>Auto Align Text</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, autoAlignText && styles.switchPillActive]}
                    onPress={() => setAutoAlignText(v => !v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.switchPillText, autoAlignText && styles.switchPillTextActive]}>
                      {autoAlignText ? 'On' : 'Off'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>Text Simplification</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, simplificationEnabled && styles.switchPillActive]}
                    onPress={() => setSimplificationEnabled(v => !v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.switchPillText, simplificationEnabled && styles.switchPillTextActive]}>
                      {simplificationEnabled ? 'On' : 'Off'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Audio Feedback</Text>
              <TouchableOpacity
                style={[styles.switchPill, speechFeedbackEnabled && styles.switchPillActive]}
                onPress={() => setSpeechFeedbackEnabled(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={[styles.switchPillText, speechFeedbackEnabled && styles.switchPillTextActive]}>
                  {speechFeedbackEnabled ? 'On' : 'Off'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSettingsVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
    marginTop: 64, // Toolbar height
  },
  scrollContent: {
    paddingHorizontal: PAGE_MARGIN_HORIZONTAL,
    paddingVertical: 20,
    alignItems: 'center', // Center pages horizontally
  },
  pageContainer: {
    width: screenWidth - (PAGE_MARGIN_HORIZONTAL * 2),
    height: (screenWidth - (PAGE_MARGIN_HORIZONTAL * 2)) / A4_ASPECT_RATIO,
    marginBottom: 20, // Space between pages
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  createButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mainContent: {
    flexDirection: 'row',
    flex: 1,
  },
  notesPanel: {
    width: screenWidth * 0.3,
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
    backgroundColor: 'white',
  },
  panelHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  notesList: {
    padding: 10,
  },
  noteCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedNoteCard: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteType: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  noteDate: {
    fontSize: 12,
    color: '#888',
  },
  detailPanel: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  noteDetail: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingBottom: 12,
    marginBottom: 15,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailType: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  detailDate: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailContent: {
    flex: 1,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  detailActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  editButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  noSelection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  noSelectionIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  noSelectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  noSelectionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  noteContentContainer: {
    flex: 1,
    padding: 25,
  },
  handwrittenContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    overflow: 'hidden',
  },
  recognitionPreview: {
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  recognitionPreviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  recognitionPreviewText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  settingsModal: {
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  settingsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#333',
  },
  settingsBlock: {
    width: '100%',
    marginBottom: 18,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 18,
  },
  languageChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    marginTop: 10,
  },
  languageChip: {
    backgroundColor: '#eee',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  languageChipActive: {
    backgroundColor: '#2196F3',
  },
  languageChipText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 13,
  },
  languageChipTextActive: {
    color: '#fff',
  },
  settingsLabel: {
    fontSize: 16,
    color: '#333',
  },
  switchPill: {
    backgroundColor: '#eee',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 6,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  switchPillActive: {
    backgroundColor: '#4CAF50',
  },
  switchPillText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 15,
  },
  switchPillTextActive: {
    color: '#fff',
  },
  modeButton: {
    backgroundColor: '#eee',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 8,
    marginHorizontal: 0,
    minWidth: 90,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  modeButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#388e3c',
  },
  modeButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
    marginLeft: 2,
  },
  closeButton: {
    marginTop: 10,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  voiceControls: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  voiceButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  voiceButtonActive: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  voiceTextContainer: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    maxWidth: 200,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  voiceText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  insertVoiceButton: {
    backgroundColor: '#007AFF',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  insertVoiceButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  speakButton: {
    alignSelf: 'center',
    padding: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    backgroundColor: '#4CAF50',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 100,
  },
  pageNumberOverlay: {
    position: 'absolute',
    left: 24,
    bottom: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    zIndex: 200,
  },
  pageNumberText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
}); 
