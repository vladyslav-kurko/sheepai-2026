export function SheepLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <ellipse cx="20" cy="22" rx="11" ry="8.5" fill="#334155" />
      <ellipse cx="13" cy="17" rx="5" ry="5" fill="#334155" />
      <ellipse cx="27" cy="17" rx="5" ry="5" fill="#334155" />
      <ellipse cx="20" cy="15.5" rx="8" ry="6" fill="#334155" />
      <ellipse cx="20" cy="14.5" rx="6.5" ry="4.5" fill="#F1F5F9" />
      <circle cx="17.8" cy="13.8" r="1" fill="#020617" />
      <circle cx="22.2" cy="13.8" r="1" fill="#020617" />
      <circle cx="18.2" cy="13.5" r="0.35" fill="#F8FAFC" />
      <circle cx="22.6" cy="13.5" r="0.35" fill="#F8FAFC" />
      <rect x="16" y="28" width="2.5" height="5" rx="1.25" fill="#334155" />
      <rect x="21.5" y="28" width="2.5" height="5" rx="1.25" fill="#334155" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
