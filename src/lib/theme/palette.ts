// src/lib/theme/palette.ts
export const palette = {
    light: {
        bg: '#faf9f6',  // Cream / egg paper
        surface: '#ffffff',
        border: '#e8e4dc',
        text: '#1a1a1a',
        muted: '#666666',

        // 20 beautiful, muted Nordic colours for lifespan bars
        c01: '#8b6f47',  // Warm rye
        c02: '#2c6b8e',  // Fjord blue
        c03: '#a63a50',  // Lingon red
        c04: '#5d8066',  // Moss green
        c05: '#6b5e7a',  // Dusk violet
        c06: '#c87a3a',  // Amber glow
        c07: '#4a5568',  // Slate steel
        c08: '#8b7d6b',  // Weathered stone
        c09: '#3e5a6e',  // Deep ocean
        c10: '#9a6d7a',  // Heather mauve
        c11: '#b86b4a',  // Burnt sienna
        c12: '#4a7a6b',  // Pine shadow
        c13: '#7a5e6b',  // Plum dusk
        c14: '#d9a657',  // Golden wheat
        c15: '#5e6b8b',  // Nordic navy
        c16: '#a6576b',  // Rosewood
        c17: '#6b8b7a',  // Sea foam deep
        c18: '#8b5a6b',  // Vintage wine
        c19: '#3a6b5e',  // Spruce deep
        c20: '#d97a3a',  // Warm terracotta
    },

    dark: {
        bg: '#0f0f0f',
        surface: '#1a1a1a',
        border: '#2d2d2d',
        text: '#f5f5f5',
        muted: '#aaaaaa',

        // Same 20 colours, slightly boosted saturation for dark mode pop
        c01: '#bfa575',
        c02: '#4a9cd9',
        c03: '#e05577',
        c04: '#8abf94',
        c05: '#9b81b8',
        c06: '#f4a261',
        c07: '#94a3b8',
        c08: '#c4b29a',
        c09: '#6b9ecf',
        c10: '#d4a3c1',
        c11: '#f49e7a',
        c12: '#7abfa3',
        c13: '#c49ab8',
        c14: '#f4d28f',
        c15: '#94a8d9',
        c16: '#e08ba3',
        c17: '#94c9b0',
        c18: '#d48fb0',
        c19: '#6bbfa3',
        c20: '#f4a377',
    }
} as const;
