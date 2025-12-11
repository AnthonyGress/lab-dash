import axios from 'axios';
import { Request, Response, Router } from 'express';

import { authenticateToken } from '../middleware/auth.middleware';
import { getItemConnectionInfo } from '../utils/config-lookup';
import { decrypt, encrypt, isEncrypted } from '../utils/crypto';

export const githubRoute = Router();

const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// Cache for GitHub data (5 minutes)
const cache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface GitHubRepo {
    name: string;
    fullName: string;
    url: string;
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    openPRs: number;
    isArchived: boolean;
    isFork: boolean;
    lastCommit: {
        message: string;
        date: string;
        author: string;
    } | null;
    ciStatus: 'passing' | 'failing' | 'none' | 'pending';
    ciUrl: string | null;
}

interface GitHubStats {
    user: {
        login: string;
        avatarUrl: string;
    };
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
    repositories: GitHubRepo[];
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
        recentlyOpened: number;
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

/**
 * GraphQL query to fetch comprehensive GitHub stats
 */
const GITHUB_STATS_QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    avatarUrl
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      nodes {
        name
        nameWithOwner
        url
        stargazerCount
        forkCount
        watchers {
          totalCount
        }
        isArchived
        isFork
        issues(states: OPEN) {
          totalCount
        }
        pullRequests(states: OPEN) {
          totalCount
        }
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 5) {
                nodes {
                  message
                  committedDate
                  author {
                    name
                  }
                  url
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

/**
 * Query to get PRs awaiting review and user's PRs
 */
const GITHUB_PRS_QUERY = `
query {
  reviewRequested: search(query: "is:pr is:open review-requested:@me", type: ISSUE, first: 20) {
    issueCount
    nodes {
      ... on PullRequest {
        repository {
          name
        }
        title
        number
        url
        author {
          login
        }
        createdAt
      }
    }
  }
  userPRs: search(query: "is:pr is:open author:@me", type: ISSUE, first: 20) {
    issueCount
    nodes {
      ... on PullRequest {
        repository {
          name
        }
        title
        number
        url
        createdAt
      }
    }
  }
  assignedIssues: search(query: "is:issue is:open assignee:@me", type: ISSUE, first: 20) {
    issueCount
    nodes {
      ... on Issue {
        repository {
          name
        }
        title
        number
        url
        createdAt
      }
    }
  }
}
`;

/**
 * Get cached data if still valid
 */
function getCachedData(key: string): any | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

/**
 * Set cache data
 */
function setCacheData(key: string, data: any): void {
    cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Fetch CI status for a repository using REST API
 */
async function fetchCIStatus(owner: string, repo: string, token: string): Promise<{ status: 'passing' | 'failing' | 'none' | 'pending'; url: string | null; conclusion: string; updatedAt: string }> {
    try {
        const response = await axios.get(
            `${GITHUB_API_URL}/repos/${owner}/${repo}/actions/runs`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json'
                },
                params: { per_page: 1 }
            }
        );

        if (response.data.workflow_runs && response.data.workflow_runs.length > 0) {
            const run = response.data.workflow_runs[0];
            let status: 'passing' | 'failing' | 'pending' = 'pending';

            if (run.conclusion === 'success') {
                status = 'passing';
            } else if (run.conclusion === 'failure' || run.conclusion === 'cancelled' || run.conclusion === 'timed_out') {
                status = 'failing';
            } else if (run.status === 'in_progress' || run.status === 'queued') {
                status = 'pending';
            }

            return {
                status,
                url: run.html_url,
                conclusion: run.conclusion || run.status,
                updatedAt: run.updated_at
            };
        }

        return { status: 'none', url: null, conclusion: '', updatedAt: '' };
    } catch (error) {
        return { status: 'none', url: null, conclusion: '', updatedAt: '' };
    }
}

/**
 * Helper function to get GitHub token from item config
 */
const getGitHubToken = (itemId: string): string | null => {
    try {
        const connectionInfo = getItemConnectionInfo(itemId);
        let token = connectionInfo.token;

        if (!token) {
            return null;
        }

        // Handle encrypted token
        if (isEncrypted(token)) {
            token = decrypt(token);
            if (!token) {
                console.error('GitHub token decryption failed');
                return null;
            }
        }

        return token;
    } catch (error) {
        console.error('Error getting GitHub token:', error);
        return null;
    }
};

/**
 * Helper function to get widget config options from item config
 */
const getWidgetOptions = (itemId: string): { includeForks: boolean; includeArchived: boolean; repoFilter: string; excludeRepos: string } => {
    try {
        const connectionInfo = getItemConnectionInfo(itemId);
        return {
            includeForks: connectionInfo.includeForks ?? false,
            includeArchived: connectionInfo.includeArchived ?? false,
            repoFilter: connectionInfo.repoFilter ?? '',
            excludeRepos: connectionInfo.excludeRepos ?? ''
        };
    } catch (error) {
        return { includeForks: false, includeArchived: false, repoFilter: '', excludeRepos: '' };
    }
};

/**
 * POST /api/github/stats
 * Fetch all GitHub stats for the widget
 */
githubRoute.post('/stats', async (req: Request, res: Response): Promise<void> => {
    console.log('GitHub stats endpoint called');
    const { itemId } = req.body;
    console.log('GitHub stats request for itemId:', itemId);

    if (!itemId) {
        console.log('GitHub stats: No itemId provided');
        res.status(400).json({ error: 'Item ID is required' });
        return;
    }

    try {
        // Get token from stored item config
        const token = getGitHubToken(itemId);
        console.log('GitHub token found:', token ? 'yes (length: ' + token.length + ')' : 'no');

        if (!token) {
            console.log('GitHub stats: No token found for itemId:', itemId);
            res.status(400).json({ error: 'GitHub token is required' });
            return;
        }

        // Get widget options
        const options = getWidgetOptions(itemId);

        // Check cache
        const cacheKey = `github_${itemId}`;
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
            res.json(cachedData);
            return;
        }

        // Fetch user and repository data
        const graphqlResponse = await axios.post(
            GITHUB_GRAPHQL_URL,
            {
                query: GITHUB_STATS_QUERY,
                variables: { login: '' }  // Empty login uses authenticated user
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // First get the authenticated user's login
        const viewerResponse = await axios.post(
            GITHUB_GRAPHQL_URL,
            {
                query: `query { viewer { login avatarUrl } }`
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const viewer = viewerResponse.data.data.viewer;

        // Fetch repos with the user's login
        const reposResponse = await axios.post(
            GITHUB_GRAPHQL_URL,
            {
                query: GITHUB_STATS_QUERY,
                variables: { login: viewer.login }
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (reposResponse.data.errors) {
            console.error('GitHub GraphQL errors:', reposResponse.data.errors);
            res.status(400).json({ error: 'GitHub API error', details: reposResponse.data.errors });
            return;
        }

        const userData = reposResponse.data.data.user;

        // Filter repositories
        let repos = userData.repositories.nodes.filter((repo: any) => {
            if (!options.includeArchived && repo.isArchived) return false;
            if (!options.includeForks && repo.isFork) return false;
            return true;
        });

        // Apply repo filter if specified
        if (options.repoFilter) {
            const filterList = options.repoFilter.split(',').map((r: string) => r.trim().toLowerCase());
            repos = repos.filter((repo: any) => filterList.includes(repo.name.toLowerCase()));
        }

        // Apply repo exclusions if specified
        if (options.excludeRepos) {
            const excludeList = options.excludeRepos.split(',').map((r: string) => r.trim().toLowerCase());
            repos = repos.filter((repo: any) => !excludeList.includes(repo.name.toLowerCase()));
        }

        // Fetch CI status for each repo (limited to first 20 to avoid rate limits)
        const reposWithCI = await Promise.all(
            repos.slice(0, 20).map(async (repo: any) => {
                const [owner, repoName] = repo.nameWithOwner.split('/');
                const ciResult = await fetchCIStatus(owner, repoName, token);
                return {
                    ...repo,
                    ciStatus: ciResult.status,
                    ciUrl: ciResult.url,
                    ciConclusion: ciResult.conclusion,
                    ciUpdatedAt: ciResult.updatedAt
                };
            })
        );

        // Add 'none' CI status for repos we didn't check
        const allRepos = [
            ...reposWithCI,
            ...repos.slice(20).map((repo: any) => ({ ...repo, ciStatus: 'none', ciUrl: null }))
        ];

        // Fetch PRs and Issues data
        let prsData: any = { reviewRequested: null, userPRs: null, assignedIssues: null };
        try {
            const prsResponse = await axios.post(
                GITHUB_GRAPHQL_URL,
                { query: GITHUB_PRS_QUERY },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (prsResponse.data.errors) {
                console.warn('GitHub PRs query errors:', prsResponse.data.errors);
            }

            prsData = prsResponse.data.data || prsData;
        } catch (prsError: any) {
            console.warn('Failed to fetch PRs data:', prsError.message);
            // Continue with empty PRs data
        }

        // Calculate totals
        const totals = {
            stars: 0,
            forks: 0,
            watchers: 0,
            openIssues: 0,
            openPRs: 0
        };

        const ci = {
            passing: 0,
            failing: 0,
            none: 0,
            pending: 0,
            failingRepos: [] as Array<{ name: string; url: string; conclusion: string; updatedAt: string }>
        };

        const recentCommits: Array<{
            repo: string;
            message: string;
            date: string;
            author: string;
            url: string;
        }> = [];

        const repositories: GitHubRepo[] = [];

        allRepos.forEach((repo: any) => {
            totals.stars += repo.stargazerCount || 0;
            totals.forks += repo.forkCount || 0;
            totals.watchers += repo.watchers?.totalCount || 0;
            totals.openIssues += repo.issues?.totalCount || 0;
            totals.openPRs += repo.pullRequests?.totalCount || 0;

            // CI stats
            if (repo.ciStatus === 'passing') ci.passing++;
            else if (repo.ciStatus === 'failing') {
                ci.failing++;
                ci.failingRepos.push({
                    name: repo.name,
                    url: repo.ciUrl || repo.url,
                    conclusion: repo.ciConclusion,
                    updatedAt: repo.ciUpdatedAt
                });
            }
            else if (repo.ciStatus === 'pending') ci.pending++;
            else ci.none++;

            // Collect recent commits
            const commits = repo.defaultBranchRef?.target?.history?.nodes || [];
            commits.forEach((commit: any) => {
                recentCommits.push({
                    repo: repo.name,
                    message: commit.message.split('\n')[0], // First line only
                    date: commit.committedDate,
                    author: commit.author?.name || 'Unknown',
                    url: commit.url
                });
            });

            // Build repository object
            repositories.push({
                name: repo.name,
                fullName: repo.nameWithOwner,
                url: repo.url,
                stars: repo.stargazerCount || 0,
                forks: repo.forkCount || 0,
                watchers: repo.watchers?.totalCount || 0,
                openIssues: repo.issues?.totalCount || 0,
                openPRs: repo.pullRequests?.totalCount || 0,
                isArchived: repo.isArchived,
                isFork: repo.isFork,
                lastCommit: commits[0] ? {
                    message: commits[0].message.split('\n')[0],
                    date: commits[0].committedDate,
                    author: commits[0].author?.name || 'Unknown'
                } : null,
                ciStatus: repo.ciStatus,
                ciUrl: repo.ciUrl
            });
        });

        // Sort recent commits by date and take top 10
        recentCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const topRecentCommits = recentCommits.slice(0, 10);

        // Build PRs data
        const prs = {
            total: totals.openPRs,
            awaitingReview: prsData.reviewRequested?.issueCount || 0,
            yourPRs: prsData.userPRs?.issueCount || 0,
            recent: [
                ...(prsData.reviewRequested?.nodes || []).map((pr: any) => ({
                    repo: pr.repository?.name || '',
                    title: pr.title,
                    number: pr.number,
                    url: pr.url,
                    author: pr.author?.login || '',
                    createdAt: pr.createdAt,
                    isYours: false,
                    awaitingYourReview: true
                })),
                ...(prsData.userPRs?.nodes || []).map((pr: any) => ({
                    repo: pr.repository?.name || '',
                    title: pr.title,
                    number: pr.number,
                    url: pr.url,
                    author: viewer.login,
                    createdAt: pr.createdAt,
                    isYours: true,
                    awaitingYourReview: false
                }))
            ].slice(0, 10)
        };

        // Build issues data
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const issues = {
            total: totals.openIssues,
            assignedToYou: prsData.assignedIssues?.issueCount || 0,
            recentlyOpened: 0, // Would need additional query
            recent: (prsData.assignedIssues?.nodes || []).map((issue: any) => ({
                repo: issue.repository?.name || '',
                title: issue.title,
                number: issue.number,
                url: issue.url,
                createdAt: issue.createdAt,
                isAssignedToYou: true
            })).slice(0, 10)
        };

        const stats: GitHubStats = {
            user: {
                login: viewer.login,
                avatarUrl: viewer.avatarUrl
            },
            totalRepos: repositories.length,
            totals,
            ci,
            recentCommits: topRecentCommits,
            repositories,
            prs,
            issues,
            lastChecked: new Date().toISOString()
        };

        // Cache the results
        setCacheData(cacheKey, stats);

        res.json(stats);
    } catch (error: any) {
        console.error('Error fetching GitHub stats:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            res.status(401).json({ error: 'Invalid or expired GitHub token' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: 'GitHub API rate limit exceeded or insufficient permissions' });
        } else {
            res.status(500).json({ error: 'Failed to fetch GitHub stats' });
        }
    }
});

/**
 * POST /api/github/validate
 * Validate a GitHub token
 */
githubRoute.post('/validate', async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body;

    if (!token) {
        res.status(400).json({ error: 'Token is required' });
        return;
    }

    try {
        const response = await axios.get(`${GITHUB_API_URL}/user`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        res.json({
            valid: true,
            user: {
                login: response.data.login,
                avatarUrl: response.data.avatar_url,
                name: response.data.name
            }
        });
    } catch (error: any) {
        if (error.response?.status === 401) {
            res.status(401).json({ valid: false, error: 'Invalid token' });
        } else {
            res.status(500).json({ valid: false, error: 'Failed to validate token' });
        }
    }
});
