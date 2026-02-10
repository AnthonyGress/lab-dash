import { Add, Close, List, MoreVert, Save } from '@mui/icons-material';
import { Box, CardContent, IconButton, Menu, MenuItem, Tab, Tabs, TextField, Tooltip, Typography, useMediaQuery } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaStickyNote } from 'react-icons/fa';
import { FaRegWindowRestore, FaTrashCan } from 'react-icons/fa6';

import { applyMarkdownFormat } from './applyMarkdownFormat';
import { FontSizeSelector } from './FontSizeSelector';
import { MarkdownPreview } from './MarkdownPreview';
import { MarkdownToolbar } from './MarkdownToolbar';
import { DashApi } from '../../../../../api/dash-api';
import { DUAL_WIDGET_CONTAINER_HEIGHT } from '../../../../../constants/widget-dimensions';
import { useAppContext } from '../../../../../context/useAppContext';
import { theme } from '../../../../../theme/theme';
import { CenteredModal } from '../../../../modals/CenteredModal';
import { PopupManager } from '../../../../modals/PopupManager';

interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    fontSize?: string;
}

interface NotesWidgetProps {
    config?: {
        showLabel?: boolean;
        displayName?: string;
        defaultNoteFontSize?: string;
    };
    onEdit?: () => void;
    onDelete?: () => void;
}

