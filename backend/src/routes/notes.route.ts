import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

import { authenticateToken } from '../middleware/auth.middleware';
import { Note } from '../types';

export const notesRoute = express.Router();

// Path to the config file
const CONFIG_FILE = path.join(__dirname, '../config/config.json');

// Helper function to load config from file
const loadConfig = (): any => {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
        return { layout: { desktop: [], mobile: [] }, notes: [] };
    } catch (error) {
        console.error('Error reading config file:', error);
        return { layout: { desktop: [], mobile: [] }, notes: [] };
    }
};

// Helper function to save config to file
const saveConfig = (config: any): void => {
    try {
        // Ensure the config directory exists
        const configDir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error writing config file:', error);
        throw new Error('Failed to save config');
    }
};

// Helper function to read notes from config
const readNotes = (): Note[] => {
    try {
        const config = loadConfig();
        return config.notes || [];
    } catch (error) {
        console.error('Error reading notes from config:', error);
        return [];
    }
};

// Helper function to write notes to config
const writeNotes = (notes: Note[]): void => {
    try {
        const config = loadConfig();
        config.notes = notes;
        saveConfig(config);
    } catch (error) {
        console.error('Error writing notes to config:', error);
        throw new Error('Failed to save notes');
    }
};

// GET /api/notes - Get all notes
notesRoute.get('/', (req: Request, res: Response) => {
    try {
        const config = loadConfig();
        const notes = readNotes();

        // Migration: Add fontSize to existing notes that don't have it
        let hasUpdates = false;
        const globalDefaultFontSize = config.defaultNoteFontSize || '16px';
        const migratedNotes = notes.map(note => {
            if (!note.fontSize) {
                hasUpdates = true;
                return {
                    ...note,
                    fontSize: globalDefaultFontSize // Use global default font size for existing notes
                };
            }
            return note;
        });

        // Save migrated notes if we made changes
        if (hasUpdates) {
            writeNotes(migratedNotes);
        }

        // Sort by updatedAt descending (most recent first)
        migratedNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        res.json(migratedNotes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// POST /api/notes - Create a new note
notesRoute.post('/', authenticateToken, (req: Request, res: Response) => {
    try {
        const { id, title, content, fontSize } = req.body;
        const config = loadConfig();
        const globalDefaultFontSize = config.defaultNoteFontSize || '16px';

        if (!id || typeof id !== 'string') {
            res.status(400).json({ error: 'ID is required and must be a string' });
            return;
        }

        if (!title || typeof title !== 'string') {
            res.status(400).json({ error: 'Title is required and must be a string' });
            return;
        }

        const notes = readNotes();

        // Check if ID already exists
        if (notes.some(note => note.id === id)) {
            res.status(409).json({ error: 'Note with this ID already exists' });
            return;
        }

        const now = new Date().toISOString();

        const newNote: Note = {
            id: id,
            title: title.trim(),
            content: (content || '').trim(),
            createdAt: now,
            updatedAt: now,
            fontSize: fontSize || globalDefaultFontSize // Use global default font size
        };

        notes.push(newNote);
        writeNotes(notes);

        res.status(201).json(newNote);
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Failed to create note' });
    }
});

// PUT /api/notes/update-all-font-sizes - Update font size for all existing notes
notesRoute.put('/update-all-font-sizes', authenticateToken, (req: Request, res: Response) => {
    try {
        const { fontSize } = req.body;

        if (!fontSize || typeof fontSize !== 'string') {
            res.status(400).json({ error: 'Font size is required and must be a string' });
            return;
        }

        const notes = readNotes();
        let updatedCount = 0;

        // Update all notes to use the new font size
        const updatedNotes = notes.map(note => {
            updatedCount++;
            return {
                ...note,
                fontSize: fontSize
            };
        });

        writeNotes(updatedNotes);

        res.json({
            message: `Updated font size for ${updatedCount} notes`,
            updatedCount
        });
    } catch (error) {
        console.error('Error updating font sizes for all notes:', error);
        res.status(500).json({ error: 'Failed to update font sizes for all notes' });
    }
});

// PUT /api/notes/:id - Update an existing note
notesRoute.put('/:id', authenticateToken, (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, content, fontSize } = req.body;
        const config = loadConfig();
        const globalDefaultFontSize = config.defaultNoteFontSize || '16px';

        if (!title || typeof title !== 'string') {
            res.status(400).json({ error: 'Title is required and must be a string' });
            return;
        }

        const notes = readNotes();
        const noteIndex = notes.findIndex(note => note.id === id);

        if (noteIndex === -1) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        const updatedNote: Note = {
            ...notes[noteIndex],
            title: title.trim(),
            content: (content || '').trim(),
            fontSize: fontSize || notes[noteIndex].fontSize || globalDefaultFontSize, // Preserve existing fontSize or use global default
            updatedAt: new Date().toISOString()
        };

        notes[noteIndex] = updatedNote;
        writeNotes(notes);

        res.json(updatedNote);
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Failed to update note' });
    }
});

// DELETE /api/notes/:id - Delete a note
notesRoute.delete('/:id', authenticateToken, (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const notes = readNotes();
        const noteIndex = notes.findIndex(note => note.id === id);

        if (noteIndex === -1) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        notes.splice(noteIndex, 1);
        writeNotes(notes);

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});
