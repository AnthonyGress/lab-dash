import { Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

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

export const VersionModal = ({ open, handleClose }: VersionModalProps) => {
    const { t, i18n } = useTranslation();
    const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { config, recentlyUpdated } = useAppContext();

    useEffect(() => {
        if (open) {
            fetchVersionInfo();
        }
    }, [open, config]);

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
        // Uses i18n language setting for date formatting
        return new Date(dateString).toLocaleDateString(i18n.language, {
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

            // Check if this is a "recently updated" situation where we need to show changes
            const lastSeenVersion = config?.lastSeenVersion;
            const showChanges = recentlyUpdated && lastSeenVersion && lastSeenVersion !== currentVersion;

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

            if (showChanges) {
                // Handle showing changes between lastSeenVersion and currentVersion
                const normalizedCurrentVersion = normalizeVersion(currentVersion);
                const normalizedLastSeenVersion = normalizeVersion(lastSeenVersion);

                // Find direct match for current version
                const currentVersionRelease = sortedReleases.find(release =>
                    normalizeVersion(release.tag_name) === normalizedCurrentVersion
                );

                // Find the closest intermediate release if no exact match for current version
                if (!currentVersionRelease) {
                    // Find the most recent release that's newer than lastSeenVersion
                    // This handles the case when the exact current version isn't in GitHub releases
                    const closestRelease = sortedReleases.find(release =>
                        compareVersions(normalizeVersion(release.tag_name), normalizedLastSeenVersion) > 0
                    );

                    if (closestRelease) {
                        const notes = cleanReleaseNotes(closestRelease.body || '');
                        setReleaseInfo({
                            version: closestRelease.tag_name,
                            notes: notes || t('version.changesNotFound', { oldVersion: lastSeenVersion, newVersion: currentVersion }),
                            date: formatDate(closestRelease.published_at),
                            isExactMatch: false
                        });
                    } else {
                        // No releases found after lastSeenVersion, show latest available changelog
                        const latestRelease = sortedReleases[0]; // Already sorted newest first
                        if (latestRelease) {
                            const notes = cleanReleaseNotes(latestRelease.body || '');
                            setReleaseInfo({
                                version: latestRelease.tag_name,
                                notes: notes || t('version.noDetailedNotes'),
                                date: formatDate(latestRelease.published_at),
                                isExactMatch: false
                            });
                        } else {
                            // No releases found at all
                            setReleaseInfo({
                                version: currentVersion,
                                notes: t('version.noChangelog'),
                                date: new Date().toLocaleDateString(i18n.language),
                                isExactMatch: false
                            });
                        }
                    }
                } else {
                    // We found an exact match for the current version
                    const notes = cleanReleaseNotes(currentVersionRelease.body || '');
                    if (notes) {
                        setReleaseInfo({
                            version: currentVersionRelease.tag_name,
                            notes,
                            date: formatDate(currentVersionRelease.published_at),
                            isExactMatch: true
                        });
                    } else {
                        // Found current version but no detailed notes, show latest available changelog
                        const latestRelease = sortedReleases[0]; // Already sorted newest first
                        if (latestRelease && latestRelease.tag_name !== currentVersionRelease.tag_name) {
                            const latestNotes = cleanReleaseNotes(latestRelease.body || '');
                            setReleaseInfo({
                                version: latestRelease.tag_name,
                                notes: latestNotes || t('version.noDetailedNotes'),
                                date: formatDate(latestRelease.published_at),
                                isExactMatch: false
                            });
                        } else {
                            // No other releases to show
                            setReleaseInfo({
                                version: currentVersionRelease.tag_name,
                                notes: t('version.noDetailedNotes'),
                                date: formatDate(currentVersionRelease.published_at),
                                isExactMatch: false
                            });
                        }
                    }
                }
            } else {
                // Default behavior - just show current version notes
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
                            date: formatDate(currentRelease.published_at),
                            isExactMatch: true
                        });
                    } else {
                        setReleaseInfo({
                            version: currentRelease.tag_name,
                            notes: t('version.noDetailedNotes'),
                            date: formatDate(currentRelease.published_at),
                            isExactMatch: false
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
                                date: formatDate(closestRelease.published_at),
                                isExactMatch: false
                            });
                        } else {
                            setReleaseInfo({
                                version: closestRelease.tag_name,
                                notes: t('version.noDetailedNotes'),
                                date: formatDate(closestRelease.published_at),
                                isExactMatch: false
                            });
                        }
                    } else if (sortedReleases.length > 0) {
                        // Fallback to the most recent release if no match is found
                        const latestRelease = sortedReleases[0];
                        const notes = cleanReleaseNotes(latestRelease.body || '');

                        setReleaseInfo({
                            version: latestRelease.tag_name,
                            notes: notes || t('version.noDetailedNotes'),
                            date: formatDate(latestRelease.published_at),
                            isExactMatch: false
                        });
                    } else {
                        setReleaseInfo({
                            version: currentVersion,
                            notes: t('version.noChangelog'),
                            date: 'N/A',
                            isExactMatch: false
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch release info:', error);
            setReleaseInfo({
                version: getAppVersion(),
                notes: t('version.fetchError'),
                date: 'N/A',
                isExactMatch: false
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Dynamic title based on whether we're showing update changelog
    const getTitle = () => {
        if (recentlyUpdated && config?.lastSeenVersion) {
            return t('version.titleUpdate');
        }
        return t('version.titleCurrent');
    };

    return (
        <CenteredModal open={open} handleClose={handleClose} title={getTitle()}>
            <Box sx={{ p: 2 }}>
                <Typography variant='h6' gutterBottom>
                    {t('version.header', { version: getAppVersion() })}
                </Typography>

                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : releaseInfo ? (
                    <Box sx={{ my: 2, maxHeight: '350px', overflowY: 'auto' }}>
                        <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                            {t('version.releaseNotes')}
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                            {(!releaseInfo.isExactMatch ||
                                releaseInfo.version !== getAppVersion() &&
                                releaseInfo.version !== `v${getAppVersion()}` &&
                                `v${releaseInfo.version}` !== getAppVersion()) && (
                                <Typography variant='body2' color='warning.main' sx={{ mb: 1 }}>
                                    {recentlyUpdated && config?.lastSeenVersion
                                        ? t('version.showingNotesUpdated', { version: releaseInfo.version, oldVersion: config.lastSeenVersion })
                                        : t('version.showingNotes', { version: releaseInfo.version })
                                    }
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