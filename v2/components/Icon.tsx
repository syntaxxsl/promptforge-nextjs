'use client'

export type IconName =
  | 'overview'
  | 'folder'
  | 'code'
  | 'trash'
  | 'user'
  | 'sparkles'
  | 'vision'
  | 'bug'
  | 'image'
  | 'compass'
  | 'bag'
  | 'sliders'
  | 'settings'
  | 'shield'
  | 'headset'
  | 'message'
  | 'activity'
  | 'terminal'
  | 'pulse'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'plus'
  | 'logout'
  | 'arrowRight'
  | 'copy'
  | 'chevronLeft'
  | 'chevronRight'
  | 'pen'
  | 'map'
  | 'layers'
  | 'users'
  | 'download'
  | 'play'
  | 'search'
  | 'check'
  | 'paperclip'

const paths: Record<IconName, React.ReactNode> = {
  overview: (<><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></>),
  folder: (<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3l2 2.5h8A2.5 2.5 0 0 1 21 10v7.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />),
  copy: (<><rect x="9" y="9" width="11.5" height="11.5" rx="2.4" /><path d="M15 5.6V5A2 2 0 0 0 13 3H5.4A2.4 2.4 0 0 0 3 5.4v7.6A2 2 0 0 0 5 15h.6" /></>),
  code: (<><path d="M9 8l-4 4 4 4" /><path d="M15 8l4 4-4 4" /></>),
  trash: (<><path d="M4 7h16" /><path d="M9.5 7V5.2c0-.66.54-1.2 1.2-1.2h2.6c.66 0 1.2.54 1.2 1.2V7" /><path d="M6.2 7 7 19.2c.04.46.42.8.88.8h8.24c.46 0 .84-.34.88-.8L18 7" /><path d="M10.5 11v5M13.5 11v5" /></>),
  user: (<><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6" /></>),
  sparkles: (<><path d="M12 3.5c.5 4.3 3.2 7 7.5 7.5-4.3.5-7 3.2-7.5 7.5-.5-4.3-3.2-7-7.5-7.5 4.3-.5 7-3.2 7.5-7.5Z" /><path d="M18.5 16.5c.2 1.5 1.1 2.4 2.6 2.6-1.5.2-2.4 1.1-2.6 2.6-.2-1.5-1.1-2.4-2.6-2.6 1.5-.2 2.4-1.1 2.6-2.6Z" /></>),
  vision: (<><path d="M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12 18 17.8 12 17.8 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" /></>),
  bug: (<><path d="M8 9.5a4 4 0 0 1 8 0V15a4 4 0 0 1-8 0Z" /><path d="M8 11H4.5M16 11h3.5M8 15.5H4.5M16 15.5h3.5M9 5 7.5 3M15 5l1.5-2" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2.4" /><circle cx="8.6" cy="9.6" r="1.5" /><path d="m4 17.5 4.6-4.6 3.4 3.4 3-3L20 18" /></>),
  compass: (<><circle cx="12" cy="12" r="9" /><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1Z" /></>),
  bag: (<><path d="M5.4 8h13.2l1.1 11.2c.05.45-.3.8-.75.8H5.05c-.45 0-.8-.35-.75-.8Z" /><path d="M9 8V6.2a3 3 0 0 1 6 0V8" /></>),
  sliders: (<><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2.2" /><circle cx="8" cy="16" r="2.2" /></>),
  settings: (<><circle cx="12" cy="12" r="3.1" /><path d="M19.4 14.6a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" /></>),
  shield: (<path d="M12 3.2 19 6v5.6c0 4.6-3 7.7-7 9.4-4-1.7-7-4.8-7-9.4V6Z" />),
  headset: (<><path d="M4 13.5a8 8 0 0 1 16 0" /><path d="M4 13.5h1.8c.66 0 1.2.54 1.2 1.2v3.1c0 .66-.54 1.2-1.2 1.2H4.8A1.8 1.8 0 0 1 3 17.2v-1.8c0-.5.4-1 .9-1.1" /><path d="M20 13.5h-1.8c-.66 0-1.2.54-1.2 1.2v3.1c0 .66.54 1.2 1.2 1.2h1.2a1.8 1.8 0 0 0 1.8-1.8v-1.8c0-.5-.4-1-.9-1.1" /><path d="M17 19.2a2.4 2.4 0 0 1-2.4 2.3H13" /></>),
  message: (<><path d="M20 14.4a2.4 2.4 0 0 1-2.4 2.4H8.6L4 20.6V5.8A2.4 2.4 0 0 1 6.4 3.4h11.2A2.4 2.4 0 0 1 20 5.8Z" /></>),
  activity: (<><path d="M3 12h3.6L9 5.5l4 13 2.4-6.5H21" /></>),
  terminal: (<><rect x="3" y="4.5" width="18" height="15" rx="2.2" /><path d="m7.8 10 2.2 2.2-2.2 2.2M12.8 14.6H16" /></>),
  pulse: (<><path d="M2.5 12.5h4L9 5l4.2 14 2.4-6.5h5.9" /></>),
  bell: (<><path d="M18 9a6 6 0 1 0-12 0c0 4-1.6 5.2-2.2 5.8-.3.3-.1.9.3.9h15.8c.4 0 .6-.6.3-.9C19.6 14.2 18 13 18 9Z" /><path d="M10 19.2a2.2 2.2 0 0 0 4 0" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" /></>),
  moon: (<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z" />),
  menu: (<path d="M4 7h16M4 12h16M4 17h16" />),
  plus: (<path d="M12 5v14M5 12h14" />),
  logout: (<><path d="M14.5 4.5h3A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5h-3" /><path d="M9 8 5 12l4 4M5 12h9" /></>),
  arrowRight: (<path d="M5 12h13M13 6l6 6-6 6" />),
  chevronLeft: (<path d="M14 6l-6 6 6 6" />),
  chevronRight: (<path d="M10 6l6 6-6 6" />),
  pen: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  map: (<><path d="M9 4 3 6.2v13.6L9 17.6l6 2.2 6-2.2V4l-6 2.2Z" /><path d="M9 4v13.6M15 6.2v13.6" /></>),
  layers: (<><path d="M12 3 3 8l9 5 9-5Z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 16.5 9 5 9-5" /></>),
  users: (<><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c0-3 2.7-4.9 6-4.9s6 1.9 6 4.9" /><path d="M16 5.6a3.2 3.2 0 0 1 0 6M17.5 14.9c2.1.4 3.5 1.9 3.5 4.6" /></>),
  download: (<><path d="M12 4v11" /><path d="m7.5 11 4.5 4.5 4.5-4.5" /><path d="M4 20h16" /></>),
  play: (<path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l10-6.8c.6-.4.6-1.4 0-1.8l-10-6.8c-.7-.4-1.6.1-1.6.9Z" />),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m16.2 16.2 4.3 4.3" /></>),
  check: (<path d="m5 12.5 4.5 4.5L19 7.5" />),
  paperclip: (<path d="M20 11.5 12.2 19.3a4.6 4.6 0 0 1-6.5-6.5l8-8a3.2 3.2 0 0 1 4.5 4.5l-8 8a1.8 1.8 0 0 1-2.5-2.5l7.2-7.2" />)
}

export default function Icon({ name, className = 'h-[18px] w-[18px]', strokeWidth = 1.6 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  )
}