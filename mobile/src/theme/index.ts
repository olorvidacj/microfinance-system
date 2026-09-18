export const colors = {
  // Primary — deep navy (HOSCOMO brand)
  primary: '#091527',
  primaryDark: '#0D1C33',
  primaryDeep: '#06101C',
  primaryBright: '#F59E0B',
  primaryLight: '#FBBF24',
  primarySoft: '#FFFBEB',
  primaryBorder: '#FDE68A',

  // Accent — gold (replaces legacy teal)
  teal: '#D97706',
  tealDark: '#B45309',
  tealSoft: '#FFFBEB',
  tealBorder: '#FDE68A',
  green: '#10B981',
  greenDark: '#059669',
  greenSoft: '#ECFDF5',
  greenBorder: '#A7F3D0',

  // Semantic
  danger: '#DC2626',
  dangerDark: '#B91C1C',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  info: '#0284C7',
  infoSoft: '#F0F9FF',
  infoBorder: '#BAE6FD',

  // Neutrals
  white: '#FFFFFF',
  background: '#F1F5F9',
  surface: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  ink: '#0F172A',
  navy: '#091527',

  // Gold scale
  gold: '#F59E0B',
  goldLight: '#FBBF24',
  goldSoft: '#FFFBEB',
  goldBorder: '#FDE68A',
  goldDeep: '#B45309',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  round: 999,
} as const;

export const typography = {
  title1: { fontSize: 28, fontWeight: '800', lineHeight: 34, color: colors.text },
  title2: { fontSize: 22, fontWeight: '800', lineHeight: 28, color: colors.text },
  title3: { fontSize: 18, fontWeight: '700', lineHeight: 24, color: colors.text },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 20, color: colors.text },
  bodyMedium: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: colors.text },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16, color: colors.textMuted },
  captionBold: { fontSize: 12, fontWeight: '700', lineHeight: 16, color: colors.text },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18, color: colors.textSecondary },
  overline: { fontSize: 11, fontWeight: '700', lineHeight: 14, color: colors.textMuted, letterSpacing: 0.6 as const },
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  hero: {
    shadowColor: colors.primaryDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} as const;

export default theme;