import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Grid2 as Grid,
    IconButton,
    Link,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { FaClock, FaCodeBranch, FaExclamationTriangle, FaGithub, FaStar, FaTimes } from 'react-icons/fa';
import { GoGitPullRequest, GoIssueOpened, GoCheck, GoX, GoEye } from 'react-icons/go';

import { DashApi } from '../../../../../api/dash-api';

interface GitHubWidgetConfig {
    token?: string;
    _hasToken?: boolean;
    refreshInterval?: number;
    showLabel?: boolean;
    displayName?: string;
    includeForks?: boolean;
    includeArchived?: boolean;
    repoFilter?: string;
    excludeRepos?: string;
}

interface GitHubWidgetProps {
    config?: GitHubWidgetConfig;
    editMode?: boolean;
    id?: string;
}

interface GitHubStats {
    user: { login: string; avatarUrl: string };
    totalRepos: number;
    totals: {
        stars: number;
        forks: number;
        watchers: number;
        openIssues: number;
        openPRs: number;
    };
    ci: {
        passing: number;
        failing: number;
        none: number;
        pending: number;
        failingRepos: Array<{ name: string; url: string; conclusion: string; updatedAt: string }>;
    };
    recentCommits: Array<{
        repo: string;
        message: string;
        date: string;
        author: string;
        url: string;
    }>;
    repositories: Array<{
        name: string;
        fullName: string;
        url: string;
        stars: number;
        forks: number;
        watchers: number;
        openIssues: number;
        openPRs: number;
        ciStatus: string;
        ciUrl: string | null;
    }>;
    prs: {
        total: number;
        awaitingReview: number;
        yourPRs: number;
        recent: Array<{
            repo: string;
            title: string;
            number: number;
            url: string;
            author: string;
            createdAt: string;
            isYours: boolean;
            awaitingYourReview: boolean;
        }>;
    };
    issues: {
        total: number;
        assignedToYou: number;
        recent: Array<{
            repo: string;
            title: string;
            number: number;
            url: string;
            createdAt: string;
            isAssignedToYou: boolean;
        }>;
    };
    lastChecked: string;
}

type ModalType = 'stars' | 'forks' | 'issues' | 'prs' | 'ci' | 'commits' | 'watchers' | null;

const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    const diffWeek = Math.floor(diffDay / 7);
    return `${diffWeek}w ago`;
};

