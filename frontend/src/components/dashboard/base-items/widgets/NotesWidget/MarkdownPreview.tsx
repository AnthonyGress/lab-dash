import { Box } from '@mui/material';
import React from 'react';
import ReactMarkdown from 'react-markdown';

import { theme } from '../../../../../theme/theme';

interface MarkdownPreviewProps {
    content: string;
    fontSize?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, fontSize = '16px' }) => {
    return (
        <Box sx={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: fontSize, // Use dynamic font size
            lineHeight: 1.5,
            wordBreak: 'break-word',
            userSelect: 'text',
            cursor: 'text',
            overflow: 'auto',
            height: '100%',
            padding: '8px',
            '& p': {
                margin: '0.3em 0',
                '&:first-of-type': {
                    marginTop: 0
                },
                '&:last-of-type': {
                    marginBottom: 0
                }
            },
            '& ul, & ol': {
                margin: '0.3em 0',
                paddingLeft: '1.2em',
                color: 'rgba(255,255,255,0.9)'
            },
            '& li': {
                margin: '0.1em 0'
            },
            '& code': {
                backgroundColor: 'rgba(255,255,255,0.1)',
                padding: '0.1em 0.3em',
                borderRadius: '3px',
                fontSize: '0.9em',
                color: 'rgba(255,255,255,0.95)'
            },
            '& pre': {
                backgroundColor: 'rgba(255,255,255,0.05)',
                padding: '0.5em',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '0.85em'
            },
            '& pre code': {
                backgroundColor: 'transparent',
                padding: 0,
                borderRadius: 0,
                fontSize: 'inherit',
                color: 'inherit'
            },
            '& blockquote': {
                borderLeft: '3px solid rgba(255,255,255,0.3)',
                paddingLeft: '0.8em',
                margin: '0.3em 0',
                color: 'rgba(255,255,255,0.8)',
                fontStyle: 'italic'
            },
            '& a': {
                color: 'primary.main',
                textDecoration: 'underline'
            },
            '& strong': {
                fontWeight: 600,
                color: 'white'
            },
            '& em': {
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.9)'
            },
            '& h1, & h2, & h3, & h4, & h5, & h6': {
                color: 'white',
                margin: '0.8em 0 0.4em 0'
            }
        }}>
            <ReactMarkdown
                components={{
                    a: ({ href, children, ...props }) => (
                        <a
                            href={href}
                            target='_blank'
                            rel='noopener noreferrer'
                            {...props}
                        >
                            {children}
                        </a>
                    )
                }}
            >
                {content || 'No content'}
            </ReactMarkdown>
        </Box>
    );
};

export default MarkdownPreview;
