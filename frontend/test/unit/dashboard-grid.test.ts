import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { DashboardItem, GridBreakpoint, GridRect, ITEM_TYPE } from '../../src/types';
import {
    getDefaultGridSize,
    getGridConstraints,
    getGridRect,
    getGridRowCount,
    getGroupItemLimit,
    layoutDashboardGrid,
    moveDashboardGridItem,
    placeDashboardGridItem,
    resizeDashboardGridItem,
    snapGridPoint,
    snapGridSize,
} from '../../src/utils/dashboard-grid';

const WEATHER = ITEM_TYPE.WEATHER_WIDGET;
const SHORTCUT = ITEM_TYPE.APP_SHORTCUT;

const item = (id: string, type: string = WEATHER, rects?: Partial<Record<GridBreakpoint, GridRect>>): DashboardItem => ({
    id,
    label: id,
    type,
    ...(rects ? { grid: { rects } } : {}),
});

const at = (x: number, y: number, w: number, h: number): GridRect => ({ x, y, w, h });

const rectOf = (items: DashboardItem[], id: string, breakpoint: GridBreakpoint = 'lg'): GridRect | undefined => {
    const found = items.find(candidate => candidate.id === id);
    return found && getGridRect(found, breakpoint);
};

const assertValidLayout = (items: DashboardItem[], breakpoint: GridBreakpoint = 'lg'): void => {
    const rects = items.map(current => ({ id: current.id, ...getGridRect(current, breakpoint)! }));

    for (const a of rects) {
        assert.ok(Number.isInteger(a.x) && Number.isInteger(a.y), `${a.id} sits on whole cells`);
        assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= 36, `${a.id} is inside the grid`);

        for (const b of rects) {
            const overlap = a !== b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
            assert.ok(!overlap, `${a.id} overlaps ${b.id}`);
        }
    }
};

describe('layout', () => {
    it('places a layout saved before the grid existed in reading order, with default sizes', () => {
        const layout = layoutDashboardGrid(
            [item('a'), item('b'), item('s', SHORTCUT), item('d', ITEM_TYPE.DOWNLOAD_CLIENT)],
            ['lg'],
        );

        assert.deepEqual(layout.map(current => getGridRect(current, 'lg')), [
            at(0, 0, 12, 26),
            at(12, 0, 12, 26),
            at(24, 0, 4, 14),
            at(24, 14, 12, 52),
        ]);
        assertValidLayout(layout);
    });

    it('is stable: laying out twice changes nothing and keeps item identity', () => {
        const once = layoutDashboardGrid([item('a'), item('b')], ['lg']);
        const twice = layoutDashboardGrid(once, ['lg']);

        assert.ok(once.every((current, index) => current === twice[index]));
    });

    it('keeps gaps: an item stays where it was put', () => {
        const layout = layoutDashboardGrid([item('a', WEATHER, { lg: at(20, 40, 10, 20) })], ['lg']);

        assert.deepEqual(rectOf(layout, 'a'), at(20, 40, 10, 20));
    });

    it('clamps stored rectangles it cannot trust to the grid and the size limits', () => {
        const junk = { x: 'a', y: null, w: 1.5, h: NaN } as unknown as GridRect;
        const layout = layoutDashboardGrid([
            item('far', WEATHER, { lg: at(99, -4, 12, 26) }),
            item('tiny', WEATHER, { lg: at(0, 100, 1, 1) }),
            item('huge', WEATHER, { lg: at(0, 200, 500, 5000) }),
            item('junk', WEATHER, { lg: junk }),
        ], ['lg']);

        assert.deepEqual(rectOf(layout, 'far'), at(24, 0, 12, 26));
        assert.deepEqual(rectOf(layout, 'tiny'), at(0, 100, 8, 18));
        assert.deepEqual(rectOf(layout, 'huge'), at(0, 200, 36, 120));
        assert.deepEqual(rectOf(layout, 'junk'), at(0, 0, 12, 26));
        assertValidLayout(layout);
    });

    it('places new items around the ones that already have a position', () => {
        const layout = layoutDashboardGrid([item('new'), item('placed', WEATHER, { lg: at(0, 0, 36, 20) })], ['lg']);

        assert.deepEqual(rectOf(layout, 'placed'), at(0, 0, 36, 20));
        assert.deepEqual(rectOf(layout, 'new'), at(0, 20, 12, 26));
        assert.equal(getGridRowCount(layout, 'lg'), 46);
        assert.equal(getGridRowCount([], 'lg'), 0);
    });
});

