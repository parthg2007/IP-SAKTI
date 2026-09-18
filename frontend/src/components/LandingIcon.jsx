const paths = {
  panel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16m7-11-3 3 3 3" /></>,
  message: <path d="M20 11.5A8.5 8.5 0 0 1 11.5 20H4l-2 2V11.5a9 9 0 1 1 18 0Z" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  up: <path d="M12 19V5m-6 6 6-6 6 6" />,
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  diagonal: <path d="M6 18 18 6M6 6h12v12" />,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  book: <><path d="M12 5v16M12 5C8 2 3 3 3 3v15s5-1 9 3c4-4 9-3 9-3V3s-5-1-9 2Z" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  balance: <><path d="M12 3v18M7 21h10M4 7h16M6 7l-3 7h6L6 7Zm12 0-3 7h6l-3-7Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="m9 5 11 7-11 7V5Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  spark: <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />,
}

export default function LandingIcon({ name, className = '' }) {
  return <svg className={`size-5 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
