import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { adminContext, makeItem, renderWithProviders } from './render';
import { DashboardGrid } from '../../src/components/dashboard/DashboardGrid';
import { DashboardGridItem } from '../../src/components/dashboard/DashboardGridItem';
import { DashboardItemContent } from '../../src/components/dashboard/DashboardItemContent';
import { DashboardItem, ITEM_TYPE } from '../../src/types';
import { DASHBOARD_GRID_ROW_HEIGHT, getDefaultGridSize } from '../../src/utils/dashboard-grid';

const shortcut = (id: string, label: string, overrides: Partial<DashboardItem> = {}) =>
    makeItem(ITEM_TYPE.APP_SHORTCUT, { id, label, url: `http://${id}.local`, showLabel: true, ...overrides });

const plex = shortcut('plex', 'Plex');
const sonarr = shortcut('sonarr', 'Sonarr');
// The time zone is only shown under a location name
const clock = makeItem(ITEM_TYPE.DATE_TIME_WIDGET, {
    id: 'clock',
    label: 'Clock',
    config: { timezone: 'Europe/London', location: { name: 'London, England, United Kingdom' } }
});
const tools = makeItem(ITEM_TYPE.GROUP_WIDGET, {
    id: 'tools',
    label: 'Tools',
    config: { items: [{ id: 'portainer', name: 'Portainer', url: 'http://portainer.local' }] }
});

const actions = { onDelete: vi.fn(), onEdit: vi.fn(), onDuplicate: vi.fn() };
const cells = (container: HTMLElement) => container.querySelectorAll('[data-grid-item-id]');
const handles = (container: HTMLElement) => container.querySelectorAll('.grid-resize-handle');
/** The positioned box the cells sit in; its height is the row count */
const gridHeight = (container: HTMLElement) =>
    parseInt((cells(container)[0].parentElement as HTMLElement).style.height, 10);

describe('DashboardGrid', () => {
    it('lays out every item of the layout and shows its content', () => {
        const { container } = renderWithProviders(<DashboardGrid />, { context: { dashboardLayout: [plex, sonarr, clock] } });

        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.getByText('Sonarr')).toBeTruthy();
        expect(screen.getByText('London, United Kingdom')).toBeTruthy();
        expect(cells(container)).toHaveLength(3);
        expect(container.querySelector('[data-grid-item-id="plex"]')).not.toBeNull();
        // A row of two shortcuts beside a widget is as tall as the widget (the grid is at its widest here)
        expect(gridHeight(container)).toBe(getDefaultGridSize(clock, 'lg').h * DASHBOARD_GRID_ROW_HEIGHT);
    });

    it('offers no drag handles or item menus outside edit mode', () => {
        const { container } = renderWithProviders(<DashboardGrid />, { context: { dashboardLayout: [plex, clock] } });

        expect(handles(container)).toHaveLength(0);
        expect(screen.queryByTestId('MoreVertIcon')).toBeNull();
    });

    it('hides admin-only items from a guest and shows them to an administrator', () => {
        const secret = shortcut('vault', 'Vault', { adminOnly: true });
        const { unmount } = renderWithProviders(<DashboardGrid />, { context: { dashboardLayout: [plex, secret] } });

        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.queryByText('Vault')).toBeNull();
        unmount();

        renderWithProviders(<DashboardGrid />, { context: adminContext({ dashboardLayout: [plex, secret] }) });
        expect(screen.getByText('Vault')).toBeTruthy();
    });

    it('makes every item resizable, gives it a menu and leaves room below in edit mode', () => {
        const { container } = renderWithProviders(<DashboardGrid />, {
            context: adminContext({ editMode: true, dashboardLayout: [plex, sonarr, clock] })
        });

        expect(handles(container)).toHaveLength(3 * 3);
        expect(screen.getAllByTestId('MoreVertIcon')).toHaveLength(3);
        // Forty spare rows to drop things into
        expect(gridHeight(container)).toBe((getDefaultGridSize(clock, 'lg').h + 40) * DASHBOARD_GRID_ROW_HEIGHT);
    });

    it('opens the edit form for an item from its menu', async () => {
        const { container } = renderWithProviders(<DashboardGrid />, {
            context: adminContext({ editMode: true, dashboardLayout: [plex] })
        });

        const cell = container.querySelector('[data-grid-item-id="plex"]') as HTMLElement;
        fireEvent.click(within(cell).getByTestId('MoreVertIcon').closest('button')!);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));

        expect(await screen.findByText('Edit Item')).toBeTruthy();
    });
});

