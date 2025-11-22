import type { SVGProps } from "react";

export function YoutubeIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M23.5 6.2s-.2-1.6-.8-2.3a2.9 2.9 0 00-2-.9C18.3 3 12 3 12 3h-.1s-6.3 0-8.7.4a2.9 2.9 0 00-2 .9C.6 4.6.5 6.2.5 6.2A30 30 0 000 9.9v2.2a30 30 0 00.5 3.7s.2 1.6.8 2.3a3 3 0 002 .9c1.6.3 8.7.4 8.7.4s6.3 0 8.7-.4a2.9 2.9 0 002-.9c.6-.7.8-2.3.8-2.3a30 30 0 00.5-3.7V9.9a30 30 0 00-.5-3.7zM9.7 12.8V7.8l5.2 2.5z"
      />
    </svg>
  );
}
