import { DashboardItem, GridBreakpoint, GridPoint, GridRect, GridSize, ITEM_TYPE } from '../types';

/**
 * Layout maths for the dashboard grid. Every item occupies a rectangle of grid
 * cells, stored per screen size. Items never overlap: moving or widening an
 * item into others shifts those right, and on to the start of the next row
 * once they reach the right edge. Growing it taller moves them down. Gaps are
 * allowed and kept.
 */

export const DASHBOARD_GRID_COLUMNS = 36;
export const DASHBOARD_GRID_ROW_HEIGHT = 8;
export const DASHBOARD_GRID_GAP = 16;

/** The mobile layout is stored separately from the desktop one, so each owns its breakpoints. */
export const DESKTOP_GRID_BREAKPOINTS: GridBreakpoint[] = ['sm', 'md', 'lg'];
export const MOBILE_GRID_BREAKPOINTS: GridBreakpoint[] = ['xs'];

const MAX_ITEM_ROWS = 120;
const MAX_ROW = 10_000;

export type GridConstraints = {
    minW: number;
    minH: number;
    maxW: number;
    maxH: number;
};

type GridSizeProfile = {
    defaultWidth: Record<GridBreakpoint, number>;
    defaultHeight: number;
    minWidth: Record<GridBreakpoint, number>;
    minHeight: number;
};

const WIDGET_WIDTH: Record<GridBreakpoint, number> = { xs: 36, sm: 18, md: 18, lg: 12 };
const WIDGET_MIN_WIDTH: Record<GridBreakpoint, number> = { xs: 18, sm: 12, md: 9, lg: 8 };
const FULL_WIDTH: Record<GridBreakpoint, number> = { xs: 36, sm: 36, md: 36, lg: 36 };

const SHORTCUT_PROFILE: GridSizeProfile = {
    defaultWidth: { xs: 12, sm: 12, md: 6, lg: 4 },
    defaultHeight: 14,
    minWidth: { xs: 9, sm: 6, md: 4, lg: 3 },
    minHeight: 12,
};

const WIDGET_PROFILE: GridSizeProfile = {
    defaultWidth: WIDGET_WIDTH,
    defaultHeight: 26,
    minWidth: WIDGET_MIN_WIDTH,
    minHeight: 18,
};

/** Widgets whose content is a scrolling list. */
const LIST_PROFILE: GridSizeProfile = {
    defaultWidth: WIDGET_WIDTH,
    defaultHeight: 52,
    minWidth: WIDGET_MIN_WIDTH,
    minHeight: 26,
};

const DUAL_PROFILE: GridSizeProfile = {
    defaultWidth: WIDGET_WIDTH,
    defaultHeight: 52,
    minWidth: WIDGET_MIN_WIDTH,
    minHeight: 40,
};

const GROUP_PROFILE: GridSizeProfile = {
    defaultWidth: WIDGET_WIDTH,
    defaultHeight: 26,
    minWidth: { xs: 12, sm: 9, md: 6, lg: 6 },
    // Title plus one full row of shortcuts
    minHeight: 21,
};

const ROW_PROFILE: GridSizeProfile = {
    defaultWidth: FULL_WIDTH,
    defaultHeight: 14,
    minWidth: { xs: 6, sm: 6, md: 6, lg: 6 },
    minHeight: 6,
};

const LIST_TYPES = new Set<string>([
    ITEM_TYPE.DOWNLOAD_CLIENT,
    ITEM_TYPE.TORRENT_CLIENT,
    ITEM_TYPE.MEDIA_SERVER_WIDGET,
    ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET,
    ITEM_TYPE.NOTES_WIDGET,
    ITEM_TYPE.SONARR_WIDGET,
    ITEM_TYPE.RADARR_WIDGET,
]);

type GridItemShape = Pick<DashboardItem, 'type' | 'config'>;

/** How many shortcuts a group holds. `maxItems` is a number or a string such as `6_2x3`. */
export const getGroupItemLimit = (config: DashboardItem['config']): number => {
    const limit = Number.parseInt(String(config?.maxItems ?? ''), 10);
    return Number.isFinite(limit) && limit > 0 ? limit : 3;
};