describe('sizes per item type', () => {
    it('gives each type a default size for each screen size', () => {
        const breakpoints: GridBreakpoint[] = ['xs', 'sm', 'md', 'lg'];

        assert.deepEqual(breakpoints.map(bp => getDefaultGridSize({ type: SHORTCUT }, bp).w), [12, 12, 6, 4]);
        assert.deepEqual(getDefaultGridSize({ type: ITEM_TYPE.DUAL_WIDGET }, 'lg'), { w: 12, h: 52 });
        assert.deepEqual(getDefaultGridSize({ type: ITEM_TYPE.BLANK_ROW }, 'lg'), { w: 36, h: 14 });
    });

    it('starts a group with more than one row of shortcuts tall', () => {
        const group = (maxItems: string | number) => ({ type: ITEM_TYPE.GROUP_WIDGET, config: { maxItems } });

        assert.deepEqual(getDefaultGridSize(group('3'), 'lg'), { w: 12, h: 26 });
        assert.deepEqual(getDefaultGridSize(group('6_2x3'), 'lg'), { w: 12, h: 52 });
        assert.deepEqual(getDefaultGridSize(group(8), 'md'), { w: 18, h: 52 });
        assert.equal(getGroupItemLimit(undefined), 3);
        assert.equal(getGroupItemLimit({ maxItems: '8_4x2' }), 8);
    });

    it('limits how small and large an item can get', () => {
        assert.deepEqual(
            getGridConstraints({ type: ITEM_TYPE.NOTES_WIDGET }, 'xs'),
            { minW: 18, minH: 26, maxW: 36, maxH: 120 },
        );
    });
});

