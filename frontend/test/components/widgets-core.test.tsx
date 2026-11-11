import { fireEvent, screen, waitFor } from '@testing-library/react';
import Swal from 'sweetalert2';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { adminContext, makePage, renderWithProviders } from './render';
import { setLive } from './widgets-helpers';
import { DashApi } from '../../src/api/dash-api';
import { AppShortcut } from '../../src/components/dashboard/base-items/apps/AppShortcut';
import { BlankAppShortcut } from '../../src/components/dashboard/base-items/apps/BlankAppShortcut';
import { BlankWidget } from '../../src/components/dashboard/base-items/widgets/BlankWidget';
import { DateTimeWidget } from '../../src/components/dashboard/base-items/widgets/DateTimeWidget';
import { DualWidget } from '../../src/components/dashboard/base-items/widgets/DualWidget';
import { DualWidgetContainer } from '../../src/components/dashboard/base-items/widgets/DualWidgetContainer';
import { EditMenu } from '../../src/components/dashboard/base-items/widgets/EditMenu';
import { applyMarkdownFormat } from '../../src/components/dashboard/base-items/widgets/NotesWidget/applyMarkdownFormat';
import { FontSizeSelector } from '../../src/components/dashboard/base-items/widgets/NotesWidget/FontSizeSelector';
import { MarkdownPreview } from '../../src/components/dashboard/base-items/widgets/NotesWidget/MarkdownPreview';
import { MarkdownToolbar } from '../../src/components/dashboard/base-items/widgets/NotesWidget/MarkdownToolbar';
import { NotesWidget } from '../../src/components/dashboard/base-items/widgets/NotesWidget/NotesWidget';
import { StatusIndicator } from '../../src/components/dashboard/base-items/widgets/StatusIndicator';
import { WidgetContainer } from '../../src/components/dashboard/base-items/widgets/WidgetContainer';
import { ITEM_TYPE } from '../../src/types';

describe('app shortcuts', () => {
    it('renders the icon and label as a link to the service', () => {
        renderWithProviders(<AppShortcut url='http://plex.local' name='Plex' iconName='plex.svg' showLabel />);

        const image = screen.getByAltText('Plex');
        expect(image.getAttribute('src')).toContain('/icons/plex.svg');
        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.getByRole('link').getAttribute('href')).toBe('http://plex.local');
    });

    it('hides the label and the link when asked', () => {
        renderWithProviders(<AppShortcut url='http://plex.local' name='Plex' iconName='plex.svg' showLabel={false} editMode />);

        expect(screen.getByAltText('Plex')).toBeTruthy();
        expect(screen.queryByText('Plex')).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('sends a wake-on-lan packet instead of opening a page', async () => {
        renderWithProviders(
            <AppShortcut name='NAS' iconName='nas.svg' showLabel config={{ isWol: true, macAddress: 'AA:BB:CC:DD:EE:FF', port: '9' }} />
        );

        fireEvent.click(screen.getByRole('link'));

        await waitFor(() => expect(DashApi.sendWakeOnLan).toHaveBeenCalledWith({ mac: 'AA:BB:CC:DD:EE:FF', port: 9 }));
        expect(await screen.findByText('Wake-on-LAN packet sent to AA:BB:CC:DD:EE:FF')).toBeTruthy();

        // The confirmation lives outside React's tree, so RTL's cleanup does not remove it
        Swal.close();
        await waitFor(() => expect(document.querySelector('.swal2-container')).toBeNull());
    });

    it('renders the blank shortcut and blank widget placeholders with their edit menu', () => {
        renderWithProviders(
            <>
                <BlankAppShortcut id='blank-app' editMode onEdit={vi.fn()} />
                <BlankWidget id='blank-widget' editMode onEdit={vi.fn()} />
            </>
        );

        expect(screen.getAllByTestId('MoreVertIcon')).toHaveLength(2);
    });
});

describe('edit menu', () => {
    it('renders nothing outside edit mode', () => {
        const { container } = renderWithProviders(<EditMenu editMode={false} itemId='a' />);
        expect(container.innerHTML).toBe('');
    });

    it('opens a menu whose edit, duplicate and delete entries call back', () => {
        const onEdit = vi.fn();
        const onDelete = vi.fn();
        const onDuplicate = vi.fn();
        renderWithProviders(<EditMenu editMode itemId='a' onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />);

        fireEvent.click(screen.getByRole('button'));
        expect(screen.queryByText('Move to page')).toBeNull();

        fireEvent.click(screen.getByText('Edit'));
        expect(onEdit).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByText('Duplicate'));
        expect(onDuplicate).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByText('Delete'));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('offers to move the item to another page', async () => {
        const { context } = renderWithProviders(<EditMenu editMode itemId='a' />, {
            context: { pages: [makePage('Media'), makePage('Servers')], currentPageId: 'media-page' }
        });

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByText('Move to page'));

        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.queryByText('Media')).toBeNull();
        fireEvent.click(screen.getByText('Servers'));

        await waitFor(() => expect(context.moveItemToPage).toHaveBeenCalledWith('a', 'servers-page'));
    });
});

