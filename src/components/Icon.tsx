import type { SVGProps } from "react";

export type IconName = "library" | "template" | "import" | "settings" | "pages" | "outline" | "assets" | "search" | "plus" | "duplicate" | "trash" | "review" | "export" | "undo" | "redo" | "chevron" | "book" | "question" | "command" | "more" | "close" | "check" | "warning";

const paths: Record<IconName, React.ReactNode> = {
  library: <path d="M3 7.5h6l1.5 2H21v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7.5v-2a2 2 0 0 1 2-2h4l1.5 2H19a2 2 0 0 1 2 2v2" />,
  template: <path d="M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4M15 3v4h4" />,
  import: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 18v3h14v-3" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.09a1.7 1.7 0 0 0-1.51 1z" /></>,
  pages: <path d="M7 3h10v4H7zM5 7h14v14H5zM8 11h8M8 15h8M8 18h5" />,
  outline: <path d="M4 6h2m3 0h11M4 12h2m3 0h11M4 18h2m3 0h11" />,
  assets: <><rect x="3" y="4" width="18" height="16" rx="1" /><circle cx="8" cy="9" r="1.5" /><path d="m5 18 5-5 3 3 2-2 4 4" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  duplicate: <path d="M8 8h11v12H8zM5 16H4V4h11v1" />,
  trash: <path d="M4 7h16M9 11v6m6-6v6M8 7l1-3h6l1 3m2 0-1 14H7L6 7" />,
  review: <><path d="M5 3h14v18H5zM8 8l2 2 4-4M8 15h8" /></>,
  export: <path d="M12 15V3m0 0-4 4m4-4 4 4M5 13v8h14v-8" />,
  undo: <path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" />,
  redo: <path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  book: <path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zm16 0h-4a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h4z" />,
  question: <><path d="M5 3h14v18H5zM9 8a3 3 0 1 1 4 2.83V13" /><path d="M13 17h.01" /></>,
  command: <path d="M9 6V5a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
  warning: <><path d="M12 3 2.8 20h18.4z" /><path d="M12 9v5m0 3h.01" /></>,
};

export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}