describe('moving', () => {
    const start = layoutDashboardGrid([
        item('a', WEATHER, { lg: at(0, 0, 12, 26) }),
        item('b', WEATHER, { lg: at(0, 26, 12, 26) }),
        item('c', WEATHER, { lg: at(24, 0, 12, 26) }),
    ], ['lg']);

    it('shifts the items it lands on to its right', () => {
        const moved = moveDashboardGridItem(start, 'c', { x: 0, y: 10 }, 'lg');

        assert.deepEqual(rectOf(moved, 'c'), at(0, 10, 12, 26));
        assert.deepEqual(rectOf(moved, 'a'), at(12, 0, 12, 26));
        assert.deepEqual(rectOf(moved, 'b'), at(12, 26, 12, 26));
        assertValidLayout(moved);
    });

    it('slots in between two items, shifting the rest of the row along', () => {
        const shortcut = (id: string, x: number, y: number) => item(id, SHORTCUT, { lg: at(x, y, 4, 14) });
        // A gap after `b`, and a second row that is not in the way
        const row = [shortcut('a', 0, 0), shortcut('b', 4, 0), shortcut('c', 10, 0), shortcut('below', 4, 14), shortcut('s', 30, 60)];
        const moved = moveDashboardGridItem(row, 's', { x: 4, y: 0 }, 'lg');

        assert.deepEqual(rectOf(moved, 'a'), at(0, 0, 4, 14));
        assert.deepEqual(rectOf(moved, 's'), at(4, 0, 4, 14));
        assert.deepEqual(rectOf(moved, 'b'), at(8, 0, 4, 14));
        // `b` used up the gap and still reached `c`
        assert.deepEqual(rectOf(moved, 'c'), at(12, 0, 4, 14));
        assert.deepEqual(rectOf(moved, 'below'), at(4, 14, 4, 14));
        assertValidLayout(moved);
    });

    it('closes the space an item leaves when it moves along its own row', () => {
        const shortcut = (id: string, x: number) => item(id, SHORTCUT, { lg: at(x, 0, 4, 14) });
        const moved = moveDashboardGridItem([shortcut('a', 0), shortcut('b', 4), shortcut('c', 8)], 'c', { x: 0, y: 0 }, 'lg');

        assert.deepEqual(['c', 'a', 'b'].map(id => rectOf(moved, id)?.x), [0, 4, 8]);
        assertValidLayout(moved);
    });

    describe('into a row that is full', () => {
        const row = [
            item('a', WEATHER, { lg: at(0, 0, 12, 26) }),
            item('b', WEATHER, { lg: at(12, 0, 12, 26) }),
            item('c', WEATHER, { lg: at(24, 0, 12, 26) }),
            item('d', WEATHER, { lg: at(0, 200, 12, 26) }),
        ];

        it('shifts the row along and wraps the item at the right edge to the start of the next row', () => {
            const moved = moveDashboardGridItem(row, 'd', { x: 12, y: 0 }, 'lg');

            assert.deepEqual(rectOf(moved, 'a'), at(0, 0, 12, 26));
            assert.deepEqual(rectOf(moved, 'd'), at(12, 0, 12, 26));
            assert.deepEqual(rectOf(moved, 'b'), at(24, 0, 12, 26));
            assert.deepEqual(rectOf(moved, 'c'), at(0, 26, 12, 26));
            assertValidLayout(moved);
        });

        it('wraps the item it lands on when that is already at the right edge', () => {
            const moved = moveDashboardGridItem(row, 'd', { x: 24, y: 0 }, 'lg');

            assert.deepEqual(rectOf(moved, 'b'), at(12, 0, 12, 26));
            assert.deepEqual(rectOf(moved, 'd'), at(24, 0, 12, 26));
            assert.deepEqual(rectOf(moved, 'c'), at(0, 26, 12, 26));
            assertValidLayout(moved);
        });

        it('shifts the next row along too, wrapping again at its right edge', () => {
            const rows = [
                ...row,
                item('e', WEATHER, { lg: at(0, 26, 12, 26) }),
                item('f', WEATHER, { lg: at(12, 26, 12, 26) }),
                item('g', WEATHER, { lg: at(24, 26, 12, 26) }),
            ];
            const moved = moveDashboardGridItem(rows, 'd', { x: 12, y: 0 }, 'lg');

            assert.deepEqual(['a', 'd', 'b'].map(id => rectOf(moved, id)), [at(0, 0, 12, 26), at(12, 0, 12, 26), at(24, 0, 12, 26)]);
            assert.deepEqual(['c', 'e', 'f'].map(id => rectOf(moved, id)), [at(0, 26, 12, 26), at(12, 26, 12, 26), at(24, 26, 12, 26)]);
            assert.deepEqual(rectOf(moved, 'g'), at(0, 52, 12, 26));
            assertValidLayout(moved);
        });

        it('starts the next row beside a tall item that reaches down into it', () => {
            const shortcut = (id: string, x: number, y: number) => item(id, SHORTCUT, { lg: at(x, y, 4, 14) });
            // A tall widget on the left, a full row of shortcuts beside it and one more on the row below
            const beside = [
                item('tall', ITEM_TYPE.NOTES_WIDGET, { lg: at(0, 0, 12, 52) }),
                ...[1, 2, 3, 4, 5, 6].map(n => shortcut(`s${n}`, 8 + n * 4, 0)),
                shortcut('s7', 12, 14),
                shortcut('s', 30, 200),
            ];
            const moved = moveDashboardGridItem(beside, 's', { x: 12, y: 0 }, 'lg');

            assert.deepEqual(rectOf(moved, 'tall'), at(0, 0, 12, 52));
            assert.deepEqual(rectOf(moved, 's'), at(12, 0, 4, 14));
            assert.deepEqual([1, 2, 3, 4, 5].map(n => rectOf(moved, `s${n}`)?.x), [16, 20, 24, 28, 32]);
            assert.deepEqual(rectOf(moved, 's6'), at(12, 14, 4, 14));
            assert.deepEqual(rectOf(moved, 's7'), at(16, 14, 4, 14));
            assertValidLayout(moved);
        });
    });

    it('leaves everything else alone when it lands in free space', () => {
        const moved = moveDashboardGridItem(start, 'c', { x: 12, y: 0 }, 'lg');

        assert.deepEqual(rectOf(moved, 'a'), at(0, 0, 12, 26));
        assert.deepEqual(rectOf(moved, 'b'), at(0, 26, 12, 26));
        assert.equal(moved.find(current => current.id === 'a'), start.find(current => current.id === 'a'));
    });

    it('stays inside the grid and does not touch other screen sizes', () => {
        const both = [item('a', WEATHER, { lg: at(0, 0, 12, 26), md: at(18, 0, 18, 26) })];
        const moved = moveDashboardGridItem(both, 'a', { x: 500, y: -9 }, 'lg');

        assert.deepEqual(moved[0].grid?.rects, { lg: at(24, 0, 12, 26), md: at(18, 0, 18, 26) });
    });

    it('ignores an item that is not in the layout', () => {
        assert.equal(moveDashboardGridItem(start, 'missing', { x: 1, y: 1 }, 'lg').length, 3);
    });
});

