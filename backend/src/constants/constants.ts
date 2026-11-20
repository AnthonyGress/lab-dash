import path from 'path';

// Relative to the working directory by default; UPLOAD_DIRECTORY moves it (tests use a temp folder)
export const UPLOAD_DIRECTORY: string = process.env.UPLOAD_DIRECTORY || path.join('public', 'uploads');
