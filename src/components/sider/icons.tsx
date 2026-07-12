import type { SVGProps } from 'react';

export function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20" {...props}>
      <path fill="currentColor" d="M12.899 1.417H7.1c-.813 0-1.468 0-2 .043-.546.045-1.026.139-1.47.365a3.75 3.75 0 0 0-1.639 1.64c-.226.443-.32.924-.365 1.47-.044.531-.044 1.187-.044 2v10.167c0 .258 0 .5.018.697.02.205.064.475.236.722.221.319.563.532.946.592.297.046.56-.032.752-.105.186-.07.403-.177.634-.29l1.499-.73c.513-.25.708-.343.907-.409q.281-.092.574-.132c.208-.029.424-.03.995-.03h4.755c.813 0 1.468 0 2-.044.546-.044 1.026-.139 1.47-.365a3.75 3.75 0 0 0 1.639-1.639c.226-.444.32-.924.365-1.47.044-.532.044-1.187.044-2V6.935c0-.813 0-1.469-.044-2-.044-.546-.139-1.027-.365-1.47a3.75 3.75 0 0 0-1.639-1.64c-.444-.226-.924-.32-1.47-.365-.532-.043-1.187-.043-2-.043z" />
      <path fill="#fff" fillRule="evenodd" d="M5.25 7.113a.75.75 0 0 1 .75-.75h8a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75m0 4.667a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75" clipRule="evenodd" />
    </svg>
  );
}

export function AgentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="20" height="20" fill="none" {...props}>
      <defs>
        <mask id="agent-mask">
          <rect width="60" height="60" fill="#fff" />
          <path fill="#000" d="M43.34 25.01c0 6.66-5.39 12.06-12.05 12.06H13.09C6.43 37.07 1.03 31.67 1.03 25.01s5.4-12.05 12.06-12.05h18.2c6.66 0 12.05 5.39 12.05 12.05z" />
        </mask>
      </defs>
      <g clipPath="url(#agent-clip)">
        <circle cx="30" cy="30" r="25" stroke="currentColor" strokeWidth="4.5" />
        <g mask="url(#agent-mask)">
          <path stroke="currentColor" strokeWidth="4.5" d="M13 15h18c5.52 0 10 4.48 10 10s-4.48 10-10 10H13c-5.52 0-10-4.48-10-10s4.48-10 10-10z" />
        </g>
        <path stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" d="M41 40.5c-1.3 1.57-2.97 2.76-4.94 3.38s-4.02.61-5.99.07" />
      </g>
      <defs>
        <clipPath id="agent-clip"><rect width="60" height="60" x="0" y="0" /></clipPath>
      </defs>
    </svg>
  );
}

export function WriteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="20" height="20" fill="none" {...props}>
      <defs>
        <clipPath id="write-clip"><rect width="120" height="120" x="0" y="0" /></clipPath>
      </defs>
      <g clipPath="url(#write-clip)">
        <g transform="matrix(1,0,0,1,27.68,92.66)">
          <path stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" d="M-8.24 8.26 8.24-8.26" />
        </g>
        <g transform="matrix(1,0,0,1,82.11,38.13)">
          <path stroke="currentColor" strokeWidth="9" d="M6.84 25.89C6.84 25.89-25.89-6.84-25.89-6.84s2.52-4.54 2.52-4.54c4.2-7.55 6.29-11.32 9.27-12.99 2.61-1.46 5.68-1.89 8.59-1.21 3.33.78 6.39 3.84 12.5 9.95l8.64 8.65c6.11 6.11 9.17 9.16 9.95 12.49.68 2.91.25 5.98-1.21 8.59-1.66 2.98-5.44 5.08-12.99 9.28l-4.54 2.51z" />
        </g>
        <g transform="matrix(1,0,0,1,52.55,67.81)">
          <path stroke="currentColor" strokeWidth="9" d="M35.96-3.1v15.35c0 6.18 0 9.27-1.16 11.71-1.02 2.15-2.66 3.95-4.71 5.17-2.33 1.38-5.41 1.67-11.56 2.24L-28.78 35.8c-2.63.24-3.95.36-4.93-.09-.86-.4-1.54-1.08-1.94-1.94-.45-.98-.33-2.3-.09-4.93l4.37-47.31c.57-6.15.86-9.23 2.24-11.56 1.22-2.05 3.02-3.69 5.17-4.71 2.44-1.16 5.53-1.16 11.71-1.16h15.35z" />
        </g>
      </g>
    </svg>
  );
}

