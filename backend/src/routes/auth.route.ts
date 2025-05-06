import bcrypt from 'bcrypt';
import { Request, Response, Router } from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';

import { authenticateToken } from '../middleware/auth.middleware';

export const authRoute = Router();
const USERS_PATH = path.join(__dirname, '../config/users.json');
const JWT_SECRET = process.env.SECRET || '@jZCgtn^qg8So*^^6A2M';
const REFRESH_TOKEN_SECRET = process.env.SECRET || '@jZCgtn^qg8So*^^6A2M';
const ACCESS_TOKEN_EXPIRY = '3d';
const REFRESH_TOKEN_EXPIRY = '7d';

// Interface for user data
interface User {
  username: string;
  passwordHash: string;
  refreshTokens?: string[];  // Store issued refresh tokens
  role: 'admin' | 'user';    // Role for authorization
}

// Helper function to read users from JSON file
const readUsers = (): User[] => {
    try {
    // Create directory if it doesn't exist
        const dir = path.dirname(USERS_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Create file if it doesn't exist
        if (!fs.existsSync(USERS_PATH)) {
            fs.writeFileSync(USERS_PATH, JSON.stringify([]));
            return [];
        }

        const data = fs.readFileSync(USERS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users:', error);
        return [];
    }
};

// Helper function to write users to JSON file
const writeUsers = (users: User[]): void => {
    try {
        const dir = path.dirname(USERS_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error writing users:', error);
    }
};

// Generate access token
const generateAccessToken = (username: string, role: string): string => {
    return jwt.sign({ username, role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

// Generate refresh token
const generateRefreshToken = (username: string): string => {
    return jwt.sign({ username }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

// Helper to get refresh token expiration date
const getTokenExpiration = (token: string): Date | null => {
    try {
        const decoded = jwt.decode(token) as { exp: number } | null;
        if (decoded && decoded.exp) {
            return new Date(decoded.exp * 1000);
        }
        return null;
    } catch (err) {
        console.error('Failed to decode token for expiration check:', err);
        return null;
    }
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

        // Store the new user with empty refresh tokens array
        users.push({
            username,
            passwordHash,
            refreshTokens: [],
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
        const users = readUsers();
        const userIndex = users.findIndex(user => user.username === username);

        if (userIndex === -1) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, users[userIndex].passwordHash);

        if (!passwordMatch) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        // Generate tokens
        const token = generateAccessToken(username, users[userIndex].role);
        const refreshToken = generateRefreshToken(username);

        // Store refresh token
        if (!users[userIndex].refreshTokens) {
            users[userIndex].refreshTokens = [];
        }
        users[userIndex].refreshTokens.push(refreshToken);
        writeUsers(users);

        // Set secure HTTP-only cookies
        res.cookie('access_token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
        });

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });

        // Return success without including tokens in response body
        res.json({
            message: 'Login successful',
            username: username,
            isAdmin: users[userIndex].role === 'admin'
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
        console.log('Refresh token request received');

        // Get refresh token from cookie
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
            console.log('No refresh token in cookies');
            // Don't send a 400 error, just indicate no refresh needed
            res.status(204).end(); // 204 No Content - request processed but no content to return
            return;
        }

        // Check token expiration date
        const expirationDate = getTokenExpiration(refreshToken);
        if (expirationDate) {
            const now = new Date();
            const timeLeft = expirationDate.getTime() - now.getTime();
            const minutesLeft = Math.floor(timeLeft / (1000 * 60));
            console.log(`Token expiration date: ${expirationDate.toISOString()}, ${minutesLeft} minutes left`);
        }

        // Verify refresh token
        let decoded: any;
        let tokenExpired = false;

        try {
            decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as { username: string };
            console.log('Refresh token verified for username');
        } catch (err: any) {
            tokenExpired = err.name === 'TokenExpiredError';
            console.log('Token verification failed:', err.name, err.message);

            if (tokenExpired) {
                console.log('Refresh token expired, clearing cookies');
                // Clear the cookies with all necessary options
                res.clearCookie('access_token', {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'lax',
                    path: '/'
                });

                res.clearCookie('refresh_token', {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'lax',
                    path: '/'
                });

                console.log('Cookies cleared on server due to expired token');
                res.status(401).json({ message: 'Refresh token expired' });
            } else {
                res.status(401).json({ message: 'Invalid refresh token' });
            }
            return;
        }

        // Find user with this refresh token
        const users = readUsers();
        const userIndex = users.findIndex(user =>
            user.username === decoded.username &&
            user.refreshTokens?.includes(refreshToken)
        );

        if (userIndex === -1) {
            console.log('Refresh token not found in user record');

            // Check if the user exists at all
            const userExists = users.some(user => user.username === decoded.username);
            if (userExists) {
                console.log('User exists but token is not in their refresh token list. Possible token reuse or database modification.');
            } else {
                console.log('User does not exist in database. User may have been deleted or database reset.');
            }

            // If token is not found, clean up any potentially invalid tokens
            if (refreshToken) {
                // Find and remove the refresh token
                const updatedUsers = users.map(user => {
                    if (user.refreshTokens?.includes(refreshToken)) {
                        return {
                            ...user,
                            refreshTokens: user.refreshTokens.filter(token => token !== refreshToken)
                        };
                    }
                    return user;
                });

                writeUsers(updatedUsers);
            }

            // Clear the cookies with all necessary options
            res.clearCookie('access_token', {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                path: '/'
            });

            res.clearCookie('refresh_token', {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                path: '/'
            });

            console.log('Cookies cleared on server due to token not found in user record');

            // Send response AFTER clearing cookies, not before
            res.status(401).json({ message: 'Refresh token not found' });
            return;
        }

        console.log('Found valid refresh token for user');

        // Generate new access token
        const newAccessToken = generateAccessToken(decoded.username, users[userIndex].role);

        // Set the new access token cookie
        res.cookie('access_token', newAccessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        // Generate and set new refresh token
        const newRefreshToken = generateRefreshToken(decoded.username);
        res.cookie('refresh_token', newRefreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Update the user's refresh tokens in the database
        const updatedUsers = users.map(user => {
            if (user.username === decoded.username) {
                return {
                    ...user,
                    refreshTokens: [
                        ...(user.refreshTokens?.filter(token => token !== refreshToken) || []),
                        newRefreshToken
                    ]
                };
            }
            return user;
        });
        writeUsers(updatedUsers);

        console.log('New access token set successfully for user');

        // Return success message with user role information
        res.json({
            message: 'Token refreshed successfully',
            isAdmin: users[userIndex].role === 'admin'
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

        if (refreshToken) {
            console.log('Logout request with valid refresh token');
            // Find and remove the refresh token
            const users = readUsers();

            const updatedUsers = users.map(user => {
                if (user.refreshTokens?.includes(refreshToken)) {
                    console.log('Removing refresh token from user:', user.username);
                    return {
                        ...user,
                        refreshTokens: user.refreshTokens.filter(token => token !== refreshToken)
                    };
                }
                return user;
            });

            writeUsers(updatedUsers);
        } else {
            // If no refresh token is provided, it might be a request from a service
            // Don't clear cookies in this case to avoid disrupting service auth
            console.log('Logout request without refresh token - not clearing cookies');
            res.json({ message: 'No session to logout' });
            return;
        }

        // Clear cookies with identical settings to how they were set
        res.clearCookie('access_token', {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/'
        });

        res.clearCookie('refresh_token', {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/'
        });

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
    // console.log('Cookies received:', req.cookies);
    res.json({
        cookies: req.cookies,
        hasAccessToken: !!req.cookies.access_token,
        hasRefreshToken: !!req.cookies.refresh_token
    });
});