const getProfile = (item: GridItemShape): GridSizeProfile => {
    switch (item.type) {
    case ITEM_TYPE.APP_SHORTCUT:
    case ITEM_TYPE.BLANK_APP:
        return SHORTCUT_PROFILE;
    case ITEM_TYPE.BLANK_ROW:
        return ROW_PROFILE;
    case ITEM_TYPE.DUAL_WIDGET:
        return DUAL_PROFILE;
    case ITEM_TYPE.GROUP_WIDGET:
        return GROUP_PROFILE;
    default:
        return LIST_TYPES.has(item.type) ? LIST_PROFILE : WIDGET_PROFILE;
    }
};

export const getDefaultGridSize = (item: GridItemShape, breakpoint: GridBreakpoint): GridSize => {
    const profile = getProfile(item);
    // A group with more than one row of shortcuts starts tall enough to show them
    const isLargeGroup = item.type === ITEM_TYPE.GROUP_WIDGET && getGroupItemLimit(item.config) > 3;

    return {
        w: profile.defaultWidth[breakpoint],
        h: isLargeGroup ? 52 : profile.defaultHeight,
    };
};

export const getGridConstraints = (item: GridItemShape, breakpoint: GridBreakpoint): GridConstraints => {
    const profile = getProfile(item);

    return {
        minW: profile.minWidth[breakpoint],
        minH: profile.minHeight,
        maxW: DASHBOARD_GRID_COLUMNS,
        maxH: MAX_ITEM_ROWS,
    };
};

const clamp = (value: number, minimum: number, maximum: number): number =>
    Math.min(Math.max(value, minimum), maximum);

const isInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value);

const clampSize = (item: GridItemShape, breakpoint: GridBreakpoint, size: GridSize): GridSize => {
    const constraints = getGridConstraints(item, breakpoint);

    return {
        w: clamp(size.w, constraints.minW, constraints.maxW),
        h: clamp(size.h, constraints.minH, constraints.maxH),
    };
};

const clampPoint = (point: GridPoint, width: number): GridPoint => ({
    x: clamp(point.x, 0, DASHBOARD_GRID_COLUMNS - width),
    y: clamp(point.y, 0, MAX_ROW),
});

const overlaps = (left: GridRect, right: GridRect): boolean =>
    left.x < right.x + right.w &&
    left.x + left.w > right.x &&
    left.y < right.y + right.h &&
    left.y + left.h > right.y;

/** The stored size of an item, or its default one. Stored values are untrusted. */
const readSize = (item: DashboardItem, breakpoint: GridBreakpoint): GridSize => {
    const stored: Partial<GridRect> | undefined = item.grid?.rects?.[breakpoint];
    const size = stored && isInteger(stored.w) && isInteger(stored.h)
        ? { w: stored.w, h: stored.h }
        : getDefaultGridSize(item, breakpoint);

    return clampSize(item, breakpoint, size);
};

const readPoint = (item: DashboardItem, breakpoint: GridBreakpoint, width: number): GridPoint | null => {
    const stored: Partial<GridRect> | undefined = item.grid?.rects?.[breakpoint];

    return stored && isInteger(stored.x) && isInteger(stored.y)
        ? clampPoint({ x: stored.x, y: stored.y }, width)
        : null;
};

/** The first free spot in reading order: top to bottom, then left to right. */
const findFreePoint = (size: GridSize, occupied: GridRect[]): GridPoint => {
    for (let y = 0; y <= MAX_ROW; y += 1) {
        let x = 0;

        while (x <= DASHBOARD_GRID_COLUMNS - size.w) {
            const candidate = { x, y, ...size };
            const collision = occupied.find(rect => overlaps(candidate, rect));

            if (!collision) {
                return { x, y };
            }
            x = collision.x + collision.w;
        }
    }

    return { x: 0, y: occupied.reduce((bottom, rect) => Math.max(bottom, rect.y + rect.h), 0) };
};

