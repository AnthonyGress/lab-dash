import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { CenteredModal } from './CenteredModal';
import { useAppContext } from '../../context/useAppContext';
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

interface ReleaseInfo {
  version: string;
  notes: string;
  date: string;
  isExactMatch?: boolean;
}

interface VersionModalProps {
  open: boolean;
  handleClose: () => void;
}

const INITIAL_RELEASES_COUNT = 5;
const LOAD_MORE_COUNT = 5;

export const VersionModal = ({ open, handleClose }: VersionModalProps) => {
    const [allReleases, setAllReleases] = useState<ReleaseInfo[]>([]);
    const [displayedCount, setDisplayedCount] = useState(INITIAL_RELEASES_COUNT);
    const [isLoading, setIsLoading] = useState(false);
    const [previousCount, setPreviousCount] = useState<number | null>(null);
    const { config, recentlyUpdated } = useAppContext();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            fetchVersionInfo();
            setDisplayedCount(INITIAL_RELEASES_COUNT);
        }
    }, [open, config]);

    useEffect(() => {
        if (previousCount !== null && scrollContainerRef.current) {
            const firstNewElement = document.getElementById(`release-${previousCount}`);
            if (firstNewElement) {
                firstNewElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setPreviousCount(null);
        }
    }, [displayedCount, previousCount]);

    const cleanReleaseNotes = (body: string): string | null => {
        if (!body) return null;

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
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Normalize version strings by removing 'v' prefix
    const normalizeVersion = (v: string): string => v.replace(/^v/, '');

    const fetchVersionInfo = async () => {
        setIsLoading(true);
        try {
            // Get current app version
            const currentVersion = getAppVersion();

            // Fetch all releases using fetch API
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

            // Sort releases by published date (newest first)
            const sortedReleases = [...data].sort((a, b) =>
                new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
            );

            // Convert all releases to ReleaseInfo objects
            const releases = sortedReleases
                .map(release => {
                    const notes = cleanReleaseNotes(release.body || '');
                    if (!notes) return null;

                    return {
                        version: release.tag_name,
                        notes,
                        date: formatDate(release.published_at),
                        isExactMatch: normalizeVersion(release.tag_name) === normalizeVersion(currentVersion)
                    } as ReleaseInfo;
                })
                .filter((release): release is ReleaseInfo => release !== null);

            setAllReleases(releases);
        } catch (error) {
            console.error('Failed to fetch release info:', error);
            setAllReleases([{
                version: getAppVersion(),
                notes: 'Unable to fetch release notes. Check your connection or try again later.',
                date: 'N/A',
                isExactMatch: false
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadMore = () => {
        setPreviousCount(displayedCount);
        setDisplayedCount(prev => prev + LOAD_MORE_COUNT);
    };

    // Dynamic title based on whether we're showing update changelog
    const getTitle = () => {
        if (recentlyUpdated && config?.lastSeenVersion) {
            return 'Update Information';
        }
        return 'Release Notes';
    };

    const displayedReleases = allReleases.slice(0, displayedCount);
    const hasMore = displayedCount < allReleases.length;

    return (
        <CenteredModal open={open} handleClose={handleClose} title={getTitle()}>
            <Box sx={{ p: 2, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
                <Typography variant='h6' gutterBottom>
                    Current Version: {getAppVersion()}
                </Typography>

                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : allReleases.length > 0 ? (
                    <Box sx={{ my: 2, width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                        <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                            Recent Updates:
                        </Typography>
                        <Box ref={scrollContainerRef} sx={{ maxHeight: '400px', overflowY: 'auto', pr: 1, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                            {displayedReleases.map((release, index) => (
                                <Box
                                    key={release.version}
                                    id={`release-${index}`}
                                    sx={{
                                        mb: 3,
                                        pb: index < displayedReleases.length - 1 ? 2 : 0,
                                        borderBottom: index < displayedReleases.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                        width: '100%',
                                        maxWidth: '100%',
                                        minWidth: 0,
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant='subtitle2' fontWeight='bold'>
                                            {release.version}
                                        </Typography>
                                        {release.isExactMatch && (
                                            <Typography
                                                variant='caption'
                                                sx={{
                                                    backgroundColor: 'primary.main',
                                                    color: 'white',
                                                    px: 1,
                                                    py: 0.25,
                                                    borderRadius: 1,
                                                    fontSize: '0.7rem'
                                                }}
                                            >
                                                Current
                                            </Typography>
                                        )}
                                        <Typography variant='caption' sx={{ color: 'white' }}>
                                            {release.date}
                                        </Typography>
                                    </Box>
                                    <Box
                                        sx={{
                                            backgroundColor: 'rgba(255,255,255,0.03)',
                                            p: 2,
                                            borderRadius: 1,
                                            fontSize: '0.9rem',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            width: '100%',
                                            maxWidth: '100%',
                                            minWidth: 0,
                                            boxSizing: 'border-box',
                                            overflowWrap: 'break-word',
                                            wordBreak: 'break-word',
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
                                            components={{
                                                h2: ({ node, ...props }) => <h2 style={{ marginTop: '0.2rem', marginBottom: '0.8rem' }} {...props} />,
                                                a: ({ node, ...props }) => <a target='_blank' rel='noopener noreferrer' {...props} />
                                            }}
                                        >
                                            {release.notes}
                                        </ReactMarkdown>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                        {hasMore && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                <Button
                                    variant='contained'
                                    onClick={handleLoadMore}
                                    size='small'
                                >
                                    Load More
                                </Button>
                            </Box>
                        )}
                    </Box>
                ) : (
                    <Typography variant='body2' color='text.secondary' sx={{ my: 2 }}>
                        No release notes available.
                    </Typography>
                )}
            </Box>
        </CenteredModal>
    );
};
