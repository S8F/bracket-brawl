// Shared colours, spacing and size rules so every screen looks the same.
// Dark "broadcast" look: gold / cyan / red accents on a near-black background.

export const colors = {
  background: '#0B0D12',
  surface: '#151922',
  border: '#2A3140',
  text: '#F2F4F8',
  textMuted: '#A8B0C0',
  gold: '#F5C542',
  cyan: '#38D5F0',
  red: '#FF6B6B',
  onGold: '#14110A',
} as const;

// Font names as the font packages register them (loaded in App.tsx).
// Saira Condensed = titles and badges, Archivo = normal text and buttons, Space Mono = scores and points.
export const fonts = {
  display: 'SairaCondensed_700Bold',
  body: 'Archivo_400Regular',
  bodyBold: 'Archivo_700Bold',
  mono: 'SpaceMono_700Bold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

// Apple's Human Interface Guidelines: tap targets should be at least 44 x 44 points.
export const MIN_TAP_TARGET = 44;