const pushBelowCollisions = (rect: GridRect, occupied: GridRect[]): GridPoint => {
    let y = rect.y;

    while (y <= MAX_ROW) {
        const candidate = { ...rect, y };
        const collisions = occupied.filter(other => overlaps(candidate, other));

        if (collisions.length === 0) {
            break;
        }
        y = Math.max(...collisions.map(other => other.y + other.h));
    }

    return { x: rect.x, y };
};

const withRect = (item: DashboardItem, breakpoint: GridBreakpoint, rect: GridRect): DashboardItem => {
    const stored = item.grid?.rects?.[breakpoint];

    // Unchanged items keep their identity so React can skip re-rendering them
    if (stored && stored.x === rect.x && stored.y === rect.y && stored.w === rect.w && stored.h === rect.h) {
        return item;
    }

    return { ...item, grid: { rects: { ...item.grid?.rects, [breakpoint]: rect } } };
};

/**
 * Gives every item a valid, non-overlapping rectangle at one breakpoint.
 * The prioritised items claim their spots first, then placed items from the
 * top down (each pushed below anything in its way), then items with no
 * position yet, which take the first free spot.
 */
const resolveBreakpoint = (
    items: DashboardItem[],
    breakpoint: GridBreakpoint,
    prioritizedIds?: ReadonlySet<string>,
): DashboardItem[] => {
    const entries = items.map((item, index) => {
        const size = readSize(item, breakpoint);
        return { item, index, size, point: readPoint(item, breakpoint, size.w) };
    });
    const occupied: GridRect[] = [];
    const rects = new Map<DashboardItem, GridRect>();
    const turn = (entry: typeof entries[number]): number => (prioritizedIds?.has(entry.item.id) ? 0 : 1);

    entries
        .filter(entry => entry.point !== null)
        .sort((left, right) =>
            turn(left) - turn(right) ||
            left.point!.y - right.point!.y || left.point!.x - right.point!.x || left.index - right.index)
        .forEach(({ item, size, point }) => {
            const rect = { ...pushBelowCollisions({ ...point!, ...size }, occupied), ...size };
            occupied.push(rect);
            rects.set(item, rect);
        });

    entries
        .filter(entry => entry.point === null)
        .forEach(({ item, size }) => {
            const rect = { ...findFreePoint(size, occupied), ...size };
            occupied.push(rect);
            rects.set(item, rect);
        });

    return items.map(item => withRect(item, breakpoint, rects.get(item)!));
};

/**
 * Lays out the items at the given breakpoints. Layouts saved before the grid
 * existed have no positions: their items are placed in list order.
 */
export const layoutDashboardGrid = (
    items: DashboardItem[],
    breakpoints: GridBreakpoint[],
): DashboardItem[] => breakpoints.reduce(
    (layout, breakpoint) => resolveBreakpoint(layout, breakpoint),
    items,
);

export const getGridRect = (item: DashboardItem, breakpoint: GridBreakpoint): GridRect | undefined =>
    item.grid?.rects?.[breakpoint];

/** Pixel box of a grid rectangle. Columns are fluid, rows are a fixed height. */
export const getGridRectStyle = (rect: GridRect) => ({
    position: 'absolute' as const,
    left: `${(rect.x / DASHBOARD_GRID_COLUMNS) * 100}%`,
    top: rect.y * DASHBOARD_GRID_ROW_HEIGHT,
    width: `${(rect.w / DASHBOARD_GRID_COLUMNS) * 100}%`,
    height: rect.h * DASHBOARD_GRID_ROW_HEIGHT,
});

/** Number of rows the layout occupies. */
export const getGridRowCount = (items: DashboardItem[], breakpoint: GridBreakpoint): number =>
    items.reduce((rows, item) => {
        const rect = getGridRect(item, breakpoint);
        return rect ? Math.max(rows, rect.y + rect.h) : rows;
    }, 0);

/**
 * Where an item pushed past the right edge goes: the start of the row that
 * begins at `top`. Items that begin above that row are in its way, so it goes
 * beside or below them. The row's own items are not: it shifts those along in
 * turn. The fixed rectangle is always in its way.
 */
