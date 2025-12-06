import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

import { CenteredModal } from './CenteredModal';
// import { PopupManager } from './PopupManager';
// import { DashApi } from '../../api/dash-api';
import { styles } from '../../theme/styles';
import { compareVersions } from '../../utils/updateChecker';
import { getAppVersion } from '../../utils/version';

interface GitHubRelease {
    body: string;
    html_url: string;
    tag_name: string;
    name: string;
    published_at: string;
    author: {
        login: string;
        avatar_url: string;
    };
}

interface ReleaseNote {
    version: string;
    notes: string;
    date: string;
}

interface UpdateModalProps {
    open: boolean;
    handleClose: () => void;
    latestVersion: string | null;
    isAdmin: boolean;
}

export const UpdateModal = ({ open, handleClose, latestVersion, isAdmin }: UpdateModalProps) => {
    const { t, i18n } = useTranslation();
    const [isUpdating, setIsUpdating] = useState(false);
    const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open && latestVersion) {
            fetchAllReleaseNotes(latestVersion);
        }
    }, [open, latestVersion]);

    const cleanReleaseNotes = (body: string): string | null => {
        // Check if the body only contains a reference to the full changelog
        if (body.trim() === '**Full Changelog**' ||
            body.trim().startsWith('**Full Changelog**') && body.length < 30 ||
            body.trim().match(/^\*\*Full Changelog\*\*: https:\/\/github\.com\//) ||
            (body.trim().startsWith('**Full Changelog**:') && !body.includes('\n'))) {
            return null;
        }

        // Clean up the release notes
        let cleanedNotes = body;

        // Remove any "**Full Changelog**" section at the end
        const fullChangelogIndex = cleanedNotes.indexOf('**Full Changelog**');
        if (fullChangelogIndex > 0) {
            cleanedNotes = cleanedNotes.substring(0, fullChangelogIndex).trim();
        }

        // Remove everything after "by @" including "by @" itself
        const byAuthorIndex = cleanedNotes.indexOf('by @');
        if (byAuthorIndex > 0) {
            cleanedNotes = cleanedNotes.substring(0, byAuthorIndex).trim();
        }

        // Remove any compare links at the end
        const compareIndex = cleanedNotes.indexOf('**Compare:');
        if (compareIndex > 0) {
            cleanedNotes = cleanedNotes.substring(0, compareIndex).trim();
        }

        return cleanedNotes.trim().length > 0 ? cleanedNotes : null;
    };

    const formatDate = (dateString: string): string => {
        // Use the application's current language for date formatting
        return new Date(dateString).toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const fetchAllReleaseNotes = async (targetVersion: string) => {
        setIsLoading(true);
        try {
            // Get current app version
            const currentVersion = getAppVersion();

            // Fetch all releases using fetch API instead of axios
            const response = await fetch(
                'https://api.github.com/repos/anthonygress/lab-dash/releases',
                {
                    method: 'GET',
                    credentials: 'omit' // Explicitly omit credentials
                }
            );

            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }

            const data: GitHubRelease[] = await response.json();

            // Filter releases between current and latest version
            const relevantReleases = data.filter(release => {
                const version = release.tag_name;
                return compareVersions(version, currentVersion) > 0 &&
                       compareVersions(targetVersion, version) >= 0;
            }).sort((a, b) => compareVersions(b.tag_name, a.tag_name)); // Sort newest first

            // Process each release
            const processedNotes: ReleaseNote[] = [];

            for (const release of relevantReleases) {
                const notes = cleanReleaseNotes(release.body || '');
                if (notes) {
                    processedNotes.push({
                        version: release.tag_name,
                        notes,
                        date: formatDate(release.published_at)
                    });
                }
            }

            setReleaseNotes(processedNotes);
        } catch (error) {
            console.error('Failed to fetch release notes:', error);
            setReleaseNotes([]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <CenteredModal open={open} handleClose={handleClose} title={t('update.title')}>
            <Box sx={{ p: 2 }}>
                <Typography variant='h6' gutterBottom>
                    {t('update.available', { version: latestVersion })}
                </Typography>

                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : releaseNotes.length > 0 ? (
                    <Box sx={{ my: 2, maxHeight: '350px', overflowY: 'auto' }}>
                        <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                            {t('update.notes')}
                        </Typography>
                        {releaseNotes.map((note, index) => (
                            <Box key={note.version} sx={{ mb: index < releaseNotes.length - 1 ? 3 : 0 }}>
                                <Typography variant='subtitle2' fontWeight='bold'>
                                    {note.version} - {note.date}
                                </Typography>
                                <Box
                                    sx={{
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                        p: 2,
                                        borderRadius: 1,
                                        fontSize: '0.9rem',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        mt: 1,
                                        '& h1, h2, h3, h4, h5, h6': {
                                            margin: '0.5rem 0 0.2rem 0',
                                            fontSize: 'inherit',
                                            fontWeight: 'bold',
                                        },
                                        '& h1, h2': {
                                            fontSize: '1.1rem',
                                            marginTop: '0.3rem',
                                            marginBottom: '0.2rem',
                                        },
                                        '& ul, ol': {
                                            paddingLeft: '1.5rem',
                                            marginTop: '0.2rem',
                                            marginBottom: '0.2rem',
                                        },
                                        '& li': {
                                            marginBottom: '0.2rem',
                                        },
                                        '& p': {
                                            marginTop: '0.2rem',
                                            marginBottom: '0.2rem',
                                        },
                                        '& a': {
                                            color: 'primary.main',
                                            textDecoration: 'none',
                                            '&:hover': {
                                                textDecoration: 'underline',
                                            }
                                        }
                                    }}
                                >
                                    <ReactMarkdown
                                        // remarkPlugins={[remarkGfm]}
                                        components={{
                                            // Override to use smaller margins for headers
                                            h2: ({ node, ...props }) => <h2 style={{ marginTop: '0.2rem', marginBottom: '0.8rem' }} {...props} />,
                                            // Override to use proper styling for links
                                            a: ({ node, ...props }) => <a target='_blank' rel='noopener noreferrer' {...props} />
                                        }}
                                    >
                                        {note.notes}
                                    </ReactMarkdown>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : null}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                    {isAdmin && (
                        <Box sx={{ ...styles.center, width: '100%' }} >
                            {/* <Button
                                variant='contained'
                                color='primary'
                                disabled={isUpdating}
                                onClick={async () => {
                                    setIsUpdating(true);
                                    try {
                                        const result = await DashApi.updateContainer();
                                        if (result.success) {
                                            PopupManager.success(result.message);
                                        } else {
                                            PopupManager.failure(result.message);
                                        }
                                        handleClose();
                                    } catch (error) {
                                        PopupManager.failure(t('update.error'));
                                    } finally {
                                        setIsUpdating(false);
                                    }
                                }}
                            >
                                {isUpdating ? t('update.updating') : t('update.updateNow')}
                            </Button> */}
                            <Button
                                variant='contained'
                                onClick={() => {
                                    window.open('https://github.com/AnthonyGress/lab-dash/blob/main/README.md#updating', '_blank');
                                    handleClose();
                                }}
                            >
                                {t('update.guide')}
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>
        </CenteredModal>
    );
};