describe('widget containers', () => {
    it('shows the edit menu in edit mode but never on a preview', () => {
        const { rerender } = renderWithProviders(<WidgetContainer editMode id='w'><span>inside</span></WidgetContainer>);
        expect(screen.getByTestId('MoreVertIcon')).toBeTruthy();

        rerender(<WidgetContainer editMode id='w' isPreview><span>inside</span></WidgetContainer>);
        expect(screen.queryByTestId('MoreVertIcon')).toBeNull();
        expect(document.querySelector('[data-preview="true"]')).not.toBeNull();
    });

    it('colors the status dot from the health stream', () => {
        setLive('service.health', 'svc-up', { data: { status: 'online' } });
        setLive('service.health', 'svc-down', { data: { status: 'offline' } });

        renderWithProviders(
            <>
                <StatusIndicator itemId='svc-up' url='http://up.local' />
                <StatusIndicator itemId='svc-down' url='http://down.local' />
                <StatusIndicator itemId='svc-ping' healthCheckType='ping' url='nas' />
            </>
        );

        expect(screen.getByTestId('KeyboardArrowUpIcon')).toBeTruthy();
        expect(screen.getByTestId('KeyboardArrowDownIcon')).toBeTruthy();
    });

    it('renders the dual container around its children with an edit menu', () => {
        renderWithProviders(<DualWidgetContainer editMode id='d'><span>two halves</span></DualWidgetContainer>);

        expect(screen.getByText('two halves')).toBeTruthy();
        expect(screen.getByTestId('MoreVertIcon')).toBeTruthy();
    });
});

describe('date and time widget', () => {
    it('shows the time, the date and the place in 24-hour form', () => {
        renderWithProviders(
            <DateTimeWidget config={{
                use24Hour: true,
                timezone: 'America/New_York',
                location: { name: 'Miami, Florida, United States', latitude: 25.7, longitude: -80.2 }
            }} />
        );

        expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeTruthy();
        expect(screen.getByText(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), /)).toBeTruthy();
        expect(screen.getByText('Miami, Florida')).toBeTruthy();
        expect(screen.getByText('America/New York')).toBeTruthy();
    });

    it('shows a 12-hour clock and the city and country without a timezone', () => {
        renderWithProviders(<DateTimeWidget config={{ location: { name: 'Paris, Île-de-France, France', latitude: 48.8, longitude: 2.3 } }} />);

        expect(screen.getByText(/^\d{1,2}:\d{2} (AM|PM)$/)).toBeTruthy();
        expect(screen.getByText('Paris, France')).toBeTruthy();
    });
});

describe('dual widget', () => {
    it('says when either half is not configured', () => {
        renderWithProviders(<DualWidget id='dual' />);
        expect(screen.getAllByText('Widget not configured')).toHaveLength(2);
    });

    it('renders the configured halves and names an unknown type', () => {
        renderWithProviders(
            <DualWidget id='dual' config={{
                topWidget: { type: ITEM_TYPE.DATE_TIME_WIDGET, config: { use24Hour: true } },
                bottomWidget: { type: 'mystery-widget' }
            }} />
        );

        expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeTruthy();
        expect(screen.getByText('Unknown widget type: mystery-widget')).toBeTruthy();
    });
});