const findRowStart = (size: GridSize, top: number, others: GridRect[], fixed: GridRect): GridPoint => {
    let y = top;

    while (y <= MAX_ROW) {
        const row = y;
        const inTheWay = others.filter(other => other === fixed || other.y < row);
        let x = 0;
        let below = MAX_ROW + 1;

        while (x <= DASHBOARD_GRID_COLUMNS - size.w) {
            const candidate = { x, y: row, w: size.w, h: size.h };
            const collision = inTheWay.find(other => overlaps(candidate, other));

            if (!collision) {
                return { x, y: row };
            }
            x = collision.x + collision.w;
            below = Math.min(below, collision.y + collision.h);
        }

        // No room beside them: try again where the first of them ends
        y = below;
    }

    return { x: 0, y: top };
};

/**
 * Makes room for a moved or resized item by shifting the items in the given
 * area of it to its right, and the items those land on in turn, so it slots in
 * between its neighbours. An item pushed past the right edge wraps to the
 * start of the next row and shifts that row along the same way.
 *
 * Returns the layout and the items that now hold their spot: the moved item
 * and the ones shifted for it. Anything else still in the way is to be moved
 * down.
 */
const shiftCollisionsRight = (
    items: DashboardItem[],
    moved: DashboardItem,
    breakpoint: GridBreakpoint,
    area: GridRect,
): { layout: DashboardItem[]; settledIds: Set<string> } => {
    const rects = new Map(items.map(item => [item, getGridRect(item, breakpoint)!]));
    const movedRect = rects.get(moved)!;
    const wrapped = new Set<DashboardItem>();
    // Pushed past the right edge a second time: these give way downwards
    const blocked = new Set<DashboardItem>();
    // Every shift is to the right and an item changes row only once, so this runs out
    const pushers = [moved];

    for (let next = 0; next < pushers.length; next += 1) {
        const pusher = pushers[next];
        const pusherRect = pusher === moved ? area : rects.get(pusher)!;

        if (blocked.has(pusher)) {
            continue;
        }

        for (const item of items) {
            const rect = rects.get(item)!;

            if (item === moved || item === pusher || blocked.has(item) || !overlaps(pusherRect, rect)) {
                continue;
            }

            const shifted = { ...rect, x: pusherRect.x + pusherRect.w };

            // The moved item gives way to nothing: what is shifted onto it goes past it
            if (overlaps(shifted, movedRect)) {
                shifted.x = movedRect.x + movedRect.w;
            }

            if (shifted.x + rect.w <= DASHBOARD_GRID_COLUMNS) {
                rects.set(item, shifted);
            } else if (!wrapped.has(item)) {
                const others = items.filter(other => other !== item).map(other => rects.get(other)!);

                wrapped.add(item);
                rects.set(item, { ...rect, ...findRowStart(rect, pusherRect.y + pusherRect.h, others, movedRect) });
            } else {
                blocked.add(item);
                continue;
            }
            pushers.push(item);
        }
    }

    return {
        layout: items.map(item => withRect(item, breakpoint, rects.get(item)!)),
        settledIds: new Set(pushers.filter(item => !blocked.has(item)).map(item => item.id)),
    };
};

const updateRect = (
    items: DashboardItem[],
    id: string,
    breakpoint: GridBreakpoint,
    change: (rect: GridRect, item: DashboardItem) => GridRect,
    /** The part of the changed item that shifts what it lands on right. The rest moves it down. */
    getShiftArea: (rect: GridRect, previous: GridRect) => GridRect,
): DashboardItem[] => {
    const layout = resolveBreakpoint(items, breakpoint);
    const target = layout.find(item => item.id === id);

    if (!target) {
        return layout;
    }

    const previous = getGridRect(target, breakpoint)!;
    const moved = withRect(target, breakpoint, change(previous, target));

    if (moved === target) {
        return layout;
    }

    const changed = layout.map(item => (item === target ? moved : item));
    const area = getShiftArea(getGridRect(moved, breakpoint)!, previous);
    const { layout: shifted, settledIds } = shiftCollisionsRight(changed, moved, breakpoint, area);

    // Whatever is still in the way after making room is moved down
    return resolveBreakpoint(shifted, breakpoint, settledIds);
};

