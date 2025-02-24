import { motion } from 'framer-motion';
import React from 'react';


const wiggleAnimation = {
    initial: { rotate: 0 },
    animate: {
        rotate: [0, 0.4, -0.4, 0.3, -0.3, 0], // Less rotation for subtle effect
        transition: { repeat: Infinity, duration: 0.6, ease: 'easeInOut' },
    },
};

type Props = {
    editMode: boolean;
    children: React.ReactNode;
}

export const WiggleWrapper = ({ editMode, children }: Props) => {
    return (
        <motion.div
            initial='initial'
            animate={editMode ? 'animate' : 'initial'}
            variants={wiggleAnimation}
        >
            {children}
        </motion.div>
    );
};
