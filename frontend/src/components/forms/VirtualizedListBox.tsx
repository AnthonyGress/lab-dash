import { Box } from '@mui/material';
import React, { forwardRef } from 'react';
import { AutoSizer, List, ListRowRenderer } from 'react-virtualized';

export const VirtualizedListbox = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLElement>>(
    function VirtualizedListbox(props, ref) {
        const { children, ...other } = props;
        const items = React.Children.toArray(children);

        const rowRenderer: ListRowRenderer = ({ index, key, style }) => {
            return (
                <div key={key} style={style}>
                    {items[index]}
                </div>
            );
        };

        return (
            <Box ref={ref} {...other} sx={{ width: '100%', height: 300 }}>
                <AutoSizer>
                    {({ width, height }) => (
                        <List
                            width={width}
                            height={height}
                            rowCount={items.length}
                            rowHeight={40}
                            rowRenderer={rowRenderer}
                        />
                    )}
                </AutoSizer>
            </Box>
        );
    }
);
