// File: App.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';

import HomeScreen from './components/screens/HomeScreen';
import NotebookFolders, { Folder } from './components/ui/folders';
import NotesScreen from './components/screens/NotesScreen';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthScreen from './components/login/AuthScreen';
import { authService } from './services/authService';
import { notesService, FolderData } from './services/notesService';
import Settings from './components/screens/Settings';
import { getNotePreview } from './services/notePayload';
import { progressTrackingService } from './services/progressTrackingService';

const Stack = createStackNavigator();
const MainStack = createStackNavigator();

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Note {
  id: string | number;
  title: string; // or name
  content: string;
  createdAt: Date;
  updatedAt: Date;
  type: 'text' | 'handwritten';
  color?: string;
  folderId?: string | number;
}

// --- Persistence helpers moved from folders.tsx ---
async function saveFolderToStorage(folder: Folder, parentPath: string = FileSystem.documentDirectory ?? '') {
  const basePath = parentPath || FileSystem.documentDirectory || '';
  const folderPath = basePath + folder.name + '/';
  try {
    const dirInfo = await FileSystem.getInfoAsync(folderPath);
    if (dirInfo.exists) {
      // Only delete folder.json if it exists, not the whole directory
      const jsonPath = folderPath + 'folder.json';
      const jsonInfo = await FileSystem.getInfoAsync(jsonPath);
      if (jsonInfo.exists) await FileSystem.deleteAsync(jsonPath);
    }
    await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
  } catch (e) {
    console.error("Error managing folder directory:", e);
  }
  // Save the entire folder object, including notes, to folder.json
  await FileSystem.writeAsStringAsync(folderPath + 'folder.json', JSON.stringify(folder));
}

async function saveAllFoldersToStorage(folders: Folder[]) {
  for (const folder of folders) {
    await saveFolderToStorage(folder);
  }
}

async function loadFoldersFromStorage(): Promise<Folder[]> {
  const basePath = FileSystem.documentDirectory ?? '';
  let folderNames: string[] = [];
  try {
    folderNames = await FileSystem.readDirectoryAsync(basePath);
  } catch (e) {
    return [];
  }
  const folders: Folder[] = [];
  for (const folderName of folderNames) {
    const folderPath = basePath + folderName + '/';
    try {
      const folderJsonStr = await FileSystem.readAsStringAsync(folderPath + 'folder.json');
      const fullFolder: Folder = JSON.parse(folderJsonStr);
      // Ensure notes array exists and has correct structure
      fullFolder.notes = fullFolder.notes || [];
      folders.push(fullFolder);
    } catch (e) {
        // This might be an old folder that is just a directory, ignore.
     }
  }
  return folders;
}