describe('notes widget', () => {
    const note = (id: string, title: string, content: string) => ({
        id, title, content, fontSize: '16px', createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z'
    });

    // The widget fetches again whenever the number of notes changes, so the answer must persist
    const notesOnServer = (notes: ReturnType<typeof note>[]) => vi.mocked(DashApi.getNotes).mockResolvedValue(notes);
    afterEach(() => {
        notesOnServer([]);
    });

    it('shows the empty list once the notes have loaded', async () => {
        renderWithProviders(<NotesWidget config={{ displayName: 'Scratchpad' }} />);

        expect(screen.getByText('Scratchpad')).toBeTruthy();
        expect(screen.getByText('Loading notes...')).toBeTruthy();
        expect(await screen.findByText('No notes yet')).toBeTruthy();
        expect(screen.getByText('Notes (0)')).toBeTruthy();
        expect(screen.queryByLabelText('New note')).toBeNull();
    });

    it('lists the notes and opens one with its rendered markdown', async () => {
        notesOnServer([note('n1', 'Groceries', '# Buy\n\n- milk'), note('n2', 'Ideas', '')]);
        renderWithProviders(<NotesWidget />);

        expect(await screen.findByText('Groceries')).toBeTruthy();
        expect(screen.getByText('Ideas')).toBeTruthy();
        expect(screen.getByText('Notes (2)')).toBeTruthy();

        fireEvent.click(screen.getByText('Groceries'));
        expect(await screen.findByRole('heading', { name: 'Buy' })).toBeTruthy();
        expect(screen.getByText('milk')).toBeTruthy();
        expect(screen.getByLabelText('Open in popup')).toBeTruthy();
        expect(screen.queryByTestId('MoreVertIcon')).toBeNull();
    });

    it('lets an administrator add, edit and delete notes', async () => {
        notesOnServer([note('n1', 'Groceries', 'milk')]);
        renderWithProviders(<NotesWidget />, { context: adminContext() });

        fireEvent.click(await screen.findByText('Groceries'));
        expect(await screen.findByText('milk')).toBeTruthy();
        expect(screen.getByTestId('MoreVertIcon')).toBeTruthy();

        fireEvent.click(screen.getByText('Groceries'));
        expect(screen.getByPlaceholderText('Note title...')).toHaveProperty('value', 'Groceries');
        expect(screen.getByPlaceholderText('Write your note in markdown...')).toHaveProperty('value', 'milk');
        expect(screen.getByLabelText('Bold')).toBeTruthy();

        fireEvent.click(screen.getAllByLabelText('Cancel')[0]);
        expect(await screen.findByText('milk')).toBeTruthy();
        fireEvent.click(screen.getByLabelText('List'));
        expect(screen.getByLabelText('New note')).toBeTruthy();
    });

    it('reports when the notes cannot be fetched', async () => {
        vi.mocked(DashApi.getNotes).mockRejectedValueOnce(new Error('offline'));
        renderWithProviders(<NotesWidget />);

        expect(await screen.findByText('Failed to fetch notes')).toBeTruthy();
    });
});

describe('notes widget pieces', () => {
    it('renders the font size selector with the current size', () => {
        renderWithProviders(<FontSizeSelector fontSize='18px' onFontSizeChange={vi.fn()} />);
        expect(screen.getByRole('combobox')).toHaveProperty('textContent', '18');
    });

    it('renders markdown as html and a placeholder for empty content', () => {
        const { rerender } = renderWithProviders(<MarkdownPreview content={'## Title\n\nSome **bold** text'} />);

        expect(screen.getByRole('heading', { name: 'Title' })).toBeTruthy();
        expect(screen.getByText('bold').tagName).toBe('STRONG');

        rerender(<MarkdownPreview content='' />);
        expect(screen.getByText('No content')).toBeTruthy();
    });

    it('renders the toolbar buttons and reports the chosen format', () => {
        const onFormat = vi.fn();
        const { rerender } = renderWithProviders(<MarkdownToolbar onFormat={onFormat} onFontSizeChange={vi.fn()} fontSize='14px' />);

        expect(screen.getByRole('combobox')).toHaveProperty('textContent', '14');
        fireEvent.click(screen.getByLabelText('Bold'));
        expect(onFormat).toHaveBeenCalledWith('bold', '**', '**');
        fireEvent.click(screen.getByLabelText('Task List'));
        expect(onFormat).toHaveBeenCalledWith('task');

        rerender(<MarkdownToolbar onFormat={onFormat} onFontSizeChange={vi.fn()} hideFontSize />);
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.getByLabelText('Heading').tagName).toBe('BUTTON');
    });

    it('wraps the selection, or the whole line when nothing is selected', () => {
        expect(applyMarkdownFormat('hello world', 6, 11, 'bold', '**', '**')).toEqual({
            newText: 'hello **world**', newSelectionStart: 8, newSelectionEnd: 13
        });
        expect(applyMarkdownFormat('one\ntwo\nthree', 5, 5, 'heading')).toEqual({
            newText: 'one\n## two\nthree', newSelectionStart: 7, newSelectionEnd: 10
        });
        expect(applyMarkdownFormat('', 0, 0, 'link')).toEqual({
            newText: '[link text](url)', newSelectionStart: 12, newSelectionEnd: 15
        });
        expect(applyMarkdownFormat('x', 0, 1, 'codeblock').newText).toBe('```\nx\n```');
        expect(applyMarkdownFormat('x', 0, 1, 'task').newText).toBe('- [ ] x');
        expect(applyMarkdownFormat('x', 0, 1, 'unknown')).toEqual({ newText: 'x', newSelectionStart: 0, newSelectionEnd: 1 });
    });
});