describe('resizing', () => {
    it('stops at the smallest and largest size for the type, and at the right edge', () => {
        const layout = [
            item('s', SHORTCUT, { lg: at(30, 0, 4, 14) }),
            item('w', WEATHER, { lg: at(0, 0, 12, 26) }),
        ];

        assert.deepEqual(rectOf(resizeDashboardGridItem(layout, 's', { w: 1, h: 1 }, 'lg'), 's'), at(30, 0, 3, 12));
        assert.deepEqual(rectOf(resizeDashboardGridItem(layout, 's', { w: 99, h: 999 }, 'lg'), 's'), at(30, 0, 6, 120));
        assert.deepEqual(rectOf(resizeDashboardGridItem(layout, 'w', { w: 2, h: 2 }, 'lg'), 'w'), at(0, 0, 8, 18));
    });

    // `b` is beside `a` and `c` is below it
    const layout = [
        item('a', WEATHER, { lg: at(0, 0, 12, 26) }),
        item('b', WEATHER, { lg: at(12, 0, 12, 26) }),
        item('c', WEATHER, { lg: at(0, 26, 12, 26) }),
    ];

    it('shifts a neighbour right when growing wider into it, and down when growing taller', () => {
        const wider = resizeDashboardGridItem(layout, 'a', { w: 20, h: 26 }, 'lg');
        const taller = resizeDashboardGridItem(layout, 'a', { w: 12, h: 40 }, 'lg');

        assert.deepEqual(rectOf(wider, 'b'), at(20, 0, 12, 26));
        assert.deepEqual(rectOf(wider, 'c'), at(0, 26, 12, 26));
        assert.deepEqual(rectOf(taller, 'b'), at(12, 0, 12, 26));
        assert.deepEqual(rectOf(taller, 'c'), at(0, 40, 12, 26));
        assertValidLayout(wider);
        assertValidLayout(taller);
    });

    it('does both when growing from the corner', () => {
        const larger = resizeDashboardGridItem(layout, 'a', { w: 20, h: 40 }, 'lg');

        assert.deepEqual(rectOf(larger, 'a'), at(0, 0, 20, 40));
        assert.deepEqual(rectOf(larger, 'b'), at(20, 0, 12, 26));
        assert.deepEqual(rectOf(larger, 'c'), at(0, 40, 12, 26));
        assertValidLayout(larger);
    });

    it('wraps the item at the right edge to the start of the next row when growing wider into a full row', () => {
        const full = [...layout, item('d', WEATHER, { lg: at(24, 0, 12, 26) })];
        const wider = resizeDashboardGridItem(full, 'a', { w: 20, h: 26 }, 'lg');

        assert.deepEqual(rectOf(wider, 'b'), at(20, 0, 12, 26));
        assert.deepEqual(rectOf(wider, 'd'), at(0, 26, 12, 26));
        assert.deepEqual(rectOf(wider, 'c'), at(12, 26, 12, 26));
        assertValidLayout(wider);
    });
});

describe('placing an item that joins a layout', () => {
    const layout = [
        item('a', WEATHER, { lg: at(0, 0, 12, 26) }),
        item('b', WEATHER, { lg: at(12, 0, 12, 26) }),
    ];

    it('keeps its size, ignores where it used to be and disturbs nothing', () => {
        const copy = placeDashboardGridItem(layout, item('copy', WEATHER, { lg: at(0, 0, 20, 30) }), ['lg', 'md']);
        const joined = layoutDashboardGrid([...layout, copy], ['lg']);

        assert.deepEqual(getGridRect(copy, 'lg'), at(0, 26, 20, 30));
        assert.deepEqual(getGridRect(copy, 'md'), at(0, 26, 18, 26));
        assert.deepEqual(rectOf(joined, 'a'), at(0, 0, 12, 26));
        assert.deepEqual(rectOf(joined, 'copy'), at(0, 26, 20, 30));
        assertValidLayout(joined);
    });

    it('takes the first free spot', () => {
        assert.deepEqual(getGridRect(placeDashboardGridItem(layout, item('s', SHORTCUT), ['lg']), 'lg'), at(24, 0, 4, 14));
    });
});

