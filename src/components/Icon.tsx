export function Icon({
  name,
  size = 20,
}: {
  name:
    | "arrow"
    | "copy"
    | "check"
    | "wallet"
    | "close"
    | "down"
    | "settings"
    | "refresh"
    | "external";
  size?: number;
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V4H4v12h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    wallet: (
      <>
        <path d="M20 8H4V5h14v3M4 8v12h16V8" />
        <path d="M20 12h-6v4h6m-3-2h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    down: <path d="M12 4v16m-6-6 6 6 6-6" />,
    settings: (
      <>
        <path d="M5 4v16m7-16v16m7-16v16M2 8h6m1 8h6m1-6h6" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.5 7A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-1" />
      </>
    ),
    external: (
      <>
        <path d="M13 4h7v7m0-7L10 14" />
        <path d="M9 5H4v15h15v-5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
