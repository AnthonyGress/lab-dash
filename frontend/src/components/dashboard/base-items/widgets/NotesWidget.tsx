import { Add, Close, Delete, Edit, List, MoreVert, Save } from '@mui/icons-material';
import { Box, CardContent, IconButton, Menu, MenuItem, TextField, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { FaEdit } from 'react-icons/fa';
import { FaStickyNote } from 'react-icons/fa';
import { FaTrashCan } from 'react-icons/fa6';

import { DashApi } from '../../../../api/dash-api';
import { DUAL_WIDGET_CONTAINER_HEIGHT } from '../../../../constants/widget-dimensions';
import { useAppContext } from '../../../../context/useAppContext';
import { theme } from '../../../../theme/theme';
import { PopupManager } from '../../../modals/PopupManager';

interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

interface NotesWidgetProps {
    config?: {
        showLabel?: boolean;
        displayName?: string;
    };
    editMode?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
}

export const NotesWidget = ({ config, editMode, onEdit, onDelete }: NotesWidgetProps) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'view' | 'edit'>('list');
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [isNewNote, setIsNewNote] = useState(false);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);

    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { isLoggedIn, isAdmin, editMode: dashboardEditMode } = useAppContext();

    const showLabel = config?.showLabel !== false;
    const displayName = config?.displayName || 'Notes';

    const fetchNotes = useCallback(async () => {
        try {
            setError(null);
            if (notes.length === 0) {
                setIsLoading(true);
            }
            const notesData = await DashApi.getNotes();
            setNotes(notesData);
        } catch (err) {
            console.error('Error fetching notes:', err);
            setError('Failed to fetch notes');
        } finally {
            setIsLoading(false);
        }
    }, [notes.length]);

    useEffect(() => {
        if (!editMode) {
            fetchNotes();
        }
    }, [editMode, fetchNotes]);

    const handleNoteClick = (note: Note) => {
        setSelectedNote(note);
        setEditTitle(note.title);
        setEditContent(note.content);
        setViewMode('view');
        setIsNewNote(false);
    };

    const handleEditClick = () => {
        setViewMode('edit');
        setMenuAnchorEl(null);
    };

    const handleListClick = () => {
        setViewMode('list');
        setSelectedNote(null);
        setIsNewNote(false);
    };

    const handleTitleClick = () => {
        if (viewMode !== 'list') {
            handleListClick();
        }
    };

    const handleNewNote = () => {
        setSelectedNote(null);
        setEditTitle('');
        setEditContent('');
        setViewMode('edit');
        setIsNewNote(true);
    };

    const handleSave = async () => {
        try {
            if (!editTitle.trim()) {
                setError('Title is required');
                return;
            }

            let savedNote: Note;
            if (isNewNote) {
                savedNote = await DashApi.createNote({
                    title: editTitle.trim(),
                    content: editContent.trim()
                });
                setNotes(prev => [savedNote, ...prev]);
            } else if (selectedNote) {
                savedNote = await DashApi.updateNote(selectedNote.id, {
                    title: editTitle.trim(),
                    content: editContent.trim()
                });
                setNotes(prev => prev.map(note =>
                    note.id === selectedNote.id ? savedNote : note
                ));
            }

            setViewMode('view');
            setSelectedNote(savedNote!);
            setIsNewNote(false);
            setError(null);
        } catch (err) {
            console.error('Error saving note:', err);
            setError('Failed to save note');
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!selectedNote) return;

        PopupManager.deleteConfirmation({
            title: 'Delete Note',
            text: `Are you sure you want to delete "${selectedNote.title}"?`,
            confirmText: 'Yes, Delete',
            confirmAction: async () => {
                try {
                    await DashApi.deleteNote(noteId);
                    setNotes(prev => prev.filter(note => note.id !== noteId));
                    setViewMode('list');
                    setSelectedNote(null);
                } catch (err) {
                    console.error('Error deleting note:', err);
                    setError('Failed to delete note');
                }
            }
        });
        setMenuAnchorEl(null);
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setMenuAnchorEl(null);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInHours < 24 * 7) {
            return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const NoteItem = ({ note }: { note: Note }) => (
        <Box
            sx={{
                mb: 1.5,
                '&:last-child': { mb: 0 },
                p: 1,
                borderRadius: '4px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                transition: 'all 0.2s ease',
                '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    cursor: 'pointer'
                },
                width: '100%',
                boxSizing: 'border-box'
            }}
            onClick={() => handleNoteClick(note)}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Typography
                    variant='caption'
                    noWrap
                    sx={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'white',
                        fontSize: isMobile ? '0.7rem' : '0.8rem',
                        fontWeight: 500
                    }}
                >
                    {note.title}
                </Typography>
                <Typography
                    variant='caption'
                    sx={{
                        fontSize: isMobile ? '0.6rem' : '0.7rem',
                        ml: 'auto',
                        color: 'rgba(255,255,255,0.7)',
                        minWidth: '60px',
                        textAlign: 'right'
                    }}
                >
                    {formatDate(note.updatedAt)}
                </Typography>
            </Box>
            {note.content && (
                <Typography
                    variant='caption'
                    sx={{
                        fontSize: isMobile ? '0.6rem' : '0.65rem',
                        color: 'rgba(255,255,255,0.6)',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        mt: 0.5
                    }}
                >
                    {note.content}
                </Typography>
            )}
        </Box>
    );

    const renderContent = () => {
        if (error) {
            return (
                <Box sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                    <Typography variant='body2'>{error}</Typography>
                </Box>
            );
        }

        if (viewMode === 'view' && selectedNote) {
            return (
                <Box sx={{
                    px: 1.5,
                    pt: 1.5,
                    pb: 1,
                    overflowY: 'auto',
                    height: '280px',
                    maxHeight: '280px',
                    width: '100%',
                    minWidth: '100%',
                    flex: '1 1 auto',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    '&::-webkit-scrollbar': {
                        width: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: 'rgba(255,255,255,0.05)',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '2px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                        background: 'rgba(255,255,255,0.3)',
                    },
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                    position: 'relative'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                        <Typography
                            variant='h6'
                            sx={{
                                color: 'white',
                                fontSize: isMobile ? '1rem' : '1.1rem',
                                fontWeight: 600,
                                wordBreak: 'break-word',
                                flex: 1
                            }}
                        >
                            {selectedNote.title}
                        </Typography>
                        {isLoggedIn && isAdmin && !dashboardEditMode && (
                            <Box sx={{ ml: 1 }}>
                                <IconButton
                                    size='small'
                                    onClick={handleMenuOpen}
                                    sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                >
                                    <MoreVert fontSize='small' />
                                </IconButton>
                                <Menu
                                    anchorEl={menuAnchorEl}
                                    open={Boolean(menuAnchorEl)}
                                    onClose={handleMenuClose}
                                    sx={{
                                        '& .MuiPaper-root': {
                                            bgcolor: '#2A2A2A',
                                            color: 'white',
                                            borderRadius: 1,
                                            boxShadow: 4
                                        }
                                    }}
                                >
                                    <MenuItem
                                        onClick={handleEditClick}
                                        sx={{
                                            py: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1
                                        }}
                                    >
                                        <FaEdit size={14} />
                                        Edit
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => selectedNote && handleDeleteNote(selectedNote.id)}
                                        sx={{
                                            py: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1
                                        }}
                                    >
                                        <FaTrashCan size={14} />
                                        Delete
                                    </MenuItem>
                                </Menu>
                            </Box>
                        )}
                    </Box>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: isMobile ? '0.8rem' : '0.85rem',
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            flex: 1
                        }}
                    >
                        {selectedNote.content || 'No content'}
                    </Typography>
                </Box>
            );
        }

        if (viewMode === 'edit') {
            return (
                <Box sx={{
                    px: 1.5,
                    pt: 1.5,
                    pb: 1.5,
                    overflowY: 'auto',
                    height: '280px',
                    maxHeight: '280px',
                    width: '100%',
                    minWidth: '100%',
                    flex: '1 1 auto',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    '&::-webkit-scrollbar': {
                        width: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: 'rgba(255,255,255,0.05)',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '2px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                        background: 'rgba(255,255,255,0.3)',
                    },
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                    position: 'relative'
                }}>
                    <TextField
                        fullWidth
                        variant='outlined'
                        placeholder='Note title...'
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        sx={{
                            mb: 1,
                            '& .MuiOutlinedInput-root': {
                                color: 'white',
                                fontSize: isMobile ? '0.9rem' : '1rem',
                                '& fieldset': {
                                    borderColor: 'rgba(255,255,255,0.3)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(255,255,255,0.5)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: theme.palette.primary.main,
                                },
                            },
                            '& .MuiInputLabel-root': {
                                color: 'rgba(255,255,255,0.7)',
                            },
                        }}
                    />
                    <TextField
                        fullWidth
                        multiline
                        variant='outlined'
                        placeholder='Write your note here...'
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        sx={{
                            flex: 1,
                            '& .MuiOutlinedInput-root': {
                                color: 'white',
                                fontSize: isMobile ? '0.8rem' : '0.85rem',
                                height: '100%',
                                '& fieldset': {
                                    borderColor: 'rgba(255,255,255,0.3)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(255,255,255,0.5)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: theme.palette.primary.main,
                                },
                                '& textarea': {
                                    height: '100% !important',
                                    overflow: 'auto !important',
                                },
                            },
                        }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Tooltip title='Save note'>
                            <IconButton
                                size='small'
                                onClick={handleSave}
                                sx={{
                                    color: 'white',
                                    opacity: 0.8,
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    '&:hover': {
                                        opacity: 1,
                                        backgroundColor: 'rgba(255,255,255,0.2)'
                                    }
                                }}
                            >
                                <Save fontSize='small' />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            );
        }

        return null;
    };

    return (
        <CardContent sx={{
            height: '100%',
            padding: 2,
            maxWidth: '100%',
            width: '100%',
            ...(isMobile ? {} : {
                minHeight: DUAL_WIDGET_CONTAINER_HEIGHT.sm
            })
        }}>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                color: 'white',
                width: '100%'
            }}>
                {/* Header */}
                {showLabel && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FaStickyNote
                                style={{
                                    color: 'white',
                                    fontSize: isMobile ? '1rem' : '1.1rem'
                                }}
                            />
                            <Typography
                                variant={isMobile ? 'subtitle1' : 'h6'}
                                sx={{
                                    color: 'white',
                                    cursor: viewMode !== 'list' ? 'pointer' : 'default',
                                    '&:hover': viewMode !== 'list' ? { opacity: 0.8 } : {}
                                }}
                                onClick={handleTitleClick}
                            >
                                {displayName}
                            </Typography>
                            {viewMode !== 'list' && isLoggedIn && isAdmin && !dashboardEditMode && (
                                <Tooltip title='Back to list'>
                                    <IconButton
                                        size='small'
                                        onClick={handleListClick}
                                        sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                    >
                                        <List fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>

                        {!editMode && isLoggedIn && isAdmin && !dashboardEditMode && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {viewMode === 'list' && (
                                    <Tooltip title='New note'>
                                        <IconButton
                                            size='small'
                                            onClick={handleNewNote}
                                            sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                        >
                                            <Add fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {viewMode === 'edit' && (
                                    <Tooltip title='Cancel'>
                                        <IconButton
                                            size='small'
                                            onClick={handleListClick}
                                            sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                        >
                                            <Close fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        )}
                    </Box>
                )}

                {/* Subtitle */}
                {showLabel && (
                    <Typography variant='caption' sx={{ px: 1, mb: 0.5, color: 'white' }}>
                        Notebook ({notes.length})
                    </Typography>
                )}

                {/* Content */}
                <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%' }}>
                    {viewMode === 'list' ? (
                        <>
                            <Box sx={{
                                px: 1.5,
                                pt: 1.5,
                                pb: 1,
                                overflowY: 'auto',
                                height: '280px',
                                maxHeight: '280px',
                                width: '100%',
                                minWidth: '100%',
                                flex: '1 1 auto',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(0,0,0,0.1)',
                                '&::-webkit-scrollbar': {
                                    width: '4px',
                                },
                                '&::-webkit-scrollbar-track': {
                                    background: 'rgba(255,255,255,0.05)',
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    background: 'rgba(255,255,255,0.2)',
                                    borderRadius: '2px',
                                },
                                '&::-webkit-scrollbar-thumb:hover': {
                                    background: 'rgba(255,255,255,0.3)',
                                },
                                display: 'block',
                                boxSizing: 'border-box',
                                position: 'relative'
                            }}>
                                {error ? (
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%',
                                        width: '100%',
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: '0.85rem',
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        zIndex: 1
                                    }}>
                                        {error}
                                    </Box>
                                ) : notes.length > 0 ? (
                                    notes.map(note => (
                                        <NoteItem key={note.id} note={note} />
                                    ))
                                ) : (
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%',
                                        width: '100%',
                                        color: 'rgba(255,255,255,0.5)',
                                        fontSize: '0.85rem',
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        zIndex: 1
                                    }}>
                                        {isLoading ? 'Loading notes...' : 'No notes yet'}
                                    </Box>
                                )}
                            </Box>
                        </>
                    ) : (
                        <Box sx={{ flex: 1, overflow: 'hidden' }}>
                            {renderContent()}
                        </Box>
                    )}
                </Box>
            </Box>
        </CardContent>
    );
};