export const GitHubWidget = ({ config, editMode, id }: GitHubWidgetProps) => {
    const [stats, setStats] = useState<GitHubStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState<ModalType>(null);
    const [, setTick] = useState(0);
    const isMountedRef = useRef(true);

    const refreshInterval = config?.refreshInterval || 3600000; // Default 1 hour
    const showLabel = config?.showLabel !== false;
    const displayName = config?.displayName || 'GitHub Stats';
    const hasToken = config?._hasToken || (config?.token && !config.token.startsWith('*'));

    const fetchStats = async () => {
        if (!isMountedRef.current || !id) return;
        if (!hasToken) {
            setError('GitHub token required');
            setIsLoading(false);
            return;
        }

        try {
            if (!stats) setIsLoading(true);
            const data = await DashApi.getGitHubStats(id, config);
            if (!isMountedRef.current) return;
            setStats(data);
            setError(null);
        } catch (err: any) {
            if (!isMountedRef.current) return;
            if (err.response?.status === 401) {
                setError('Invalid or expired GitHub token');
            } else if (err.response?.status === 403) {
                setError('Rate limit exceeded or insufficient permissions');
            } else {
                setError('Failed to fetch GitHub stats');
            }
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    };

    useEffect(() => {
        isMountedRef.current = true;

        if (!editMode && hasToken) {
            fetchStats();
            const dataInterval = setInterval(fetchStats, refreshInterval);
            const tickInterval = setInterval(() => setTick(t => t + 1), 60000);

            return () => {
                isMountedRef.current = false;
                clearInterval(dataInterval);
                clearInterval(tickInterval);
            };
        }

        return () => { isMountedRef.current = false; };
    }, [editMode, id, refreshInterval, hasToken]);

    const handleOpenModal = (type: ModalType) => {
        if (!editMode) setModalOpen(type);
    };

    // Not configured state
    if (!hasToken) {
        return (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                <Typography variant='body2' align='center' color='text.secondary'>
                    Please configure your GitHub token in settings
                </Typography>
            </Box>
        );
    }

    // Error state
    if (error) {
        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                <FaExclamationTriangle style={{ fontSize: '2rem', marginBottom: '8px', color: '#f44336' }} />
                <Typography variant='body2' align='center' sx={{ mb: 2 }}>{error}</Typography>
                <Button variant='contained' size='small' onClick={() => { setError(null); fetchStats(); }}>
                    Retry
                </Button>
            </Box>
        );
    }

    // Loading state
    if (isLoading && !stats) {
        return (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={30} sx={{ mb: 1 }} />
                    <Typography variant='body2'>Loading GitHub stats...</Typography>
                </Box>
            </Box>
        );
    }

    if (!stats) return null;

    const statBoxStyle = {
        p: '8px 6px',
        minHeight: '60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        cursor: editMode ? 'grab' : 'pointer',
        borderRadius: 1,
        transition: 'transform 0.1s, box-shadow 0.1s',
        '&:hover': editMode ? {} : {
            transform: 'scale(1.02)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }
    };

    return (
        <Box
            sx={{
                p: 0.5,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {showLabel && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <FaGithub style={{ marginRight: '8px', fontSize: '1.1rem' }} />
                            <Typography variant='h6' sx={{ mb: 0, fontSize: '1rem' }}>
                                {displayName}
                            </Typography>
                            <Typography variant='caption' sx={{ ml: 1, opacity: 0.7 }}>
                                ({stats.totalRepos} repos)
                            </Typography>
                        </Box>
                    )}
                </Box>
                {showLabel && (
                    <Typography variant='caption' sx={{ opacity: 0.6, fontSize: '0.65rem' }}>
                        {formatTimeAgo(stats.lastChecked)}
                    </Typography>
                )}
            </Box>

            {/* Stats Grid - 2x4 layout */}
            <Grid container spacing={0.4} sx={{ flex: 1 }}>
                {/* Stars */}
                <Grid size={{ xs: 3 }}>
                    <Paper elevation={0} sx={{ ...statBoxStyle, backgroundColor: '#b8860b' }} onClick={() => handleOpenModal('stars')}>
                        <FaStar style={{ fontSize: '1rem', marginBottom: '2px' }} />
                        <Typography variant='caption' sx={{ fontSize: '0.6rem', opacity: 0.9 }}>Stars</Typography>
                        <Typography variant='subtitle2' fontWeight='bold' sx={{ fontSize: '0.85rem' }}>
                            {stats.totals.stars.toLocaleString()}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Forks */}
                <Grid size={{ xs: 3 }}>
                    <Paper elevation={0} sx={{ ...statBoxStyle, backgroundColor: '#3498db' }} onClick={() => handleOpenModal('forks')}>
                        <FaCodeBranch style={{ fontSize: '1rem', marginBottom: '2px' }} />
                        <Typography variant='caption' sx={{ fontSize: '0.6rem', opacity: 0.9 }}>Forks</Typography>
                        <Typography variant='subtitle2' fontWeight='bold' sx={{ fontSize: '0.85rem' }}>
                            {stats.totals.forks.toLocaleString()}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Issues */}
                <Grid size={{ xs: 3 }}>
                    <Paper elevation={0} sx={{ ...statBoxStyle, backgroundColor: '#e67e22' }} onClick={() => handleOpenModal('issues')}>
                        <GoIssueOpened style={{ fontSize: '1rem', marginBottom: '2px' }} />
                        <Typography variant='caption' sx={{ fontSize: '0.6rem', opacity: 0.9 }}>Issues</Typography>
                        <Typography variant='subtitle2' fontWeight='bold' sx={{ fontSize: '0.85rem' }}>
                            {stats.totals.openIssues.toLocaleString()}
                        </Typography>
                    </Paper>
                </Grid>

                {/* PRs */}
                <Grid size={{ xs: 3 }}>
                    <Paper elevation={0} sx={{ ...statBoxStyle, backgroundColor: '#9b59b6' }} onClick={() => handleOpenModal('prs')}>
                        <GoGitPullRequest style={{ fontSize: '1rem', marginBottom: '2px' }} />
                        <Typography variant='caption' sx={{ fontSize: '0.6rem', opacity: 0.9 }}>PRs</Typography>
                        <Typography variant='subtitle2' fontWeight='bold' sx={{ fontSize: '0.85rem' }}>
                            {stats.totals.openPRs.toLocaleString()}
                        </Typography>
                    </Paper>
                </Grid>

                {/* CI Passing */}
                <Grid size={{ xs: 3 }}>
                    <Paper elevation={0} sx={{ ...statBoxStyle, backgroundColor: '#004A28' }} onClick={() => handleOpenModal('ci')}>
                        <GoCheck style={{ fontSize: '1rem', marginBottom: '2px' }} />
                        <Typography variant='caption' sx={{ fontSize: '0.6rem', opacity: 0.9 }}>CI Pass</Typography>
                        <Typography variant='subtitle2' fontWeight='bold' sx={{ fontSize: '0.85rem' }}>
                            {stats.ci.passing}
                        </Typography>
                    </Paper>
                </Grid>

                {/* CI Failing */}
                <Grid size={{ xs: 3 }}>
                    <Paper elevation={0} sx={{ ...statBoxStyle, backgroundColor: stats.ci.failing > 0 ? '#c0392b' : '#555' }} onClick={() => handleOpenModal('ci')}>
                        <GoX style={{ fontSize: '1rem', marginBottom: '2px' }} />
                        <Typography variant='caption' sx={{ fontSize: '0.6rem', opacity: 0.9 }}>CI Fail</Typography>
                        <Typography variant='subtitle2' fontWeight='bold' sx={{ fontSize: '0.85rem' }}>
                            {stats.ci.failing}
                        </Typography>
                    </Paper>
                </Grid>

                {/* Commits */}
                <Grid size={{ xs: 3 }}>
                    <Paper elevation={0} sx={{ ...statBoxStyle, backgroundColor: '#006179' }} onClick={() => handleOpenModal('commits')}>
                        <FaClock style={{ fontSize: '1rem', marginBottom: '2px' }} />
                        <Typography variant='caption' sx={{ fontSize: '0.6rem', opacity: 0.9 }}>Commits</Typography>
                        <Typography variant='subtitle2' fontWeight='bold' sx={{ fontSize: '0.85rem' }}>
                            {stats.recentCommits.length}+
                        </Typography>
                    </Paper>
                </Grid>

                {/* Watchers */}
                <Grid size={{ xs: 3 }}>
                    <Paper elevation={0} sx={{ ...statBoxStyle, backgroundColor: '#607d8b' }} onClick={() => handleOpenModal('watchers')}>
                        <GoEye style={{ fontSize: '1rem', marginBottom: '2px' }} />
                        <Typography variant='caption' sx={{ fontSize: '0.6rem', opacity: 0.9 }}>Watchers</Typography>
                        <Typography variant='subtitle2' fontWeight='bold' sx={{ fontSize: '0.85rem' }}>
                            {stats.totals.watchers.toLocaleString()}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* Footer with GitHub link */}
            <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Link
                    href={`https://github.com/${stats.user.login}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    sx={{
                        fontSize: '0.65rem',
                        color: 'text.secondary',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        '&:hover': { color: 'primary.main' }
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    @{stats.user.login}
                </Link>
            </Box>

            {/* Modals */}
            <DetailModal
                open={modalOpen !== null}
                onClose={() => setModalOpen(null)}
                type={modalOpen}
                stats={stats}
            />
        </Box>
    );
};

// Detail Modal Component
interface DetailModalProps {
    open: boolean;
    onClose: () => void;
    type: ModalType;
    stats: GitHubStats;
}

const DetailModal = ({ open, onClose, type, stats }: DetailModalProps) => {
    const getTitle = () => {
        switch (type) {
            case 'stars': return `Stars (${stats.totals.stars.toLocaleString()} total)`;
            case 'forks': return `Forks (${stats.totals.forks.toLocaleString()} total)`;
            case 'issues': return `Open Issues (${stats.totals.openIssues.toLocaleString()} total)`;
            case 'prs': return `Pull Requests (${stats.totals.openPRs.toLocaleString()} total)`;
            case 'ci': return 'CI/CD Status';
            case 'commits': return 'Recent Commits';
            case 'watchers': return `Watchers (${stats.totals.watchers.toLocaleString()} total)`;
            default: return '';
        }
    };

    const renderContent = () => {
        switch (type) {
            case 'stars':
            case 'forks':
            case 'watchers':
                const field = type === 'stars' ? 'stars' : type === 'forks' ? 'forks' : 'watchers';
                const sortedRepos = [...stats.repositories].sort((a, b) => b[field] - a[field]).filter(r => r[field] > 0);
                return (
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>Repository</TableCell>
                                <TableCell align='right'>{type.charAt(0).toUpperCase() + type.slice(1)}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedRepos.map(repo => (
                                <TableRow key={repo.name}>
                                    <TableCell>
                                        <Link href={repo.url} target='_blank' rel='noopener' color='primary'>
                                            {repo.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell align='right'>{repo[field].toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                            {sortedRepos.length === 0 && (
                                <TableRow><TableCell colSpan={2} align='center'>No data</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                );

            case 'issues':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant='subtitle2'>
                                Assigned to you: {stats.issues.assignedToYou}
                            </Typography>
                            <Link
                                href={`https://github.com/issues?q=is%3Aopen+is%3Aissue+author%3A${stats.user.login}`}
                                target='_blank'
                                rel='noopener'
                                sx={{ fontSize: '0.8rem' }}
                            >
                                View all on GitHub →
                            </Link>
                        </Box>
                        <Typography variant='subtitle2' sx={{ mb: 2 }}>Recent Issues:</Typography>
                        {stats.issues.recent.length > 0 ? (
                            stats.issues.recent.map((issue, idx) => (
                                <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                                    <Link href={issue.url} target='_blank' rel='noopener' color='primary' sx={{ fontSize: '0.9rem' }}>
                                        {issue.title}
                                    </Link>
                                    <Typography variant='caption' display='block' sx={{ opacity: 0.7 }}>
                                        {issue.repo} #{issue.number} - {formatTimeAgo(issue.createdAt)}
                                    </Typography>
                                </Box>
                            ))
                        ) : (
                            <Typography variant='body2' color='text.secondary'>No recent issues</Typography>
                        )}
                        <Typography variant='subtitle2' sx={{ mt: 2, mb: 1 }}>By Repository:</Typography>
                        <Table size='small'>
                            <TableBody>
                                {stats.repositories.filter(r => r.openIssues > 0).sort((a, b) => b.openIssues - a.openIssues).map(repo => (
                                    <TableRow key={repo.name}>
                                        <TableCell>
                                            <Link href={`${repo.url}/issues`} target='_blank' rel='noopener'>{repo.name}</Link>
                                        </TableCell>
                                        <TableCell align='right'>{repo.openIssues}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                );

            case 'prs':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Typography variant='body2'>Open: {stats.prs.total}</Typography>
                                <Typography variant='body2'>Awaiting Review: {stats.prs.awaitingReview}</Typography>
                                <Typography variant='body2'>Your PRs: {stats.prs.yourPRs}</Typography>
                            </Box>
                            <Link
                                href={`https://github.com/pulls?q=is%3Aopen+is%3Apr+author%3A${stats.user.login}`}
                                target='_blank'
                                rel='noopener'
                                sx={{ fontSize: '0.8rem' }}
                            >
                                View all on GitHub →
                            </Link>
                        </Box>
                        {stats.prs.recent.filter(pr => pr.awaitingYourReview).length > 0 && (
                            <>
                                <Typography variant='subtitle2' sx={{ mb: 1 }}>Awaiting Your Review:</Typography>
                                {stats.prs.recent.filter(pr => pr.awaitingYourReview).map((pr, idx) => (
                                    <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'rgba(155,89,182,0.2)', borderRadius: 1 }}>
                                        <Link href={pr.url} target='_blank' rel='noopener' color='primary' sx={{ fontSize: '0.9rem' }}>
                                            {pr.title}
                                        </Link>
                                        <Typography variant='caption' display='block' sx={{ opacity: 0.7 }}>
                                            {pr.repo} #{pr.number} by @{pr.author} - {formatTimeAgo(pr.createdAt)}
                                        </Typography>
                                    </Box>
                                ))}
                            </>
                        )}
                        {stats.prs.recent.filter(pr => pr.isYours).length > 0 && (
                            <>
                                <Typography variant='subtitle2' sx={{ mt: 2, mb: 1 }}>Your Open PRs:</Typography>
                                {stats.prs.recent.filter(pr => pr.isYours).map((pr, idx) => (
                                    <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'rgba(52,152,219,0.2)', borderRadius: 1 }}>
                                        <Link href={pr.url} target='_blank' rel='noopener' color='primary' sx={{ fontSize: '0.9rem' }}>
                                            {pr.title}
                                        </Link>
                                        <Typography variant='caption' display='block' sx={{ opacity: 0.7 }}>
                                            {pr.repo} #{pr.number} - {formatTimeAgo(pr.createdAt)}
                                        </Typography>
                                    </Box>
                                ))}
                            </>
                        )}
                    </Box>
                );

            case 'ci':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Typography variant='body2' sx={{ color: '#27ae60' }}>Passing: {stats.ci.passing}</Typography>
                                <Typography variant='body2' sx={{ color: '#e74c3c' }}>Failing: {stats.ci.failing}</Typography>
                                <Typography variant='body2' sx={{ color: '#f39c12' }}>Pending: {stats.ci.pending}</Typography>
                                <Typography variant='body2' sx={{ color: '#95a5a6' }}>No CI: {stats.ci.none}</Typography>
                            </Box>
                            <Link
                                href={`https://github.com/${stats.user.login}?tab=repositories`}
                                target='_blank'
                                rel='noopener'
                                sx={{ fontSize: '0.8rem' }}
                            >
                                View repos on GitHub →
                            </Link>
                        </Box>
                        {stats.ci.failingRepos.length > 0 && (
                            <>
                                <Typography variant='subtitle2' sx={{ mb: 1, color: '#e74c3c' }}>Failing Repos:</Typography>
                                {stats.ci.failingRepos.map((repo, idx) => (
                                    <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'rgba(231,76,60,0.2)', borderRadius: 1 }}>
                                        <Link href={repo.url} target='_blank' rel='noopener' color='error' sx={{ fontSize: '0.9rem' }}>
                                            {repo.name}
                                        </Link>
                                        <Typography variant='caption' display='block' sx={{ opacity: 0.7 }}>
                                            {repo.conclusion} - {formatTimeAgo(repo.updatedAt)}
                                        </Typography>
                                    </Box>
                                ))}
                            </>
                        )}
                    </Box>
                );

            case 'commits':
                return (
                    <Box>
                        {stats.recentCommits.map((commit, idx) => (
                            <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                                <Link href={commit.url} target='_blank' rel='noopener' color='primary' sx={{ fontSize: '0.9rem' }}>
                                    {commit.message.substring(0, 80)}{commit.message.length > 80 ? '...' : ''}
                                </Link>
                                <Typography variant='caption' display='block' sx={{ opacity: 0.7 }}>
                                    {commit.repo} by {commit.author} - {formatTimeAgo(commit.date)}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {getTitle()}
                <IconButton onClick={onClose} size='small'><FaTimes /></IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ maxHeight: '60vh' }}>
                {renderContent()}
            </DialogContent>
        </Dialog>
    );
};
