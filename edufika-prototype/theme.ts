
export const COLORS = {
  BG: '#050505',
  PRIMARY: '#39ff14',
  SECONDARY: '#1a1a1a',
  DANGER: '#ff3131',
  SUCCESS: '#00ffcc',
  SURFACE: '#0a0a0a',
};

export const COMMON = {
  container: {
    minHeight: '100vh',
    backgroundColor: COLORS.BG,
  },
  neonBorder: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
  },
  terminalText: {
    color: COLORS.PRIMARY,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.08em',
  },
  header: {
    fontSize: '1.125rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.25em',
    color: COLORS.PRIMARY,
    textShadow: '0 0 10px rgba(57, 255, 20, 0.5)',
  },
};
