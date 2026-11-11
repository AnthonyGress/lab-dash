import bcrypt from 'bcrypt';
import { Request, Response, Router } from 'express';

import { authenticateToken } from '../middleware/auth.middleware';
import { endSession } from '../realtime/gateway';
import { readUsers, revokeSession, rotateSession, SessionTokens, startSession, writeUsers } from '../services/users';

export const authRoute = Router();

const COOKIE_OPTIONS = { httpOnly: true, secure: false, sameSite: 'lax', path: '/' } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const setSessionCookies = (res: Response, tokens: SessionTokens): void => {
    res.cookie('access_token', tokens.accessToken, { ...COOKIE_OPTIONS, maxAge: DAY_MS });
    res.cookie('refresh_token', tokens.refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * DAY_MS });
};

// Options must match how the cookies were set, or the browser keeps them
const clearSessionCookies = (res: Response): void => {
    res.clearCookie('access_token', COOKIE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_OPTIONS);
};

// Signup route
authRoute.post('/signup', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            res.status(400).json({ message: 'Username and password are required' });
            return;
        }

        // Check if username is already taken
        const users = readUsers();
        if (users.some(user => user.username === username)) {
            res.status(409).json({ message: 'Username already exists' });
            return;
        }

        // Hash the password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // First user is automatically an admin, others are regular users
        const isFirstUser = users.length === 0;
        const role = isFirstUser ? 'admin' : 'user';

        // Store the new user; sessions are added at login
        users.push({
            username,
            passwordHash,
            role
        });
        writeUsers(users);

        // Return success response
        res.status(201).json({ message: 'User created successfully', username });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login route
authRoute.post('/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            res.status(400).json({ message: 'Username and password are required' });
            return;
        }

        // Find the user
        const user = readUsers().find(candidate => candidate.username === username);

        if (!user) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const tokens = startSession(username);

        if (!tokens) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        // Set secure HTTP-only cookies
        setSessionCookies(res, tokens);

        // Return success without including tokens in response body
        res.json({
            message: 'Login successful',
            username: username,
            isAdmin: user.role === 'admin'
        });
        console.log('login successful');
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Refresh token route
authRoute.post('/refresh', async (req: Request, res: Response) => {
    try {
        // Get refresh token from cookie
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
            // Don't send a 400 error, just indicate no refresh needed
            res.status(204).end(); // 204 No Content - request processed but no content to return
            return;
        }

        const result = rotateSession(refreshToken);

        if (typeof result === 'string') {
            const messages = {
                expired: 'Refresh token expired',
                invalid: 'Invalid refresh token',
                unknown: 'Refresh token not found'
            };
            console.log(`Token refresh refused: ${messages[result]}`);

            // The browser cannot use these cookies again, so stop it from sending them
            clearSessionCookies(res);
            res.status(401).json({ message: messages[result] });
            return;
        }

        setSessionCookies(res, result.tokens);

        // Return success message with user role information
        res.json({
            message: 'Token refreshed successfully',
            isAdmin: result.isAdmin
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout route
authRoute.post('/logout', (req: Request, res: Response) => {
    try {
        // Get refresh token from cookie
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
            // If no refresh token is provided, it might be a request from a service
            // Don't clear cookies in this case to avoid disrupting service auth
            console.log('Logout request without refresh token - not clearing cookies');
            res.json({ message: 'No session to logout' });
            return;
        }

        revokeSession(refreshToken);

        // Other tabs of this browser keep their socket; without this they would stay logged in
        endSession(req.cookies?.access_token);

        clearSessionCookies(res);

        // Additionally clear without httpOnly for client-side cookies
        res.clearCookie('access_token', {
            secure: false,
            path: '/'
        });

        res.clearCookie('refresh_token', {
            secure: false,
            path: '/'
        });

        console.log('Auth cookies cleared by server');
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Check if any users exist in the system
authRoute.get('/check-users', (req: Request, res: Response) => {
    try {
        const users = readUsers();
        const hasUsers = users.length > 0;

        res.json({ hasUsers });
    } catch (error) {
        console.error('Error checking users:', error);
        res.status(500).json({ message: 'Failed to check if users exist' });
    }
});

// Check if the current user is an admin
authRoute.get('/check-admin', [authenticateToken], (req: Request, res: Response) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        res.json({ isAdmin });
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).json({ message: 'Failed to check admin status' });
    }
});

authRoute.get('/check-cookies', (req: Request, res: Response) => {
    // Only whether they exist: sending the values back would let page scripts read httpOnly cookies
    res.json({
        hasAccessToken: !!req.cookies.access_token,
        hasRefreshToken: !!req.cookies.refresh_token
    });
});
