export enum COLORS {
    GRAY = '#2e2e2e',
    DARK_GRAY = '#242424',
    LIGHT_GRAY = '#c9c9c9',
    LIGHT_GRAY_TRANSPARENT = 'rgba(201, 201, 201, 0.8)',
    LIGHT_GRAY_HOVER = '#767676',
    PURPLE = '#734CDE',
    TRANSPARENT_GRAY = 'rgba(46,46,46, .7)',
    TRANSPARENT_DARK_GRAY = 'rgba(46,46,46, .9)',
    BORDER = '#424242'
}

export const styles = {
    vcenter: { display: 'flex', justifyContent: 'center', alignContent: 'center', flexDirection: 'column' },
    center: { display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
    widgetContainer: { backgroundColor: COLORS.TRANSPARENT_GRAY, borderRadius: '4px', border: `1px solid ${COLORS.BORDER}`, height: '14rem' },
};
