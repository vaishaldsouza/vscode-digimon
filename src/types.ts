export type DigimonType = 'agumon' | 'gabumon' | 'patamon';
export type DigimonSize = 'small' | 'medium' | 'large';

export const SPRITE_SIZES: Record<DigimonSize, number> = {
    small: 48,
    medium: 64,
    large: 96,
};

// Floor height in px from bottom per size (no theme backgrounds).
export const FLOOR_HEIGHTS: Record<DigimonSize, number> = {
    small: 0, medium: 0, large: 0,
};

export interface DigimonDef {
    type: DigimonType;
    label: string;
    phrases: string[];
}

export const DIGIMON_DEFS: Record<DigimonType, DigimonDef> = {
    agumon: {
        type: 'agumon',
        label: 'Agumon',
        phrases: [
            'Pepper Breath! 🔥',
            'Let\'s digivolve! ⚡',
            'I smell a bug! 🔍',
            'Keep coding! 💪',
            'Tai, where are you? 👦',
        ],
    },
    gabumon: {
        type: 'gabumon',
        label: 'Gabumon',
        phrases: [
            'Blue Blaster! ❄️',
            'Matt would be proud! 🎸',
            'Analysing your code... 🔍',
            'No bugs on my watch! 🐺',
            'Horn Blaster incoming! 💨',
        ],
    },
    patamon: {
        type: 'patamon',
        label: 'Patamon',
        phrases: [
            'Boom Bubble! 🫧',
            'T.K. needs me! 🧢',
            'Such clean code! ✨',
            'Digivolution ready! 🕊️',
            'Boom Bubble POP! 💥',
        ],
    },
};
