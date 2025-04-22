import { Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { CenteredModal } from './CenteredModal';
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
}

interface VersionModalProps {
  open: boolean;
  handleClose: () => void;
}

export const VersionModal = ({ open, handleClose }: VersionModalProps) => {
    const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchCurrentVersionInfo();
        }
    }, [open]);

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

    const fetchCurrentVersionInfo = async () => {
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

            // Find the release that matches the current version (handle v prefix inconsistency)
            const normalizedCurrentVersion = currentVersion.startsWith('v') ? currentVersion : `v${currentVersion}`;
            const currentRelease = sortedReleases.find(release =>
                release.tag_name === currentVersion ||
                release.tag_name === normalizedCurrentVersion ||
                release.tag_name.replace(/^v/, '') === currentVersion.replace(/^v/, '')
            );

            if (currentRelease) {
                const notes = cleanReleaseNotes(currentRelease.body || '');
                if (notes) {
                    setReleaseInfo({
                        version: currentRelease.tag_name,
                        notes,
                        date: formatDate(currentRelease.published_at)
                    });
                } else {
                    setReleaseInfo({
                        version: currentRelease.tag_name,
                        notes: 'No detailed release notes available for this version.',
                        date: formatDate(currentRelease.published_at)
                    });
                }
            } else {
                // If exact match not found, try to find the closest release
                const versionWithoutPrefix = currentVersion.replace(/^v/, '');

                // Look for a release that contains the version number
                const closestRelease = sortedReleases.find(release =>
                    release.tag_name.includes(versionWithoutPrefix) ||
                    release.tag_name.replace(/^v/, '').includes(versionWithoutPrefix)
                );

                if (closestRelease) {
                    const notes = cleanReleaseNotes(closestRelease.body || '');
                    if (notes) {
                        setReleaseInfo({
                            version: closestRelease.tag_name,
                            notes,
                            date: formatDate(closestRelease.published_at)
                        });
                    } else {
                        setReleaseInfo({
                            version: closestRelease.tag_name,
                            notes: 'No detailed release notes available for this version.',
                            date: formatDate(closestRelease.published_at)
                        });
                    }
                } else if (sortedReleases.length > 0) {
                    // Fallback to the most recent release if no match is found
                    const latestRelease = sortedReleases[0];
                    const notes = cleanReleaseNotes(latestRelease.body || '');

                    setReleaseInfo({
                        version: latestRelease.tag_name,
                        notes: notes || 'No detailed release notes available.',
                        date: formatDate(latestRelease.published_at)
                    });
                } else {
                    setReleaseInfo({
                        version: currentVersion,
                        notes: 'Release notes not found for this version.',
                        date: 'N/A'
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch release info:', error);
            setReleaseInfo({
                version: getAppVersion(),
                notes: 'Unable to fetch release notes. Check your connection or try again later.',
                date: 'N/A'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <CenteredModal open={open} handleClose={handleClose} title='Current Version'>
            <Box sx={{ p: 2 }}>
                <Typography variant='h6' gutterBottom>
                    Version {getAppVersion()}
                </Typography>

                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : releaseInfo ? (
                    <Box sx={{ my: 2, maxHeight: '350px', overflowY: 'auto' }}>
                        <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                            Release Notes:
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                            {releaseInfo.version !== getAppVersion() &&
                             releaseInfo.version !== `v${getAppVersion()}` &&
                             `v${releaseInfo.version}` !== getAppVersion() && (
                                <Typography variant='body2' color='warning.main' sx={{ mb: 1 }}>
                                    Showing notes from version {releaseInfo.version}
                                </Typography>
                            )}
                            <Typography variant='subtitle2' fontWeight='bold'>
                                {releaseInfo.version} - {releaseInfo.date}
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
                                    components={{
                                        // Override to use smaller margins for headers
                                        h2: ({ node, ...props }) => <h2 style={{ marginTop: '0.2rem', marginBottom: '0.8rem' }} {...props} />,
                                        // Override to use proper styling for links
                                        a: ({ node, ...props }) => <a target='_blank' rel='noopener noreferrer' {...props} />
                                    }}
                                >
                                    {releaseInfo.notes}
                                </ReactMarkdown>
                            </Box>
                        </Box>
                    </Box>
                ) : null}
            </Box>
        </CenteredModal>
    );
};
