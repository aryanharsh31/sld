import { localDB } from './localDatabase';
import { authService } from './authService';

export interface NoteData {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'handwritten';
  color?: string;
  folderId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderData {
  id: string;
  name: string;
  color: string;
  icon?: string;
  notes: NoteData[];
  createdAt: Date;
  updatedAt: Date;
}

class NotesService {
  /**
   * Get all folders for the current user
   */
  async getFolders(): Promise<FolderData[]> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const folders = await localDB.getFoldersByUserId(currentUser.id);
    const folderData: FolderData[] = [];

    for (const folder of folders) {
      const notes = await localDB.getNotesByFolderId(folder.id);
      
      folderData.push({
        id: folder.id,
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
        notes: notes.map(note => ({
          id: note.id,
          title: note.title,
          content: note.content,
          type: note.type,
          color: note.color,
          folderId: folder.id,
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt),
        })),
        createdAt: new Date(folder.createdAt),
        updatedAt: new Date(folder.createdAt),
      });
    }

    return folderData;
  }

  /**
   * Create a new folder
   */
  async createFolder(name: string, color: string = '#6C63FF', icon: string = 'folder-outline'): Promise<FolderData> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const folder = await localDB.createFolder(currentUser.id, name, color, icon);

    return {
      id: folder.id,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      notes: [],
      createdAt: new Date(folder.createdAt),
      updatedAt: new Date(folder.createdAt),
    };
  }

  /**
   * Update a folder
   */
  async updateFolder(folderId: string, updates: Partial<{ name: string; color: string; icon: string }>): Promise<FolderData> {
    const folders = await this.getFolders();
    const folder = folders.find(item => item.id === folderId);

    if (!folder) {
      throw new Error('Folder not found');
    }

    return {
      ...folder,
      ...updates,
    };
  }

  /**
   * Delete a folder and all its notes
   */
  async deleteFolder(folderId: string): Promise<void> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    await localDB.deleteFolder(folderId);
  }

  /**
   * Create a new note
   */
  async createNote(
    folderId: string,
    title: string,
    content: string = '',
    type: 'text' | 'handwritten' = 'handwritten',
    color: string = '#FF6B6B'
  ): Promise<NoteData> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const note = await localDB.createNote(currentUser.id, folderId, title, content, type, color);

    return {
      id: note.id,
      title: note.title,
      content: note.content,
      type: note.type,
      color: note.color,
      folderId: note.folderId,
      createdAt: new Date(note.createdAt),
      updatedAt: new Date(note.updatedAt),
    };
  }

  /**
   * Update a note
   */
  async updateNote(noteId: string, updates: Partial<{ title: string; content: string; color: string }>): Promise<void> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    await localDB.updateNote(noteId, updates);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<void> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    await localDB.deleteNote(noteId);
  }

  /**
   * Get a specific note
   */
  async getNote(noteId: string): Promise<NoteData> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const folders = await this.getFolders();
    for (const folder of folders) {
      const note = folder.notes.find(item => item.id === noteId);
      if (note) {
        return note;
      }
    }

    throw new Error('Note not found');
  }

  /**
   * Search notes by content or title
   */
  async searchNotes(query: string): Promise<NoteData[]> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const folders = await this.getFolders();
    return folders
      .flatMap(folder => folder.notes)
      .filter(note =>
        note.title.toLowerCase().includes(normalizedQuery) ||
        note.content.toLowerCase().includes(normalizedQuery)
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Initialize default folders for new users
   */
  async initializeDefaultFolders(): Promise<void> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Check if user already has folders
    const existingFolders = await localDB.getFoldersByUserId(currentUser.id);
    if (existingFolders.length > 0) {
      return; // User already has folders
    }

    // Create default "Recent Notes" folder
    await localDB.createFolder(currentUser.id, 'Recent Notes', '#87CEEB', 'time-outline');
  }
}

export const notesService = new NotesService();
