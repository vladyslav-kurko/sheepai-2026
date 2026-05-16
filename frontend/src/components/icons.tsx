// export function SheepLogo({ size = 40 }: { size?: number }) {
//   return <GoOverLogo size={size} />;
// }

export function GoOverLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <line x1="9.5" y1="20" x2="14.5" y2="20" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" />
      <line x1="21.5" y1="20" x2="27" y2="20" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" />
      <circle cx="6" cy="20" r="3" fill="#0369A1" />
      <circle cx="18" cy="20" r="3" fill="#0369A1" />
      <circle cx="33" cy="20" r="5.5" fill="#0369A1" />
      <path
        d="M29.5 20.5 L32 22.5 L36.5 17.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