function NotesListScreen({ folder, folders, setFolders, onBack, onOpenNote }: { folder: Folder, folders: Folder[], setFolders: React.Dispatch<React.SetStateAction<Folder[]>>, onBack: () => void, onOpenNote: (folderId: string | number, noteId: string | number) => void }) {
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [newNoteColor, setNewNoteColor] = useState('#FF6B6B'); // Default color

  const [editNoteModal, setEditNoteModal] = useState<{ open: boolean, noteIndex: number | null }>({ open: false, noteIndex: null });
  const [editNoteContent, setEditNoteContent] = useState('');
  const [noteMenu, setNoteMenu] = useState<{ open: boolean, noteIndex: number | null, x: number, y: number }>({ open: false, noteIndex: null, x: 0, y: 0 });

  // Find the latest version of this subfolder from folders (in case it was updated)
  const currentFolder = folders.find(f => f.id === folder.id) ?? folder;
  // Ensure notes are always an array
  const notes = currentFolder.notes || []; 

  const handleSaveEditNote = () => {
    if (editNoteModal.noteIndex !== null && editNoteContent.trim()) {
      setFolders(folders => folders.map(f => {
        if (f.id === currentFolder.id) {
          const updatedNotes = (f.notes || []).map((n, idx) => idx === editNoteModal.noteIndex ? { ...n, content: editNoteContent } : n);
          return { ...f, notes: updatedNotes };
        }
        return f;
      }));
      setEditNoteModal({ open: false, noteIndex: null });
    }
  };

  const handleDeleteNote = (idx: number) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => setFolders(folders => folders.map(f => {
            if (f.id === currentFolder.id) {
              const updatedNotes = (f.notes || []).filter((_, i) => i !== idx);
              return { ...f, notes: updatedNotes };
            }
            return f;
          }))
        }
      ]
    );
  };

  const handleCreateNewNote = () => {
    if (newNoteName.trim()) {
      const newNoteId = Date.now();
      const newNoteObject = {
        id: newNoteId,
        name: newNoteName,
        color: newNoteColor,
        content: '', // Start with empty content
      };

      setFolders(prevFolders => prevFolders.map(f => {
        if (f.id === currentFolder.id) {
          return { ...f, notes: [...(f.notes || []), newNoteObject] };
        }
        return f;
      }));

      setShowCreateNoteModal(false);
      setNewNoteName('');
      setNewNoteColor('#FF6B6B'); // Reset to default
      onOpenNote(currentFolder.id, newNoteId); // Open the newly created note
    }
  };

  const noteColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#FFB6C1', '#98FB98',
    '#F0E68C', '#87CEEB', '#DEB887', '#F5DEB3'
  ];

  return (
    <SafeAreaView style={styles.notesListScreenContainer}>
      <View style={[componentStyles.notesListHeader, { backgroundColor: currentFolder.color || '#6C63FF' }]}>
        <TouchableOpacity onPress={onBack} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[componentStyles.notesListHeaderTitle, { color: '#fff' }]}>
          {currentFolder.name}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.addNoteButton}
        onPress={() => setShowCreateNoteModal(true)}
      >
        <Text style={styles.addNoteButtonText}>Add New Note</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.notesGridContainer}>
        {notes.map((note, idx) => {
          const notePreviewText = getNotePreview(note.content);

          return ( // Each note is a TouchableOpacity acting as a card
            <TouchableOpacity
              key={note.id}
              style={[styles.noteGridCard, { backgroundColor: note.color || '#4CAF50' }]}
              onPress={() => onOpenNote(currentFolder.id, note.id)}
            >
              <View style={styles.noteGridCardContent}>
                <Text style={[styles.noteGridCardTitle, { color: '#fff' }]} numberOfLines={2}>
                  {note.title || (note as any).name}
                </Text>
                <Text style={[styles.noteGridCardPreview, { color: 'rgba(255, 255, 255, 0.8)' }]} numberOfLines={2}>
                  {notePreviewText}
                </Text>
              </View>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  // Capture the position of the button press
                  setNoteMenu({ open: true, noteIndex: idx, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
                }}
                style={styles.noteGridCardMenuButton}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          )})}
      </ScrollView>
      {/* Edit Note Modal */}
      {editNoteModal.open && (
        <Modal visible transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 320 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Edit Note</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 }}
                placeholder="Note content"
                value={editNoteContent}
                onChangeText={setEditNoteContent}
                autoFocus
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => setEditNoteModal({ open: false, noteIndex: null })} style={{ marginRight: 16 }}><Text>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveEditNote} style={{ backgroundColor: '#007AFF', padding: 10, borderRadius: 8 }}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {/* Create Note Modal */}
      <Modal
        visible={showCreateNoteModal}
        transparent={true}
        animationType="fade"
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 20, textAlign: 'center' }}>Create New Note</Text>
            
            <TextInput
              style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: '#FAFAFA' }}
              placeholder="Note name"
              value={newNoteName}
              onChangeText={setNewNoteName}
              autoFocus={true}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: '#666', marginBottom: 10 }}>Choose Color:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 5 }}
            >
              {noteColors.map((color, index) => (
                <TouchableOpacity
                  key={index}
                  style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 2, borderColor: newNoteColor === color ? '#333' : 'transparent', backgroundColor: color }}
                  onPress={() => setNewNoteColor(color)}
                />
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5, backgroundColor: '#F0F0F0' }} onPress={() => { setShowCreateNoteModal(false); setNewNoteName(''); setNewNoteColor('#FF6B6B'); }}><Text style={{ color: '#666', fontSize: 16, fontWeight: '500' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5, backgroundColor: '#4CAF50' }} onPress={handleCreateNewNote}><Text style={{ color: '#FFF', fontSize: 16, fontWeight: '500' }}>Create</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Note Menu Modal */}
      {noteMenu.open && noteMenu.noteIndex !== null && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} onPress={() => setNoteMenu({ open: false, noteIndex: null, x: 0, y: 0 })}>
            <View style={{
              position: 'absolute',
              // Position the menu near the button that was pressed
              left: noteMenu.x - 100, // Adjust left position to appear left of the icon
              top: noteMenu.y,
              backgroundColor: '#fff',
              borderRadius: 10,
              padding: 12,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
            }}>
              <TouchableOpacity onPress={() => { setNoteMenu({ open: false, noteIndex: null, x: 0, y: 0 }); if (noteMenu.noteIndex !== null) onOpenNote(currentFolder.id, notes[noteMenu.noteIndex].id); }} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                <Text style={{ color: '#007AFF', fontWeight: '500', fontSize: 16 }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setNoteMenu({ open: false, noteIndex: null, x: 0, y: 0 }); if (noteMenu.noteIndex !== null) handleDeleteNote(noteMenu.noteIndex); }} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                <Text style={{ color: '#ff6b6b', fontWeight: '500', fontSize: 16 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Immediately check for an existing session
    authService.getCurrentUser().then(user => {
      setUser(user);
      setLoading(false);
    });

    // Subscribe to auth state changes (e.g., sign in, sign out)
    const subscription = authService.onAuthStateChange((_event, user) => {
      setUser(user);
    });

    // Clean up the subscription when the component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainApp" component={MainApp} />
            <Stack.Screen name="Settings" component={Settings} options={{ headerShown: false }} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Move your current App logic to MainApp
function MainApp() {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(true);

  // Load folders from MongoDB on app startup
  useEffect(() => {
    (async () => {
      try {
        // Initialize default folders for new users
        await notesService.initializeDefaultFolders();
        
        // Load all folders
        const loadedFolders = await notesService.getFolders();
        setFolders(loadedFolders);
      } catch (error) {
        console.error('Error loading folders:', error);
        Alert.alert('Error', 'Failed to load folders. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const handleCreateNewNoteFromHome = async (navigation: any) => {
    try {
      const recentNotesFolder = folders.find(f => f.name === 'Recent Notes');
      if (!recentNotesFolder) {
        Alert.alert("Error", "Could not find the 'Recent Notes' folder. Please restart the app.");
        return;
      }

      const newNote = await notesService.createNote(
        recentNotesFolder.id,
        `New Note ${new Date().toLocaleDateString()}`,
        '',
        'handwritten',
        '#FFEAA7'
      );
      await progressTrackingService.recordNoteCreated();

      // Refresh folders to include the new note
      const updatedFolders = await notesService.getFolders();
      setFolders(updatedFolders);

      navigation.navigate('Notes', { folderId: recentNotesFolder.id, noteId: newNote.id });
    } catch (error) {
      console.error('Error creating note:', error);
      Alert.alert('Error', 'Failed to create note. Please try again.');
    }
  };

  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Home" >
        {props => (
          <HomeScreen
            {...props}
            onNewNote={() => handleCreateNewNoteFromHome(props.navigation)}
            folders={folders}
            setFolders={setFolders}
            onOpenFolder={(folder) => props.navigation.navigate('NotesList', { folder: folder })}
          />
        )}
      </MainStack.Screen>
      <MainStack.Screen name="NotesList">
        {({ navigation, route }) => {
          const folder: Folder | undefined = (route.params as { folder?: Folder })?.folder;
          
          useEffect(() => {
            if (!folder) {
              Alert.alert("Error", "Could not open the folder. Please try again.");
              navigation.goBack();
            }
          }, [folder, navigation]);

          if (!folder) return null; // Render nothing while we are about to navigate back
          return (
            <NotesListScreen
              folder={folder}
              folders={folders}
              setFolders={setFolders}
              onBack={() => navigation.goBack()}
              onOpenNote={(folderId: string | number, noteId: string | number) => navigation.navigate('Notes', { folderId, noteId })}
            />
          );
        }}
      </MainStack.Screen>
      <MainStack.Screen name="Notes">
        {({ navigation, route }) => {
          const { folderId, noteId } = (route.params as { folderId?: string | number | null, noteId?: string | number | null }) || { folderId: null, noteId: null };

          useEffect(() => {
            if (folderId === null || noteId === null) {
              Alert.alert("Error", "Cannot open note without a valid folder or note ID.");
              navigation.goBack();
            }
          }, [folderId, noteId, navigation]);

          if (folderId === null || noteId === null) return null;

          const folder = folders.find(f => f.id === folderId);
          const note = noteId ? folder?.notes.find(n => n.id === noteId) : null;
          return (
          <NotesScreen
            initialNotes={note ? [{ id: String(note.id), title: note.title || (note as any).name, content: note.content, color: note.color, folderId: folder.id as any, createdAt: new Date(), updatedAt: new Date(), type: 'handwritten' }] : []}
            onBack={() => navigation.goBack()}
            onSave={(noteContent: string, targetFolderId: string | number, targetNoteId: string | number) => { // targetNoteId is now correctly passed
              setFolders((prev) => prev.map(f => {
                if (f.id !== targetFolderId) return f;
                const updatedNotes = (f.notes || []).map(n => 
                  n.id === targetNoteId ? { ...n, content: noteContent } : n
                );
                return { ...f, notes: updatedNotes };
              }));
              navigation.goBack();
            }}
            folders={folders}
            setFolders={setFolders}
          />
          );
        }}
      </MainStack.Screen>
    </MainStack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    width: screenWidth * 0.3, // Narrower for landscape
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
  typeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 25,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginHorizontal: 5,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8f0',
  },
  typeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  languageSelector: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  languageButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: 'white',
  },
  languageButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  noteContentContainer: {
    flex: 1,
    padding: 25,
  },
  titleInput: {
    fontSize: 18,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 15,
    color: '#333',
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e9ecef',
    color: '#333',
    textAlignVertical: 'top',
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
  // New styles for NotesListScreen grid layout
  notesListScreenContainer: {
    flex: 1,
    backgroundColor: '#ffffffff',
  },
  notesGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10, // Half of the original 20, to account for item margins
    paddingVertical: 10,
    marginLeft: 30,
    marginRight: 30,
  },
  addNoteButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius:25,
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 10,
    width:'40%',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  addNoteButtonText: {
    color: '#FFF',
    fontSize:25,
    fontWeight: '500',
  },
  noteGridCard: {
    width: (screenWidth - 300)/ 3, // screenWidth - (2*10 container padding) - (2*5 margin between items) / 3
    height: ((screenWidth - 300)/ 3) * 1.2, // Maintain aspect ratio, e.g., 1:1.2
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginBottom: 30,
    marginHorizontal: 5, // Half of the gap between items
    padding: 10,
    justifyContent: 'space-between', // Push title/preview to top, menu to bottom
    elevation: 3, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // borderLeftWidth: 4, // Keep the color border
  },
  noteGridCardContent: {
    flex: 1, // Take up available space
  },
  noteGridCardTitle: {
    fontSize: 40, // Slightly larger than original 26, // Slightly smaller than original 18
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    flexWrap: 'wrap', // Allow text to wrap 
    alignSelf: 'center',
    justifyContent: 'center',

  },
  noteGridCardPreview: {
    fontSize: 12, // Slightly smaller than original 14
    color: '#666',
  },
  noteGridCardMenuButton: {
    position: 'absolute', // Position it absolutely within the card
    top: 5,
    right: 5,
    padding: 5,
    zIndex: 1, // Ensure it's clickable
  },
});

const componentStyles = StyleSheet.create({
  notesListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  notesListHeaderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
});