describe('DashboardGridItem', () => {
    const noop = vi.fn();
    const rect = { x: 9, y: 2, w: 18, h: 14 };

    it('places its content from the grid rectangle', () => {
        const { container } = renderWithProviders(
            <DashboardGridItem id='a' type={ITEM_TYPE.APP_SHORTCUT} rect={rect} editMode={false} animate onResize={noop} onResizeEnd={noop}>
                <span>cell content</span>
            </DashboardGridItem>
        );

        expect(screen.getByText('cell content')).toBeTruthy();
        const cell = container.querySelector('[data-grid-item-id="a"]') as HTMLElement;
        expect(cell.style.left).toBe('25%');
        expect(cell.style.width).toBe('50%');
        expect(cell.style.top).toBe(`${2 * DASHBOARD_GRID_ROW_HEIGHT}px`);
        expect(cell.style.height).toBe(`${14 * DASHBOARD_GRID_ROW_HEIGHT}px`);
        expect(handles(container)).toHaveLength(0);
        expect(cell.getAttribute('role')).toBeNull();
    });

    it('becomes draggable with three resize handles in edit mode', () => {
        const { container } = renderWithProviders(
            <DashboardGridItem id='a' type={ITEM_TYPE.APP_SHORTCUT} rect={rect} editMode animate onResize={noop} onResizeEnd={noop}>
                <span>cell content</span>
            </DashboardGridItem>
        );

        const cell = container.querySelector('[data-grid-item-id="a"]') as HTMLElement;
        expect(cell.getAttribute('role')).toBe('button');
        expect(cell.getAttribute('aria-roledescription')).toBe('draggable');
        expect(handles(container)).toHaveLength(3);
    });
});

describe('DashboardItemContent', () => {
    const renderContent = (item: DashboardItem, editMode = false) =>
        renderWithProviders(<DashboardItemContent item={item} editMode={editMode} {...actions} />);

    it('shows an app shortcut with its label', () => {
        renderContent(plex);

        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.getByAltText('Plex')).toBeTruthy();
    });

    it('shows a group widget with its title and shortcuts', () => {
        renderContent(tools);

        expect(screen.getByText('Tools')).toBeTruthy();
        expect(screen.getByText('Portainer')).toBeTruthy();
    });

    it('shows the date and time widget with its location and time zone', () => {
        renderContent(clock);

        expect(screen.getByText('London, United Kingdom')).toBeTruthy();
        expect(screen.getByText('Europe/London')).toBeTruthy();
    });

    it('shows a blank placeholder for legacy blank types and anything unknown', () => {
        const blankApp = renderContent(makeItem(ITEM_TYPE.BLANK_APP, { id: 'blank-app' }));
        expect(blankApp.container.querySelector('[data-preview="false"]')).not.toBeNull();
        expect(blankApp.container.textContent).toBe('');
        blankApp.unmount();

        const unknown = renderContent(makeItem('something-new', { id: 'unknown' }));
        expect(unknown.container.querySelector('[data-preview="false"]')).not.toBeNull();
        expect(unknown.container.textContent).toBe('');
    });

    it('offers the item menu in edit mode and reports which item to edit', async () => {
        renderContent(plex, true);

        fireEvent.click(screen.getByTestId('MoreVertIcon').closest('button')!);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));

        expect(actions.onEdit).toHaveBeenCalledWith(plex);
    });

    it('reports which item to delete and to duplicate', async () => {
        renderContent(sonarr, true);

        fireEvent.click(screen.getByTestId('MoreVertIcon').closest('button')!);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));
        expect(actions.onDuplicate).toHaveBeenCalledWith(sonarr);

        fireEvent.click(screen.getByTestId('MoreVertIcon').closest('button')!);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
        expect(actions.onDelete).toHaveBeenCalledWith(sonarr);
    });
});
