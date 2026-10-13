import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const ChartIcon = () => (
  <Icon>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);
export const BoardIcon = () => (
  <Icon>
    <rect x="3" y="4" width="5" height="16" rx="1" />
    <rect x="10" y="4" width="5" height="10" rx="1" />
    <rect x="17" y="4" width="4" height="13" rx="1" />
  </Icon>
);
export const BellIcon = () => (
  <Icon>
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />
  </Icon>
);
export const ChatIcon = () => (
  <Icon>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.7A8 8 0 1 1 21 12z" />
  </Icon>
);
export const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
  </Icon>
);
export const LogoutIcon = () => (
  <Icon>
    <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />
  </Icon>
);
export const CheckIcon = () => (
  <Icon>
    <path d="m5 12 5 5 9-10" />
  </Icon>
);
export const AlertIcon = () => (
  <Icon>
    <path d="M12 4 2.5 20h19L12 4zM12 10v4.5M12 17.5v.01" />
  </Icon>
);
export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5v.01" />
  </Icon>
);
export const FlagIcon = () => (
  <Icon>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Icon>
);
export const CalendarIcon = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
);
export const NoteIcon = () => (
  <Icon>
    <path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20V3.5zM14.5 3.5V8H19M9 12.5h6M9 16h4" />
  </Icon>
);
export const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.5l3.5 2" />
  </Icon>
);
export const ChevronLeftIcon = () => (
  <Icon>
    <path d="m14.5 6-6 6 6 6" />
  </Icon>
);
export const FilmIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21" />
  </Icon>
);
export const TvIcon = () => (
  <Icon>
    <rect x="3" y="6" width="18" height="12.5" rx="2" />
    <path d="M8.5 21.5h7M9 2.5l3 3.5 3-3.5" />
  </Icon>
);
export const StarIcon = () => (
  <Icon fill="currentColor" strokeWidth="1.5">
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5z" />
  </Icon>
);
export const ExternalIcon = () => (
  <Icon>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icon>
);
export const SendIcon = () => (
  <Icon>
    <path d="M4 12 20 4l-6 16-3-7-7-1z" />
  </Icon>
);
export const PencilIcon = () => (
  <Icon>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
  </Icon>
);
export const TrashIcon = () => (
  <Icon>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icon>
);
export const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
export const GripIcon = () => (
  <Icon>
    <circle cx="9" cy="6" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="18" r="1" />
  </Icon>
);