export function NoteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="20" height="20" fill="none" {...props}>
      <defs>
        <clipPath id="note-clip"><rect width="60" height="60" x="0" y="0" /></clipPath>
        <clipPath id="note-subclip"><path d="M0 0h60v60H0z" /></clipPath>
      </defs>
      <g clipPath="url(#note-clip)">
        <g clipPath="url(#note-subclip)">
          <path stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" d="M30 47.75c.85 1.47 1.95 2.78 3.24 3.86 2.52 2.12 5.77 3.39 9.32 3.39s6.81-1.27 9.33-3.39c1.29-1.08 2.39-2.39 3.24-3.86" />
          <path stroke="currentColor" strokeWidth="4.5" d="M42.5 28c0 0 0 0 0 0 3.59 0 6.5 2.91 6.5 6.5v6c0 3.59-2.91 6.5-6.5 6.5S36 44.09 36 40.5v-6c0-3.59 2.91-6.5 6.5-6.5z" />
        </g>
        <path stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" d="M24 30h-7" />
        <path stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" d="M34 18H17" />
        <path stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" d="M51 21.34v-1.94c0-5.04 0-7.56-.98-9.49-.86-1.69-2.24-3.07-3.93-3.93C44.17 5 41.64 5 36.6 5H20.4c-5.04 0-7.56 0-9.49.98-1.69.86-3.07 2.24-3.93 3.93C6 11.84 6 14.36 6 19.4v16.2c0 5.04 0 7.57.98 9.49.86 1.69 2.24 3.07 3.93 3.93C12.84 50 15.36 50 20.4 50h.92" />
      </g>
    </svg>
  );
}

export function ToolsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="20" height="20" fill="none" {...props}>
      <defs>
        <clipPath id="tools-clip"><rect width="120" height="120" x="0" y="0" /></clipPath>
      </defs>
      <g clipPath="url(#tools-clip)">
        <g transform="matrix(1,0,0,1,60,60)">
          <path fill="currentColor" d="M54.24-13.39c-.27-3.28-.83-6.15-2.19-8.82-2.16-4.23-5.6-7.68-9.83-9.84-2.67-1.36-5.55-1.92-8.83-2.19-1.47-.12-3.11-.18-4.92-.22-.02-.87-.04-1.67-.09-2.41-.13-1.9-.42-3.7-1.14-5.44-1.68-4.04-4.89-7.25-8.93-8.93-1.74-.72-3.54-1-5.44-1.13-1.83-.12-4.05-.13-6.72-.13s-4.89.01-6.72.13c-1.9.13-3.7.41-5.44 1.13-4.04 1.68-7.25 4.89-8.93 8.93-.72 1.74-1 3.54-1.13 5.44-.05.74-.07 1.54-.09 2.41-1.81.04-3.45.1-4.92.22-3.28.27-6.15.83-8.82 2.19-4.23 2.16-7.68 5.6-9.84 9.84-1.36 2.66-1.92 5.54-2.19 8.82-.26 3.19-.26 7.12-.26 12.78v14.78c0 5.66 0 9.59.26 12.78.27 3.28.83 6.18 2.19 8.83 2.16 4.23 5.6 7.67 9.84 9.83 2.67 1.36 5.55 1.92 8.83 2.19 3.19.26 7.12.26 12.78.26h42.78c5.66 0 9.6-.26 12.78-.26 3.28-.27 6.18-.83 8.83-2.19 4.23-2.16 7.67-5.6 9.83-9.83 1.36-2.66 1.92-5.55 2.19-8.83.26-3.19.26-7.12.26-12.78V13.2c0-5.66 0-9.59-.26-12.78zM-19.4-36.26c.1-1.44.28-2.15.47-2.61.76-1.84 2.22-3.3 4.06-4.06.46-.19 1.17-.37 2.61-.47 1.49-.1 3.4-.1 6.26-.1h12.52c2.86 0 4.78 0 6.26.1 1.44.1 2.15.28 2.61.47 1.84.76 3.3 2.22 4.06 4.06.19.46.37 1.17.47 2.61.04.53.06 1.1.07 1.76H-19.47c.02-.66.04-1.23.07-1.76zM-45.27-12.66c.22-2.72.64-4.28 1.24-5.47 1.29-2.54 3.36-4.61 5.9-5.9 1.19-.6 2.75-1.02 5.47-1.24 2.74-.22 6.26-.23 11.28-.23h42.76c5.02 0 8.54.01 11.28.23 2.72.22 4.29.64 5.47 1.24 2.54 1.29 4.61 3.36 5.9 5.9.6 1.19 1.02 2.75 1.24 5.47.17 2.14.22 4.74.23 8.16H-27.32c-2.01-8.04-9.29-14-17.95-14s-15.94 5.96-17.95 14H-45.5c.01-3.42.06-6.02.23-8.16zM9.5 0c0 5.25-4.25 9.5-9.5 9.5S-9.5 5.25-9.5 0-4.75-9.5 0-9.5 9.5-5.25 9.5 0m36 13.2c0 5.12 0 8.68-.23 11.46-.22 2.72-.64 4.29-1.24 5.47-1.29 2.54-3.36 4.61-5.9 5.9-1.19.6-2.75 1.02-5.47 1.24-2.78.23-6.34.23-11.46.23s-8.68 0-11.46-.23c-2.72-.22-4.28-.64-5.47-1.24-2.54-1.29-4.61-3.36-5.9-5.9-.6-1.19-1.02-2.75-1.24-5.47-.23-2.78-.23-6.34-.23-11.46v-8.7h27.55c2.01 8.04 9.29 14 17.95 14s15.94-5.96 17.95-14H45.5v8.7z" />
        </g>
      </g>
    </svg>
  );
}