/**
 * Moves an item to a cell. Items in its way are shifted right. One that would
 * pass the right edge wraps to the start of the next row.
 */
export const moveDashboardGridItem = (
    items: DashboardItem[],
    id: string,
    point: GridPoint,
    breakpoint: GridBreakpoint,
): DashboardItem[] => updateRect(items, id, breakpoint, rect => ({
    ...rect,
    ...clampPoint(point, rect.w),
}), rect => rect);

/**
 * Resizes an item from its top-left corner, within its limits. Growing wider
 * shifts the items beside it right, and wraps one that would pass the right
 * edge to the start of the next row. Growing taller moves the items below it
 * down.
 */
export const resizeDashboardGridItem = (
    items: DashboardItem[],
    id: string,
    size: GridSize,
    breakpoint: GridBreakpoint,
): DashboardItem[] => updateRect(items, id, breakpoint, (rect, item) => {
    const clamped = clampSize(item, breakpoint, size);

    return {
        ...rect,
        w: Math.min(clamped.w, DASHBOARD_GRID_COLUMNS - rect.x),
        h: clamped.h,
    };
    // Only the rows the item already had: what it reaches below those is under it, not beside it
}, (rect, previous) => ({ ...rect, h: Math.min(rect.h, previous.h) }));

/** How far, in cells, an edge can be from a line and still be pulled onto it. */
type SnapReach = { columns: number; rows: number };

// Any item's edge attracts from this close, wherever it is on the dashboard
const WEAK_REACH: SnapReach = { columns: 1, rows: 2 };

// The edges and sizes of neighbours attract a resized edge from this close
const RESIZE_REACH: SnapReach = { columns: 2, rows: 4 };

/**
 * Neighbours attract a moved item from much further than the rest: far enough
 * that dropping it roughly beside one lines it up, near enough that dragging on
 * lets go again. Grows with the item, within limits.
 */
const getMoveReach = (size: GridSize): SnapReach => ({
    columns: clamp(Math.round(size.w * 0.45), 1, 4),
    rows: clamp(Math.round(size.h * 0.4), 3, 8),
});

type SnapTier = { targets: number[]; reach: number };

/**
 * How far to shift so that one of the values lands on a target. Tiers are
 * tried in order and the first with a target in reach decides, taking its
 * nearest one. Earlier values win ties: an item prefers lining up its left/top
 * edge. Returns 0 when nothing is in reach.
 */
const snapOffset = (values: number[], tiers: SnapTier[]): number => {
    for (const { targets, reach } of tiers) {
        let offset = 0;
        let closest = reach + 1;

        for (const value of values) {
            for (const target of targets) {
                const distance = Math.abs(target - value);

                if (distance < closest) {
                    closest = distance;
                    offset = target - value;
                }
            }
        }

        if (closest <= reach) {
            return offset;
        }
    }

    return 0;
};

const columnsOf = (rect: GridRect): number[] => [rect.x, rect.x + rect.w];
const rowsOf = (rect: GridRect): number[] => [rect.y, rect.y + rect.h];

/** The item's own rectangle and those of every other item. */
const getSnapContext = (items: DashboardItem[], id: string, breakpoint: GridBreakpoint) => {
    const item = items.find(candidate => candidate.id === id);
    const rect = item && getGridRect(item, breakpoint);
    const others = items
        .filter(candidate => candidate.id !== id)
        .map(candidate => getGridRect(candidate, breakpoint))
        .filter((other): other is GridRect => other !== undefined);

    return rect ? { rect, others } : null;
};

/** The items within reach of a rectangle on any side, including ones it overlaps. */
const getNeighbours = (rect: GridRect, others: GridRect[], reach: SnapReach): GridRect[] => {
    // One cell wider than the reach: an item exactly that far away only touches the area's edge
    const columns = reach.columns + 1;
    const rows = reach.rows + 1;
    const area = {
        x: rect.x - columns,
        y: rect.y - rows,
        w: rect.w + columns * 2,
        h: rect.h + rows * 2,
    };

    return others.filter(other => overlaps(area, other));
};

