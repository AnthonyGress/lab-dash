// Helper functions for markdown formatting
export const applyMarkdownFormat = (
    text: string,
    selectionStart: number,
    selectionEnd: number,
    type: string,
    t: (key: string) => string, // Add translation function argument
    prefix?: string,
    suffix?: string
): { newText: string; newSelectionStart: number; newSelectionEnd: number; } => {
    let selectedText = text.substring(selectionStart, selectionEnd);
    let actualSelectionStart = selectionStart;
    let actualSelectionEnd = selectionEnd;

    // If no text is selected, select the entire current line
    if (selectionStart === selectionEnd) {
        // Find the start of the current line
        let lineStart = selectionStart;
        while (lineStart > 0 && text[lineStart - 1] !== '\n') {
            lineStart--;
        }

        // Find the end of the current line
        let lineEnd = selectionStart;
        while (lineEnd < text.length && text[lineEnd] !== '\n') {
            lineEnd++;
        }

        // Update selection to encompass the entire line
        selectedText = text.substring(lineStart, lineEnd);
        actualSelectionStart = lineStart;
        actualSelectionEnd = lineEnd;
    }

    const beforeSelection = text.substring(0, actualSelectionStart);
    const afterSelection = text.substring(actualSelectionEnd);

    let newText = '';
    let newSelectionStart = actualSelectionStart;
    let newSelectionEnd = actualSelectionEnd;

    switch (type) {
    case 'heading': {
        const lines = selectedText || t('widgets.notes.markdown.heading');
        newText = beforeSelection + '## ' + lines + afterSelection;
        newSelectionStart = actualSelectionStart + 3;
        newSelectionEnd = newSelectionStart + lines.length;
        break;
    }
    case 'bold':
    case 'italic':
    case 'code': {
        const defaultText = type === 'code' ? t('widgets.notes.markdown.code') : t('widgets.notes.markdown.text');
        const wrappedText = selectedText || defaultText;
        newText = beforeSelection + prefix + wrappedText + suffix + afterSelection;
        newSelectionStart = actualSelectionStart + (prefix?.length || 0);
        newSelectionEnd = newSelectionStart + wrappedText.length;
        break;
    }
    case 'codeblock': {
        const codeText = selectedText || t('widgets.notes.markdown.code');
        const codeBlock = '```\n' + codeText + '\n```';
        newText = beforeSelection + codeBlock + afterSelection;
        newSelectionStart = actualSelectionStart + 4;
        newSelectionEnd = newSelectionStart + codeText.length;
        break;
    }
    case 'quote': {
        const quoteText = selectedText || t('widgets.notes.markdown.quote');
        newText = beforeSelection + '> ' + quoteText + afterSelection;
        newSelectionStart = actualSelectionStart + 2;
        newSelectionEnd = newSelectionStart + quoteText.length;
        break;
    }
    case 'link': {
        const linkText = selectedText || t('widgets.notes.markdown.linkText');
        const linkFormat = '[' + linkText + '](url)';
        newText = beforeSelection + linkFormat + afterSelection;
        newSelectionStart = actualSelectionStart + linkText.length + 3;
        newSelectionEnd = newSelectionStart + 3; // Select "url"
        break;
    }
    case 'ul': {
        const listText = selectedText || t('widgets.notes.markdown.listItem');
        newText = beforeSelection + '- ' + listText + afterSelection;
        newSelectionStart = actualSelectionStart + 2;
        newSelectionEnd = newSelectionStart + listText.length;
        break;
    }
    case 'ol': {
        const listText = selectedText || t('widgets.notes.markdown.listItem');
        newText = beforeSelection + '1. ' + listText + afterSelection;
        newSelectionStart = actualSelectionStart + 3;
        newSelectionEnd = newSelectionStart + listText.length;
        break;
    }
    case 'task': {
        const taskText = selectedText || t('widgets.notes.markdown.taskItem');
        newText = beforeSelection + '- [ ] ' + taskText + afterSelection;
        newSelectionStart = actualSelectionStart + 6;
        newSelectionEnd = newSelectionStart + taskText.length;
        break;
    }
    default:
        return { newText: text, newSelectionStart: actualSelectionStart, newSelectionEnd: actualSelectionEnd };
    }

    return { newText, newSelectionStart, newSelectionEnd };
};