export function TaskIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="20" height="20" fill="none" {...props}>
      <defs>
        <clipPath id="task-clip"><rect width="120" height="120" x="0" y="0" /></clipPath>
      </defs>
      <g clipPath="url(#task-clip)">
        <g transform="matrix(1,0,0,1,60,26)">
          <path stroke="currentColor" strokeWidth="9" d="M-24 0c0-3.72 0-5.58.41-7.11 1.11-4.14 4.34-7.37 8.48-8.48C-13.58-16-11.72-16-8-16h16c3.72 0 5.58 0 7.11.41 4.14 1.11 7.37 4.34 8.48 8.48.41 1.53.41 3.39.41 7.11s0 5.58-.41 7.11c-1.11 4.14-4.34 7.37-8.48 8.48C13.58 16 11.72 16 8 16H-8c-3.72 0-5.58 0-7.11-.41-4.14-1.11-7.37-4.34-8.48-8.48C-24 5.58-24 3.72-24 0z" />
        </g>
        <g transform="matrix(1,0,0,1,60,63)">
          <path stroke="currentColor" strokeWidth="9" strokeLinecap="round" d="M-27.06-43c-4.65 0-2.91 0-4.84.43-6.83 1.51-12.16 6.84-13.67 13.67-.43 1.93-.43 4.25-.43 8.9v34.2c0 10.08 0 15.12 1.96 18.97 1.73 3.39 4.48 6.14 7.87 7.87 3.85 1.96 8.89 1.96 18.97 1.96h34.4c10.08 0 15.12 0 18.97-1.96 3.39-1.73 6.14-4.48 7.87-7.87 1.96-3.85 1.96-8.89 1.96-18.97v-34.2c0-4.65 0-6.97-.43-8.9-1.51-6.83-6.84-12.16-13.67-13.67-1.92-.43-.53-.43-5.15-.43s-3.23 0-5.15.43c-6.83 1.51-12.16 6.84-13.67 13.67" />
        </g>
        <g transform="matrix(1,0,0,1,60.62,70.98)">
          <path stroke="currentColor" strokeWidth="9" strokeLinecap="round" d="M-16.62-2.47S-3.89 10.25-3.89 10.25 16.62-10.25 16.62-10.25l.13-.13" />
        </g>
      </g>
    </svg>
  );
}

export const siderIcons = {
  chat: ChatIcon,
  agent: AgentIcon,
  write: WriteIcon,
  notes: NoteIcon,
  tools: ToolsIcon,
  tasks: TaskIcon,
} as const;

export type SiderIconName = keyof typeof siderIcons;