/**
 * Pulls a position being dragged to into line with the items around it, so
 * like-sized items are easy to set side by side. In order of preference:
 *
 * 1. a neighbour of the same width/height: the item takes the matching spot
 *    beside, above or below it;
 * 2. any neighbour: flush against it, top or bottom (left or right) aligned;
 * 3. the edge of any item on the dashboard, from close by only.
 *
 * Dragging on past a neighbour's reach lets go, for a position of the user's
 * own. An axis the item has not moved along is left alone, so a deliberate
 * offset survives a drag in the other direction.
 */
export const snapGridPoint = (
    items: DashboardItem[],
    id: string,
    point: GridPoint,
    breakpoint: GridBreakpoint,
): GridPoint => {
    const context = getSnapContext(items, id, breakpoint);

    if (!context) {
        return point;
    }

    const { rect, others } = context;
    const reach = getMoveReach(rect);
    const neighbours = getNeighbours({ ...rect, ...point }, others, reach);

    return {
        x: point.x === rect.x ? point.x : point.x + snapOffset([point.x, point.x + rect.w], [
            { targets: neighbours.filter(other => other.w === rect.w).flatMap(columnsOf), reach: reach.columns },
            { targets: neighbours.flatMap(columnsOf), reach: reach.columns },
            { targets: [0, DASHBOARD_GRID_COLUMNS, ...others.flatMap(columnsOf)], reach: WEAK_REACH.columns },
        ]),
        y: point.y === rect.y ? point.y : point.y + snapOffset([point.y, point.y + rect.h], [
            { targets: neighbours.filter(other => other.h === rect.h).flatMap(rowsOf), reach: reach.rows },
            { targets: neighbours.flatMap(rowsOf), reach: reach.rows },
            { targets: [0, ...others.flatMap(rowsOf)], reach: WEAK_REACH.rows },
        ]),
    };
};

/**
 * Pulls a size being dragged to so the item matches a neighbour: its
 * right/bottom edge meets one of the neighbour's edges, or it takes the
 * neighbour's width/height. Failing that, the edges and sizes of any item
 * attract from close by. A dimension that is not being changed is left alone.
 */
export const snapGridSize = (
    items: DashboardItem[],
    id: string,
    size: GridSize,
    breakpoint: GridBreakpoint,
): GridSize => {
    const context = getSnapContext(items, id, breakpoint);

    if (!context) {
        return size;
    }

    const { rect, others } = context;
    const neighbours = getNeighbours({ ...rect, ...size }, others, RESIZE_REACH);
    const widthsOf = (rects: GridRect[]) => [...rects.flatMap(columnsOf).map(column => column - rect.x), ...rects.map(other => other.w)];
    const heightsOf = (rects: GridRect[]) => [...rects.flatMap(rowsOf).map(row => row - rect.y), ...rects.map(other => other.h)];

    return {
        w: size.w === rect.w ? size.w : size.w + snapOffset([size.w], [
            { targets: widthsOf(neighbours), reach: RESIZE_REACH.columns },
            { targets: [DASHBOARD_GRID_COLUMNS - rect.x, ...widthsOf(others)], reach: WEAK_REACH.columns },
        ]),
        h: size.h === rect.h ? size.h : size.h + snapOffset([size.h], [
            { targets: heightsOf(neighbours), reach: RESIZE_REACH.rows },
            { targets: heightsOf(others), reach: WEAK_REACH.rows },
        ]),
    };
};

/**
 * Returns the item placed in free space of a layout it is about to join,
 * keeping its size. Used for copies and for items arriving from elsewhere,
 * whose old position means nothing in the new layout.
 */
export const placeDashboardGridItem = (
    items: DashboardItem[],
    item: DashboardItem,
    breakpoints: GridBreakpoint[],
): DashboardItem => breakpoints.reduce((placed, breakpoint) => {
    const occupied = resolveBreakpoint(items.filter(other => other.id !== item.id), breakpoint)
        .map(other => getGridRect(other, breakpoint)!);
    const size = readSize(item, breakpoint);

    return withRect(placed, breakpoint, { ...findFreePoint(size, occupied), ...size });
}, item);