describe('snapping', () => {
    // Two widgets side by side on the top row, and a shortcut well away from them
    const layout = [
        item('a', WEATHER, { lg: at(0, 0, 12, 26) }),
        item('b', WEATHER, { lg: at(12, 0, 12, 26) }),
        item('s', SHORTCUT, { lg: at(30, 60, 4, 14) }),
    ];

    it('pulls a dragged item onto a nearby column and row', () => {
        // One column right of the widgets' edge, two rows below their top
        assert.deepEqual(snapGridPoint(layout, 's', { x: 25, y: 2 }, 'lg'), { x: 24, y: 0 });
    });

    it('lines up the right and bottom edges too', () => {
        // Right edge one column short of the grid edge, bottom one row past the widgets' bottom
        assert.deepEqual(snapGridPoint(layout, 's', { x: 31, y: 13 }, 'lg'), { x: 32, y: 12 });
    });

    it('leaves the item alone when no edge is close', () => {
        assert.deepEqual(snapGridPoint(layout, 's', { x: 27, y: 40 }, 'lg'), { x: 27, y: 40 });
    });

    it('prefers the left edge when both edges are equally close to a line', () => {
        const lines = [
            item('left', WEATHER, { lg: at(0, 0, 10, 26) }),
            item('right', WEATHER, { lg: at(15, 0, 10, 26) }),
            item('m', SHORTCUT, { lg: at(30, 60, 3, 14) }),
        ];

        // Left edge is 1 from column 10, right edge is 1 from column 15
        assert.equal(snapGridPoint(lines, 'm', { x: 11, y: 40 }, 'lg').x, 10);
    });

    it('does not shift an axis the item has not moved along', () => {
        const offset = [...layout, item('o', SHORTCUT, { lg: at(1, 60, 4, 14) })];

        // Column 0 is one away, but the drag is straight down
        assert.deepEqual(snapGridPoint(offset, 'o', { x: 1, y: 40 }, 'lg'), { x: 1, y: 40 });
    });

    it('never snaps an item to itself', () => {
        const alone = [item('s', SHORTCUT, { lg: at(10, 40, 4, 14) })];

        assert.deepEqual(snapGridPoint(alone, 's', { x: 11, y: 41 }, 'lg'), { x: 11, y: 41 });
    });

    it('pulls a resized edge onto a neighbour\'s edge', () => {
        const stacked = [
            item('top', WEATHER, { lg: at(0, 0, 20, 26) }),
            item('side', WEATHER, { lg: at(12, 26, 12, 40) }),
            item('r', WEATHER, { lg: at(0, 26, 10, 20) }),
        ];

        // Right edge one short of the neighbour's left edge, bottom one short of its bottom
        assert.deepEqual(snapGridSize(stacked, 'r', { w: 11, h: 39 }, 'lg'), { w: 12, h: 40 });
    });

    it('matches another item\'s width and height when close', () => {
        const sized = [
            item('model', WEATHER, { lg: at(20, 100, 9, 31) }),
            item('r', WEATHER, { lg: at(0, 0, 12, 26) }),
        ];

        assert.deepEqual(snapGridSize(sized, 'r', { w: 10, h: 33 }, 'lg'), { w: 9, h: 31 });
    });

    it('does not change a dimension that is not being resized', () => {
        const stacked = [
            item('side', WEATHER, { lg: at(12, 0, 12, 27) }),
            item('r', WEATHER, { lg: at(0, 0, 10, 26) }),
        ];

        // Dragging the right edge only: the height stays 26 although 27 is one away
        assert.deepEqual(snapGridSize(stacked, 'r', { w: 11, h: 26 }, 'lg'), { w: 12, h: 26 });
    });
});