export const NotesWidget = ({ config }: NotesWidgetProps) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'view' | 'edit'>('list');
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [isNewNote, setIsNewNote] = useState(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditingInModal, setIsEditingInModal] = useState(false);
    const [editTab, setEditTab] = useState<'write' | 'preview'>('write'); // New tab state
    const [fontSize, setFontSize] = useState('16px'); // Font size state
    const [originalFontSize, setOriginalFontSize] = useState('16px'); // Original font size before editing

    // Refs for text areas to handle formatting
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const modalTextAreaRef = useRef<HTMLTextAreaElement>(null);

    const handleFontSizeChange = async (newFontSize: string) => {
        // Change global font size for the note
        setFontSize(newFontSize);
    };

    // Handler for markdown formatting
    const handleMarkdownFormat = (type: string, prefix?: string, suffix?: string) => {
        const textArea = isModalOpen ? modalTextAreaRef.current : textAreaRef.current;
        if (!textArea) return;

        const selectionStart = textArea.selectionStart || 0;
        const selectionEnd = textArea.selectionEnd || 0;
        const currentText = editContent;

        const { newText, newSelectionStart, newSelectionEnd } = applyMarkdownFormat(
            currentText,
            selectionStart,
            selectionEnd,
            type,
            prefix,
            suffix
        );

        setEditContent(newText);

        // Set selection after the component re-renders
        setTimeout(() => {
            if (textArea) {
                textArea.focus();
                textArea.setSelectionRange(newSelectionStart, newSelectionEnd);
            }
        }, 0);
    };

    const { editMode } = useAppContext();

    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const hasCoarsePointer = useMediaQuery('(pointer: coarse)');
    const { isLoggedIn, isAdmin } = useAppContext();

    // Conditional tooltip component that only shows tooltips on devices with fine pointers
    const ConditionalTooltip = ({ title, children, placement = 'top' }: {
        title: string;
        children: React.ReactElement;
        placement?: 'top' | 'bottom' | 'left' | 'right';
    }) => {
        if (hasCoarsePointer) {
            // On touch devices, return children without tooltip
            return children;
        }
        // On devices with fine pointers, show tooltip
        return (
            <Tooltip title={title} placement={placement}>
                {children}
            </Tooltip>
        );
    };

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
        setFontSize(note.fontSize || config?.defaultNoteFontSize || '16px');
        setViewMode('view');
        setIsNewNote(false);
    };

    const handleEditClick = () => {
        setOriginalFontSize(fontSize);

        if (isModalOpen) {
            // If modal is open, edit in modal
            setIsEditingInModal(true);
        } else {
            // If not in modal, edit in widget
            setViewMode('edit');
            setIsModalOpen(false);
        }
        setEditTab('write'); // Default to write tab
        setMenuAnchorEl(null);
    };

    const handleListClick = () => {
        setViewMode('list');
        setSelectedNote(null);
        setIsNewNote(false);
        setFontSize(config?.defaultNoteFontSize || '16px');
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
        setFontSize(config?.defaultNoteFontSize || '16px');
        setViewMode('edit');
        setIsNewNote(true);
        setEditTab('write');
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
                    content: editContent.trim(),
                    fontSize: fontSize
                });
                setNotes(prev => [savedNote, ...prev]);
            } else if (selectedNote) {
                savedNote = await DashApi.updateNote(selectedNote.id, {
                    title: editTitle.trim(),
                    content: editContent.trim(),
                    fontSize: fontSize
                });
                setNotes(prev => prev.map(note =>
                    note.id === selectedNote.id ? savedNote : note
                ));
            }

            if (isEditingInModal) {
                // If editing in modal, stay in modal view mode
                setIsEditingInModal(false);
            } else {
                // If editing in widget, go to widget view mode
                setViewMode('view');
            }
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
                    // Close modal if it's open
                    if (isModalOpen) {
                        setIsModalOpen(false);
                        setIsEditingInModal(false);
                    }
                } catch (err) {
                    console.error('Error deleting note:', err);
                    setError('Failed to delete note');
                }
            }
        });
        setMenuAnchorEl(null);
    };

    const handleCancel = () => {
        if (isNewNote) {
            // If creating a new note, go back to list
            setViewMode('list');
            setSelectedNote(null);
            setIsNewNote(false);
            setFontSize(config?.defaultNoteFontSize || '16px'); // Reset to default font size
        } else if (selectedNote) {
            // If editing existing note, revert changes and go back to view mode
            setEditTitle(selectedNote.title);
            setEditContent(selectedNote.content);
            setFontSize(originalFontSize); // Restore original font size
            setViewMode('view');
        }

        // Clear edit state if in modal
        if (isEditingInModal) {
            setIsEditingInModal(false);
        }
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setMenuAnchorEl(null);
    };

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setIsEditingInModal(false);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();

        // Get the start of today (midnight)
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfNoteDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        // Calculate the difference in days
        const diffInDays = Math.floor((startOfToday.getTime() - startOfNoteDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffInDays === 0) {
            // Today - show only time
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInDays < 7) {
            // Within this week - show day and time
            return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        } else {
            // Older than a week - show month and day
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
                        fontSize: isMobile ? '0.9rem' : '1rem',
                        fontWeight: 500
                    }}
                >
                    {note.title}
                </Typography>
                <Typography
                    variant='caption'
                    sx={{
                        fontSize: '0.7rem',
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
                        fontSize: isMobile ? '0.7rem' : '0.8rem',
                        color: 'rgba(255,255,255,0.6)',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        mt: 0.5
                    }}
                >
                    {note.content.replace(/[#*`>\-+]/g, '').trim()}
                </Typography>
            )}
        </Box>
    );

    // Shared function for rendering note view content - identical for widget and modal
    const renderNoteView = (showModalButton: boolean = false, isInModal: boolean = false) => {
        if (!selectedNote) return null;

        return (
            <Box sx={{
                position: 'relative',
                height: isInModal ? '100%' : '100%',
                display: 'flex',
                flexDirection: 'column',
                userSelect: 'auto'
            }}>
                {/* Header with title and menu */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0,
                    pb: .5,
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    position: 'relative',
                    flexShrink: 0
                }}>
                    <Typography
                        onClick={isLoggedIn && isAdmin && !editMode ? handleEditClick : undefined}
                        sx={{
                            color: 'white',
                            fontSize: isMobile ? '1.75rem' : '2rem',
                            fontWeight: 600,
                            wordBreak: 'break-word',
                            textAlign: 'left',
                            userSelect: 'text',
                            cursor: isLoggedIn && isAdmin && !editMode ? 'pointer' : 'text',
                            flex: 1,
                            lineHeight: 1.2,
                            marginLeft: 1,
                            '&:hover': isLoggedIn && isAdmin && !editMode ? {
                                backgroundColor: 'rgba(255,255,255,0.02)'
                            } : {}
                        }}
                    >
                        {selectedNote.title}
                    </Typography>

                    {/* Menu positioned on the right */}
                    {!editMode && (
                        <Box sx={{
                            display: 'flex',
                            gap: 0.5,
                            alignItems: 'center',
                            flexShrink: 0
                        }}>
                            {showModalButton && (
                                <ConditionalTooltip title='Open in popup'>
                                    <IconButton
                                        size='small'
                                        onClick={handleOpenModal}
                                        sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                    >
                                        <FaRegWindowRestore fontSize='medium' />
                                    </IconButton>
                                </ConditionalTooltip>
                            )}
                            {isLoggedIn && isAdmin && (
                                <IconButton
                                    size='small'
                                    onClick={handleMenuOpen}
                                    sx={{
                                        color: 'white',
                                        opacity: 0.8,
                                        '&:hover': { opacity: 1 }
                                    }}
                                >
                                    <MoreVert fontSize='medium' />
                                </IconButton>
                            )}
                        </Box>
                    )}
                </Box>

                {/* Content */}
                <Box
                    onClick={isLoggedIn && isAdmin && !editMode ? handleEditClick : undefined}
                    sx={{
                        flex: 1,
                        overflow: 'auto',
                        cursor: isLoggedIn && isAdmin && !editMode ? 'pointer' : 'default',
                        '& *': isLoggedIn && isAdmin && !editMode ? {
                            cursor: 'pointer !important'
                        } : {},
                        '&:hover': isLoggedIn && isAdmin && !editMode ? {
                            backgroundColor: 'rgba(255,255,255,0.02)'
                        } : {}
                    }}
                >
                    <MarkdownPreview content={selectedNote.content} fontSize={fontSize} />
                </Box>
            </Box>
        );
    };

    const renderContent = () => {
        if (error) {
            return (
                <Box sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant='body2'>{error}</Typography>
                </Box>
            );
        }

        if (viewMode === 'view' && selectedNote) {
            return renderNoteView(true, false); // Show modal button in widget, not in modal
        }

        if (viewMode === 'edit') {
            return (
                <>
                    <TextField
                        fullWidth
                        variant='outlined'
                        placeholder='Note title...'
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        sx={{
                            mb: 0.5,
                            '& .MuiOutlinedInput-root': {
                                color: 'white',
                                fontSize: isMobile ? '0.9rem' : '1rem',
                                fontWeight: 500,
                                padding: '4px 8px',
                                '& fieldset': {
                                    borderColor: 'rgba(255,255,255,0.3)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(255,255,255,0.5)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: 'primary.main',
                                },
                            },
                            '& .MuiInputBase-input': {
                                padding: '6px 0',
                            },
                            '& .MuiInputLabel-root': {
                                color: 'rgba(255,255,255,0.7)',
                            },
                        }}
                    />

                    {/* Tabs for Write/Preview with responsive layout */}
                    {isSmallScreen ? (
                        // Small screens: Font size in tabs, toolbar below
                        <>
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                            }}>
                                <Tabs
                                    value={editTab}
                                    onChange={(_, newValue) => setEditTab(newValue)}
                                    sx={{
                                        minHeight: '32px',
                                        minWidth: 'auto',
                                        '& .MuiTabs-indicator': {
                                            backgroundColor: 'primary.main',
                                        },
                                        '& .MuiTab-root': {
                                            color: 'rgba(255,255,255,0.7)',
                                            minHeight: '32px',
                                            fontSize: '0.8rem',
                                            textTransform: 'none',
                                            minWidth: 'auto',
                                            padding: '6px 12px',
                                            '&.Mui-selected': {
                                                color: 'white',
                                            },
                                        },
                                    }}
                                >
                                    <Tab label='Write' value='write' />
                                    <Tab label='Preview' value='preview' />
                                </Tabs>

                                {/* Font size selector inline with tabs */}
                                <FontSizeSelector
                                    fontSize={fontSize}
                                    onFontSizeChange={handleFontSizeChange}
                                    sx={{ mr: 0 }}
                                />
                            </Box>

                            {/* Toolbar below tabs for write mode */}
                            {editTab === 'write' && (
                                <Box sx={{
                                    py: 0.5,
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    <MarkdownToolbar
                                        onFormat={handleMarkdownFormat}
                                        isMobile={isMobile}
                                        fontSize={fontSize}
                                        onFontSizeChange={handleFontSizeChange}
                                        hideFontSize={true}
                                    />
                                </Box>
                            )}
                        </>
                    ) : (
                        // Large screens: Inline toolbar with font size
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                        }}>
                            <Tabs
                                value={editTab}
                                onChange={(_, newValue) => setEditTab(newValue)}
                                sx={{
                                    minHeight: '32px',
                                    minWidth: 'auto',
                                    '& .MuiTabs-indicator': {
                                        backgroundColor: 'primary.main',
                                    },
                                    '& .MuiTab-root': {
                                        color: 'rgba(255,255,255,0.7)',
                                        minHeight: '32px',
                                        fontSize: '0.8rem',
                                        textTransform: 'none',
                                        minWidth: 'auto',
                                        padding: '6px 12px',
                                        '&.Mui-selected': {
                                            color: 'white',
                                        },
                                    },
                                }}
                            >
                                <Tab label='Write' value='write' />
                                <Tab label='Preview' value='preview' />
                            </Tabs>

                            {/* Show toolbar inline when in write mode */}
                            {editTab === 'write' && (
                                <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                                    <MarkdownToolbar
                                        onFormat={handleMarkdownFormat}
                                        isMobile={isMobile}
                                        fontSize={fontSize}
                                        onFontSizeChange={handleFontSizeChange}
                                    />
                                </Box>
                            )}
                        </Box>
                    )}

                    <Box sx={{
                        flex: 1,
                        mt: 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        {editTab === 'write' ? (
                            <TextField
                                fullWidth
                                multiline
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                placeholder='Write your note in markdown...'
                                variant='outlined'
                                inputRef={textAreaRef}
                                sx={{
                                    flex: 1,
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: 'rgba(0,0,0,0.1)',
                                        color: 'white',
                                        fontFamily: 'monospace',
                                        fontSize: fontSize,
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        '& fieldset': {
                                            borderColor: 'rgba(255,255,255,0.3)',
                                        },
                                        '&:hover fieldset': {
                                            borderColor: 'rgba(255,255,255,0.5)',
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: 'primary.main',
                                        },
                                    },
                                    '& .MuiInputBase-inputMultiline': {
                                        height: '100% !important',
                                        overflow: 'auto !important',
                                        resize: 'none',
                                    },
                                    '& .MuiInputLabel-root': {
                                        color: 'rgba(255,255,255,0.7)',
                                    },
                                    '& .MuiInputBase-input': {
                                        color: 'white !important',
                                        caretColor: 'white',
                                    },
                                    '& .MuiInputBase-input::placeholder': {
                                        color: 'rgba(255,255,255,0.5)',
                                        opacity: 1,
                                    },
                                }}
                            />
                        ) : (
                            <Box sx={{
                                flex: 1,
                                border: '1px solid rgba(255,255,255,0.3)',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(0,0,0,0.1)',
                                overflow: 'hidden',
                            }}>
                                <MarkdownPreview content={editContent} fontSize={fontSize} />
                            </Box>
                        )}
                    </Box>
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        mt: 1,
                        flexShrink: 0,
                    }}>
                        <ConditionalTooltip title='Cancel'>
                            <IconButton
                                size='small'
                                onClick={handleCancel}
                                sx={{
                                    color: 'white',
                                    opacity: 0.8,
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    mr: 1,
                                    '&:hover': {
                                        opacity: 1,
                                        backgroundColor: 'rgba(255,255,255,0.2)'
                                    }
                                }}
                            >
                                <Close fontSize='small' />
                            </IconButton>
                        </ConditionalTooltip>
                        <ConditionalTooltip title='Save note'>
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
                        </ConditionalTooltip>
                    </Box>
                </>
            );
        }

        return null;
    };

    return (
        <CardContent sx={{
            height: '100%',
            padding: 1,
            maxWidth: '100%',
            width: '100%',
            userSelect: 'auto',
            ...(isMobile ? {} : {
                maxHeight: DUAL_WIDGET_CONTAINER_HEIGHT.sm
            })
        }}>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                color: 'white',
                width: '100%',
                userSelect: 'auto' // Ensure text selection is allowed
            }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5, width: '100%', minHeight: '40px' }}>
                    {showLabel && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                cursor: (editMode ) ? 'grab' : 'pointer',
                                '&:hover': {
                                    opacity: (editMode) ? 1 : 0.8
                                }
                            }}
                            onClick={editMode ? undefined : handleTitleClick}
                        >
                            <FaStickyNote
                                style={{
                                    color: 'white',
                                    fontSize: isMobile ? '1rem' : '1.1rem'
                                }}
                            />
                            <Typography
                                variant={isMobile ? 'subtitle1' : 'h6'}
                                sx={{ color: 'white' }}
                            >
                                {displayName}
                            </Typography>
                        </Box>
                    )}

                    {!editMode && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, marginLeft: 'auto' }}>
                            {viewMode === 'list' && isLoggedIn && isAdmin ? (
                                <ConditionalTooltip title='New note'>
                                    <IconButton
                                        size='small'
                                        onClick={handleNewNote}
                                        sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                    >
                                        <Add fontSize='medium' />
                                    </IconButton>
                                </ConditionalTooltip>
                            ) : (
                                <IconButton
                                    size='small'
                                    sx={{ opacity: 0, cursor: 'default', pointerEvents: 'none' }}
                                >
                                    <Add fontSize='medium' />
                                </IconButton>
                            )}
                            {viewMode === 'view' && (
                                <ConditionalTooltip title='List' placement='left'>
                                    <IconButton
                                        size='small'
                                        onClick={handleListClick}
                                        sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                    >
                                        <List fontSize='medium' />
                                    </IconButton>
                                </ConditionalTooltip>
                            )}
                            {viewMode === 'edit' && (
                                <ConditionalTooltip title='Cancel'>
                                    <IconButton
                                        size='small'
                                        onClick={handleCancel}
                                        sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                                    >
                                        <Close fontSize='medium' />
                                    </IconButton>
                                </ConditionalTooltip>
                            )}
                        </Box>
                    )}
                </Box>

                {/* Subtitle */}
                <Typography variant='caption' sx={{
                    px: 1,
                    mb: 0.5,
                    color: viewMode === 'list' ? 'white' : 'transparent',
                    opacity: viewMode === 'list' ? 1 : 0,
                    position: 'relative',
                    zIndex: 'auto',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    display: showLabel ? 'block' : 'none'
                }}>
                    {viewMode === 'list' ? `Notes (${notes.length})` : 'Notes (0)'}
                </Typography>

                {/* Content */}
                <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%' }}>
                    {/* Static container that remains consistent across all view modes */}
                    <Box sx={{
                        px: 1,
                        pt: 1,
                        pb: 1,
                        overflowY: 'auto',
                        height: showLabel ? '320px' : '340px',
                        maxHeight: showLabel ? '320px' : '340px',
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
                        {/* Content inside the static container changes based on view mode */}
                        {viewMode === 'list' ? (
                            error ? (
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
                            )
                        ) : (
                            renderContent()
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Modal for viewing note in centered popup */}
            <CenteredModal
                open={isModalOpen}
                handleClose={handleCloseModal}
                title={isEditingInModal ? 'Edit Note' : 'Note'}
                fullWidthContent={true}
                height='80vh'
            >
                {isEditingInModal ? (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <TextField
                            fullWidth
                            variant='outlined'
                            placeholder='Note title...'
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            sx={{
                                mb: 0.5,
                                '& .MuiOutlinedInput-root': {
                                    color: 'white',
                                    fontSize: isMobile ? '1.1rem' : '1.3rem',
                                    fontWeight: 600,
                                    padding: '8px 14px',
                                    '& fieldset': {
                                        borderColor: 'rgba(255,255,255,0.3)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'rgba(255,255,255,0.5)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'primary.main',
                                    },
                                },
                                '& .MuiInputBase-input': {
                                    padding: '12px 0',
                                },
                                '& .MuiInputLabel-root': {
                                    color: 'rgba(255,255,255,0.7)',
                                },
                            }}
                        />

                        {/* Tabs for Write/Preview with inline toolbar */}
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                        }}>
                            <Tabs
                                value={editTab}
                                onChange={(_, newValue) => setEditTab(newValue)}
                                sx={{
                                    minHeight: '32px',
                                    minWidth: 'auto',
                                    '& .MuiTabs-indicator': {
                                        backgroundColor: 'primary.main',
                                    },
                                    '& .MuiTab-root': {
                                        color: 'rgba(255,255,255,0.7)',
                                        minHeight: '32px',
                                        fontSize: '0.8rem',
                                        textTransform: 'none',
                                        minWidth: 'auto',
                                        padding: '6px 12px',
                                        '&.Mui-selected': {
                                            color: 'white',
                                        },
                                    },
                                }}
                            >
                                <Tab label='Write' value='write' />
                                <Tab label='Preview' value='preview' />
                            </Tabs>

                            {/* Show toolbar inline when in write mode */}
                            {editTab === 'write' && (
                                <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                                    <MarkdownToolbar
                                        onFormat={handleMarkdownFormat}
                                        isMobile={isMobile}
                                        fontSize={fontSize}
                                        onFontSizeChange={handleFontSizeChange}
                                    />
                                </Box>
                            )}
                        </Box>

                        <Box sx={{
                            flex: 1,
                            mt: 0.5,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden', // Prevent outer container from scrolling
                        }}>
                            {editTab === 'write' ? (
                                <TextField
                                    fullWidth
                                    multiline
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    placeholder='Write your note in markdown...'
                                    variant='outlined'
                                    inputRef={modalTextAreaRef}
                                    sx={{
                                        flex: 1,
                                        '& .MuiOutlinedInput-root': {
                                            backgroundColor: 'rgba(0,0,0,0.1)',
                                            color: 'white',
                                            fontFamily: 'monospace',
                                            fontSize: fontSize, // Dynamic font size
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'stretch',
                                            '& fieldset': {
                                                borderColor: 'rgba(255,255,255,0.3)',
                                            },
                                            '&:hover fieldset': {
                                                borderColor: 'rgba(255,255,255,0.5)',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: 'primary.main',
                                            },
                                        },
                                        '& .MuiInputBase-inputMultiline': {
                                            height: '100% !important',
                                            overflow: 'auto !important', // Make the text input scrollable
                                            resize: 'none',
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: 'rgba(255,255,255,0.7)',
                                        },
                                        '& .MuiInputBase-input': {
                                            color: 'white !important',
                                            caretColor: 'white',
                                        },
                                        '& .MuiInputBase-input::placeholder': {
                                            color: 'rgba(255,255,255,0.5)',
                                            opacity: 1,
                                        },
                                    }}
                                />
                            ) : (
                                <Box sx={{
                                    flex: 1,
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                    overflow: 'hidden',
                                }}>
                                    <MarkdownPreview content={editContent} fontSize={fontSize} />
                                </Box>
                            )}
                        </Box>
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            mt: 1,
                            flexShrink: 0, // Prevent buttons from shrinking
                        }}>
                            <ConditionalTooltip title='Cancel'>
                                <IconButton
                                    size='small'
                                    onClick={() => {
                                        handleCancel();
                                        setIsEditingInModal(false);
                                    }}
                                    sx={{
                                        color: 'white',
                                        opacity: 0.8,
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        mr: 1,
                                        '&:hover': {
                                            opacity: 1,
                                            backgroundColor: 'rgba(255,255,255,0.2)'
                                        }
                                    }}
                                >
                                    <Close fontSize='small' />
                                </IconButton>
                            </ConditionalTooltip>
                            <ConditionalTooltip title='Save note'>
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
                            </ConditionalTooltip>
                        </Box>
                    </Box>
                ) : (
                    renderNoteView(false, true) // Don't show modal button in modal, is in modal
                )}
            </CenteredModal>

            {/* Menu for edit/delete actions */}
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
        </CardContent>
    );
};
