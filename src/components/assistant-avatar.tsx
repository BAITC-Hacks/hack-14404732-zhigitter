/** Original electrical-module character, drawn as a code-native vector. */
export function AssistantAvatar({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`kontakt-avatar ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        focusable="false"
      >
        <circle cx="32" cy="32" r="31" fill="#EAF3F5" />
        <path
          d="M33 8V15"
          stroke="#2B7189"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M34 3L27 11H32L30 17L38 8H33L34 3Z" fill="#DC4144" />
        <rect x="8" y="28" width="7" height="14" rx="3.5" fill="#D04A47" />
        <rect x="49" y="28" width="7" height="14" rx="3.5" fill="#D04A47" />
        <rect x="13" y="18" width="38" height="35" rx="13" fill="#2B7189" />
        <rect x="17" y="22" width="30" height="26" rx="10" fill="#FFFFFF" />
        <path d="M23 50L20 57L31 51" fill="#2B7189" />
        <rect x="23" y="29" width="4" height="7" rx="2" fill="#235769" />
        <rect x="37" y="29" width="4" height="7" rx="2" fill="#235769" />
        <path
          d="M28 40C30 42 34 42 36 40"
          stroke="#235769"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="21" cy="38" r="2" fill="#F0B6AB" />
        <circle cx="43" cy="38" r="2" fill="#F0B6AB" />
      </svg>
    </span>
  );
}