describe('snapping to neighbours', () => {
    const shortcut = (id: string, x: number, y: number) => item(id, SHORTCUT, { lg: at(x, y, 4, 14) });
    // The item being dragged always starts far away, at the bottom of the board
    const dragged = shortcut('s', 30, 200);

    it('drops a like-sized item into the matching spot beside its neighbour', () => {
        const row = [shortcut('a', 24, 0), shortcut('b', 28, 0), dragged];

        // Roughly left of the row and 5 rows low: lands flush, on the row
        assert.deepEqual(snapGridPoint(row, 's', { x: 21, y: 5 }, 'lg'), { x: 20, y: 0 });
    });

    it('starts the next row once it is dragged far enough down', () => {
        const row = [shortcut('a', 24, 0), shortcut('b', 28, 0), dragged];

        assert.deepEqual(snapGridPoint(row, 's', { x: 21, y: 10 }, 'lg'), { x: 20, y: 14 });
    });

    it('lines up with the top, then the bottom, of a neighbour of another size', () => {
        const beside = [item('w', WEATHER, { lg: at(0, 0, 12, 26) }), dragged];

        assert.deepEqual(snapGridPoint(beside, 's', { x: 13, y: 5 }, 'lg'), { x: 12, y: 0 });
        assert.deepEqual(snapGridPoint(beside, 's', { x: 14, y: 9 }, 'lg'), { x: 12, y: 12 });
    });

    it('lets go when dragged on, for a position of the user\'s own beside the neighbour', () => {
        const beside = [item('tall', ITEM_TYPE.NOTES_WIDGET, { lg: at(0, 0, 12, 52) }), dragged];

        // Still flush against it, but freely placed between its top and bottom
        assert.deepEqual(snapGridPoint(beside, 's', { x: 13, y: 20 }, 'lg'), { x: 12, y: 20 });
    });

    it('prefers a like-sized neighbour over a nearer one of another size', () => {
        const between = [item('w', WEATHER, { lg: at(0, 0, 12, 26) }), shortcut('a', 16, 6), dragged];

        // The widget's top is 1 row away, the other shortcut's top is 5
        assert.deepEqual(snapGridPoint(between, 's', { x: 12, y: 1 }, 'lg'), { x: 12, y: 6 });
    });

    it('only pulls weakly towards items that are not neighbours', () => {
        const apart = [item('w', WEATHER, { lg: at(0, 0, 12, 26) }), dragged];

        // Eight columns clear of the widget: its top is 5 rows away, too far
        assert.deepEqual(snapGridPoint(apart, 's', { x: 20, y: 5 }, 'lg'), { x: 20, y: 5 });
        assert.deepEqual(snapGridPoint(apart, 's', { x: 20, y: 2 }, 'lg'), { x: 20, y: 0 });
    });

    it('matches a neighbour\'s height when resizing, and lets go further out', () => {
        const pair = [
            item('side', WEATHER, { lg: at(12, 0, 12, 30) }),
            item('r', WEATHER, { lg: at(0, 0, 12, 26) }),
        ];

        assert.deepEqual(snapGridSize(pair, 'r', { w: 12, h: 27 }, 'lg'), { w: 12, h: 30 });
        assert.deepEqual(snapGridSize(pair, 'r', { w: 12, h: 34 }, 'lg'), { w: 12, h: 30 });
        assert.deepEqual(snapGridSize(pair, 'r', { w: 12, h: 36 }, 'lg'), { w: 12, h: 36 });
    });

    it('grows a resized item up to its neighbour\'s edge', () => {
        const pair = [
            item('side', WEATHER, { lg: at(20, 0, 12, 26) }),
            item('r', WEATHER, { lg: at(0, 0, 12, 26) }),
        ];

        assert.deepEqual(snapGridSize(pair, 'r', { w: 18, h: 26 }, 'lg'), { w: 20, h: 26 });
        assert.deepEqual(snapGridSize(pair, 'r', { w: 16, h: 26 }, 'lg'), { w: 16, h: 26 });
    });
});

describe('many moves and resizes in a row', () => {
    it('never leaves items overlapping or outside the grid', () => {
        let seed = 7;
        const random = (limit: number): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % limit;
        };
        const types = [WEATHER, SHORTCUT, ITEM_TYPE.DUAL_WIDGET, ITEM_TYPE.GROUP_WIDGET, ITEM_TYPE.BLANK_ROW, ITEM_TYPE.NOTES_WIDGET];
        let layout = layoutDashboardGrid(
            Array.from({ length: 40 }, (_, index) => item(`i${index}`, types[index % types.length])),
            ['lg'],
        );

        assertValidLayout(layout);

        for (let step = 0; step < 400; step += 1) {
            const id = `i${random(40)}`;

            const before = rectOf(layout, id)!;

            if (random(2)) {
                const point = snapGridPoint(layout, id, { x: random(50) - 5, y: random(300) - 5 }, 'lg');
                layout = moveDashboardGridItem(layout, id, point, 'lg');

                // Nothing it displaces may displace it in turn
                assert.deepEqual(
                    rectOf(layout, id),
                    at(Math.min(Math.max(point.x, 0), 36 - before.w), Math.max(point.y, 0), before.w, before.h),
                );
            } else {
                const size = snapGridSize(layout, id, { w: random(45), h: random(140) }, 'lg');
                layout = resizeDashboardGridItem(layout, id, size, 'lg');

                const after = rectOf(layout, id)!;
                assert.deepEqual([after.x, after.y], [before.x, before.y]);
            }

            assertValidLayout(layout);
            assert.equal(layout.length, 40);
        }
    });
});
