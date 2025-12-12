import { useState, useRef, useEffect } from 'react';

interface ProjectIcon {
  type: 'icon' | 'emoji';
  value: string;
  color?: string;
}

interface IconPickerProps {
  value?: ProjectIcon | null;
  onChange: (icon: ProjectIcon | null) => void;
  trigger?: React.ReactNode;
}

// Color palette (Linear-inspired)
const COLORS = [
  'hsl(0 0% 46%)',      // Gray
  'hsl(0 0% 60%)',      // Light gray
  'hsl(235 69% 61%)',   // Blue (primary)
  'hsl(190 90% 50%)',   // Cyan
  'hsl(142 76% 36%)',   // Green
  'hsl(44 100% 42%)',   // Yellow
  'hsl(25 95% 50%)',    // Orange
  'hsl(350 80% 55%)',   // Red-pink
  'hsl(0 84% 60%)',     // Red
  'hsl(280 60% 55%)',   // Purple (rainbow)
];

// Icons list (using simple names that map to SVGs)
const ICONS = [
  'cube', 'phone', 'grid', 'download', 'keyboard', 'triangle', 'layers', 'forward', 'copy', 'clock', 'lock', 'pen', 'list',
  'box', 'apple', 'android', 'file', 'chat', 'bulb', 'alert', 'database', 'desktop', 'window', '3d-box', 'bookmark',
  'play', 'adjust', 'camera', 'bell', 'mail', 'bucket', 'folder', 'home', 'photo', 'trash', 'github', 'chevron-down',
  'clipboard', 'megaphone', 'send', 'graduation', 'gift', 'lightning', 'plus', 'settings', 'call', 'users', 'airplane', 'shirt',
  'link', 'book', 'card', 'bank', 'dollar', 'euro', 'bitcoin', 'diamond', 'menu', 'cart', 'horse', 'star', 'moon',
  'chart', 'gallery', 'crown', 'plane', 'bike', 'car', 'rocket', 'anchor', 'globe', 'earth', 'browser', 'code',
  'shield', 'heart', 'pin', 'emoji-happy', 'emoji-sad', 'emoji-cool', 'thumbs-up', 'tv', 'skull', 'robot', 'wave', 'question',
  'sun', 'smile', 'cloud', 'tree', 'warning', 'cog', 'heart-fill', 'fire', 'horse-2', 'recycle',
  'nerd', 'mask', 'zap', 'sparkle', 'at', 'target', 'space', 'broadcast', 'tag', 'fingerprint',
  'accessibility', 'boot', 'moon-2', 'cut', 'font', 'add-circle', 'puzzle', 'figma', 'bike-2', 'rss',
];

// Emoji categories - project-relevant emojis (objects, symbols, tools)
const EMOJI_CATEGORIES = {
  'Frequently used': ['🚀', '⭐', '✨', '💡', '🎯', '✅', '📦', '🔧', '⚡', '🎨', '📊', '🔒', '🌟', '💎', '🏆', '📱', '💻', '🔥', '❤️', '👀', '🎉', '📝', '🔔', '⚙️'],
  'Objects': [
    '💻', '🖥️', '📱', '⌨️', '🖱️', '💾', '💿', '📀', '🎮', '🕹️', '📷', '📹', 
    '📺', '📻', '🎙️', '🎚️', '📞', '☎️', '📟', '📠', '🔋', '🔌', '💡', '🔦',
    '📦', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '📊', '📈',
    '📉', '📇', '📁', '📂', '🗂️', '🗃️', '🗄️', '🗑️', '🔒', '🔓', '🔑', '🗝️',
    '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🗡️', '⚔️', '🔧', '🔩', '⚙️', '🗜️', '⚖️',
    '🎁', '🎀', '🎈', '🎊', '🎉', '🏷️', '📌', '📍', '✂️', '📎', '🖇️', '📐',
  ],
  'Symbols': [
    '⭐', '🌟', '✨', '💫', '⚡', '🔥', '💥', '❤️', '🧡', '💛', '💚', '💙',
    '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💖', '💗', '💘', '💝', '💞',
    '✅', '❌', '❓', '❔', '❕', '❗', '⭕', '🔴', '🟠', '🟡', '🟢', '🔵',
    '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘',
    '🎯', '💎', '🔮', '🧿', '🏁', '🚩', '🎌', '🏴', '🏳️', '♻️', '⚜️', '🔱',
    '📛', '🔰', '⭕', '✳️', '❇️', '✴️', '💮', '🏵️', '🎖️', '🏅', '🥇', '🥈',
  ],
  'Nature': [
    '🌱', '🌿', '☘️', '🍀', '🌵', '🌴', '🌳', '🌲', '🪵', '🌾', '🌻', '🌼',
    '🌸', '💐', '🌹', '🥀', '🪻', '🪷', '🌺', '🌷', '🍁', '🍂', '🍃', '🪺',
    '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏖️',
    '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️',
    '🌪️', '🌫️', '🌈', '🌊', '💧', '💦', '☔', '⚡', '🔥', '🌙', '⭐', '🌟',
  ],
  'Activities': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓',
    '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
    '🎿', '🛷', '🥌', '🎯', '🪀', '🪁', '🎮', '🕹️', '🎲', '🧩', '♟️', '🎭',
    '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸',
    '🎻', '🪕', '🎪', '🎠', '🎡', '🎢', '🎰', '🏆', '🥇', '🥈', '🥉', '🏅',
  ],
  'Travel': [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚',
    '🚛', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️',
    '🛩️', '🛫', '🛬', '🚀', '🛰️', '🚢', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚂',
    '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚎',
    '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬',
    '🏭', '🏯', '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋',
  ],
  'Food': [
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭',
    '🍍', '🥥', '🥝', '🍅', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕',
    '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳',
    '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕',
    '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🍝', '🍜',
    '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸',
  ],
};

// Icon SVG components
const IconSVG = ({ name, color = 'currentColor' }: { name: string; color?: string }) => {
  const iconPaths: Record<string, JSX.Element> = {
    'cube': <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'phone': <><rect x="4" y="1" width="8" height="14" rx="1.5" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="8" cy="12.5" r="0.75" fill={color}/></>,
    'grid': <><rect x="2" y="2" width="5" height="5" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><rect x="9" y="2" width="5" height="5" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><rect x="2" y="9" width="5" height="5" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><rect x="9" y="9" width="5" height="5" rx="1" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'download': <><path d="M8 2V10M8 10L5 7M8 10L11 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'keyboard': <><rect x="1" y="4" width="14" height="8" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M4 10H12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="4" cy="7" r="0.75" fill={color}/><circle cx="8" cy="7" r="0.75" fill={color}/><circle cx="12" cy="7" r="0.75" fill={color}/></>,
    'triangle': <path d="M8 2L14 13H2L8 2Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'layers': <><path d="M8 1L14 4L8 7L2 4L8 1Z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M2 8L8 11L14 8" stroke={color} strokeWidth="1.5" fill="none"/><path d="M2 11L8 14L14 11" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'forward': <path d="M3 3L10 8L3 13" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    'copy': <><rect x="5" y="5" width="9" height="9" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M11 5V3C11 2.44772 10.5523 2 10 2H3C2.44772 2 2 2.44772 2 3V10C2 10.5523 2.44772 11 3 11H5" stroke={color} strokeWidth="1.5"/></>,
    'clock': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 4V8L10.5 10.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    'lock': <><rect x="3" y="7" width="10" height="7" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M5 7V5C5 3.34315 6.34315 2 8 2C9.65685 2 11 3.34315 11 5V7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'pen': <><path d="M11.5 2.5L13.5 4.5L5.5 12.5L2.5 13.5L3.5 10.5L11.5 2.5Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/></>,
    'list': <><path d="M5 4H14M5 8H14M5 12H14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="2" cy="4" r="1" fill={color}/><circle cx="2" cy="8" r="1" fill={color}/><circle cx="2" cy="12" r="1" fill={color}/></>,
    'box': <><path d="M2 5L8 2L14 5V11L8 14L2 11V5Z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 8V14" stroke={color} strokeWidth="1.5"/><path d="M2 5L8 8L14 5" stroke={color} strokeWidth="1.5"/></>,
    'apple': <path d="M8 3C6 1 3 2 3 5C3 8 5 11 8 14C11 11 13 8 13 5C13 2 10 1 8 3Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'android': <><rect x="3" y="7" width="10" height="6" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="5.5" cy="4" r="0.75" fill={color}/><circle cx="10.5" cy="4" r="0.75" fill={color}/><path d="M4 7V4C4 2.89543 4.89543 2 6 2H10C11.1046 2 12 2.89543 12 4V7" stroke={color} strokeWidth="1.5"/></>,
    'file': <><path d="M4 1H10L14 5V14C14 14.5523 13.5523 15 13 15H4C3.44772 15 3 14.5523 3 14V2C3 1.44772 3.44772 1 4 1Z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M10 1V5H14" stroke={color} strokeWidth="1.5"/></>,
    'chat': <><path d="M2 3C2 2.44772 2.44772 2 3 2H13C13.5523 2 14 2.44772 14 3V10C14 10.5523 13.5523 11 13 11H5L2 14V3Z" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'bulb': <><path d="M6 12H10M7 14H9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M5 9C5 11 6 11 6 12H10C10 11 11 11 11 9C11 6 9.5 5 8 5C6.5 5 5 6 5 9Z" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="8" cy="3" r="0.75" fill={color}/></>,
    'alert': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 5V9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill={color}/></>,
    'database': <><ellipse cx="8" cy="3" rx="5" ry="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M3 3V8C3 9.10457 5.23858 10 8 10C10.7614 10 13 9.10457 13 8V3" stroke={color} strokeWidth="1.5"/><path d="M3 8V13C3 14.1046 5.23858 15 8 15C10.7614 15 13 14.1046 13 13V8" stroke={color} strokeWidth="1.5"/></>,
    'desktop': <><rect x="2" y="2" width="12" height="9" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M5 14H11M8 11V14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'window': <><rect x="2" y="2" width="12" height="12" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M2 5H14" stroke={color} strokeWidth="1.5"/><circle cx="4" cy="3.5" r="0.5" fill={color}/><circle cx="6" cy="3.5" r="0.5" fill={color}/></>,
    '3d-box': <><path d="M8 1L14 4V12L8 15L2 12V4L8 1Z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 8V15" stroke={color} strokeWidth="1.5"/><path d="M2 4L8 8L14 4" stroke={color} strokeWidth="1.5"/></>,
    'bookmark': <path d="M4 2H12V14L8 11L4 14V2Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'play': <path d="M4 2L14 8L4 14V2Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'adjust': <><path d="M2 4H5M10 4H14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="7.5" cy="4" r="2.5" stroke={color} strokeWidth="1.5" fill="none"/><path d="M2 12H6M11 12H14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8.5" cy="12" r="2.5" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'camera': <><rect x="2" y="4" width="12" height="10" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="8" cy="9" r="3" stroke={color} strokeWidth="1.5" fill="none"/><path d="M6 4V3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V4" stroke={color} strokeWidth="1.5"/></>,
    'bell': <><path d="M8 2V1M8 2C5.5 2 4 4 4 6V10L2 12H14L12 10V6C12 4 10.5 2 8 2Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><path d="M6 12C6 13.1046 6.89543 14 8 14C9.10457 14 10 13.1046 10 12" stroke={color} strokeWidth="1.5"/></>,
    'mail': <><rect x="2" y="3" width="12" height="10" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M2 4L8 8L14 4" stroke={color} strokeWidth="1.5"/></>,
    'bucket': <><path d="M3 8L4 13C4 14 5 14 8 14C11 14 12 14 12 13L13 8" stroke={color} strokeWidth="1.5" fill="none"/><ellipse cx="8" cy="8" rx="5" ry="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M13 5L14 7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'folder': <path d="M2 4C2 3.44772 2.44772 3 3 3H6L8 5H13C13.5523 5 14 5.44772 14 6V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'home': <path d="M2 8L8 2L14 8V14H10V10H6V14H2V8Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'photo': <><rect x="2" y="3" width="12" height="10" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="5" cy="6" r="1.5" stroke={color} strokeWidth="1.5" fill="none"/><path d="M2 11L5 8L7 10L11 6L14 9" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/></>,
    'trash': <><path d="M3 5H13L12 14H4L3 5Z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M2 5H14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M6 5V3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V5" stroke={color} strokeWidth="1.5"/></>,
    'github': <path d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM5.5 14C5.5 12 5.5 11 6.5 10C4.5 10 3 9 3 7C3 6 3.5 5 4 4.5C4 4 3.5 3 4 2C5 2 6 3 6 3C6.5 3 7 2.5 8 2.5C9 2.5 9.5 3 10 3C10 3 11 2 12 2C12.5 3 12 4 12 4.5C12.5 5 13 6 13 7C13 9 11.5 10 9.5 10C10.5 11 10.5 12 10.5 14" stroke={color} strokeWidth="1.5" fill="none"/>,
    'chevron-down': <path d="M4 6L8 10L12 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
    'clipboard': <><rect x="4" y="3" width="8" height="11" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M6 3V2C6 1.44772 6.44772 1 7 1H9C9.55228 1 10 1.44772 10 2V3" stroke={color} strokeWidth="1.5"/></>,
    'megaphone': <><path d="M3 6H5L12 3V13L5 10H3C2.44772 10 2 9.55228 2 9V7C2 6.44772 2.44772 6 3 6Z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M5 10V12C5 13 6 14 7 14" stroke={color} strokeWidth="1.5"/></>,
    'send': <path d="M14 2L7 9M14 2L10 14L7 9M14 2L2 6L7 9" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'graduation': <><path d="M8 3L1 6L8 9L15 6L8 3Z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M4 7.5V11C4 12 6 13 8 13C10 13 12 12 12 11V7.5" stroke={color} strokeWidth="1.5"/></>,
    'gift': <><rect x="2" y="6" width="12" height="8" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 6V14" stroke={color} strokeWidth="1.5"/><path d="M2 9H14" stroke={color} strokeWidth="1.5"/><path d="M8 6C8 4 6 2 5 3C4 4 5 6 8 6C8 4 10 2 11 3C12 4 11 6 8 6Z" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'lightning': <path d="M9 1L3 9H8L7 15L13 7H8L9 1Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'plus': <path d="M8 3V13M3 8H13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>,
    'settings': <><circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 1V3M8 13V15M1 8H3M13 8H15M3 3L4.5 4.5M11.5 11.5L13 13M3 13L4.5 11.5M11.5 4.5L13 3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'call': <path d="M3 2C3 2 2 4 2 6C2 10 6 14 10 14C12 14 14 13 14 13L12 10L10 11C8 10 6 8 5 6L6 4L3 2Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'users': <><circle cx="6" cy="5" r="2.5" stroke={color} strokeWidth="1.5" fill="none"/><path d="M1 14C1 11.2386 3.23858 9 6 9C8.76142 9 11 11.2386 11 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="11" cy="5" r="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M12 9C13.6569 9.5 15 11 15 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'airplane': <path d="M8 1L10 6H14L10 9L11 14L8 11L5 14L6 9L2 6H6L8 1Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'shirt': <path d="M5 2L3 4L5 6V14H11V6L13 4L11 2H9C9 3.10457 8.55228 4 8 4C7.44772 4 7 3.10457 7 2H5Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'link': <><path d="M6 10L10 6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M7 5L9 3C10.6569 1.34315 13.3431 1.34315 15 3V3C16.6569 4.65685 16.6569 7.34315 15 9L13 11" stroke={color} strokeWidth="1.5" strokeLinecap="round" transform="translate(-3, -1)"/><path d="M9 11L7 13C5.34315 14.6569 2.65685 14.6569 1 13V13C-0.656854 11.3431 -0.656854 8.65685 1 7L3 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" transform="translate(3, 1)"/></>,
    'book': <><path d="M2 3C2 2 3 2 4 2H7C8 2 8 3 8 3V14C8 14 8 13 7 13H4C3 13 2 13 2 14V3Z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M14 3C14 2 13 2 12 2H9C8 2 8 3 8 3V14C8 14 8 13 9 13H12C13 13 14 13 14 14V3Z" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'card': <><rect x="1" y="3" width="14" height="10" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M1 6H15" stroke={color} strokeWidth="1.5"/></>,
    'bank': <><path d="M2 6L8 2L14 6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M3 6V12H13V6" stroke={color} strokeWidth="1.5"/><path d="M2 12H14V14H2V12Z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M5 6V12M8 6V12M11 6V12" stroke={color} strokeWidth="1.5"/></>,
    'dollar': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 4V12M6 6C6 5 7 5 8 5C9 5 10 5.5 10 6.5C10 7.5 9 8 8 8C7 8 6 8.5 6 9.5C6 10.5 7 11 8 11C9 11 10 11 10 10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'euro': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M11 5C10 4 9 4 8 4C6 4 5 6 5 8C5 10 6 12 8 12C9 12 10 12 11 11" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M4 7H9M4 9H9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'bitcoin': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M6 4V12M6 6H9C10 6 11 6.5 11 7.5C11 8.5 10 9 9 9H6M6 9H9.5C10.5 9 11.5 9.5 11.5 10.5C11.5 11.5 10.5 12 9.5 12H6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'diamond': <path d="M8 2L14 7L8 14L2 7L8 2Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'menu': <path d="M2 4H14M2 8H14M2 12H14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>,
    'cart': <><path d="M1 1H3L4 10H13L15 3H5" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="5" cy="13" r="1.5" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="12" cy="13" r="1.5" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'horse': <path d="M4 14C4 11 5 9 7 8C5 7 4 5 4 3L6 2C7 3 8 3 10 3L12 2V5C14 6 14 9 14 11C14 13 13 14 12 14M8 8V11" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    'star': <path d="M8 1L10 6H15L11 9L12 14L8 11L4 14L5 9L1 6H6L8 1Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'moon': <path d="M12 3C8 3 5 6 5 10C5 12 6 14 8 15C4 15 1 12 1 8C1 4 4 1 8 1C10 1 11 2 12 3Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'chart': <><rect x="2" y="2" width="12" height="12" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M5 10V8M8 10V6M11 10V4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'gallery': <><rect x="2" y="4" width="12" height="10" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><rect x="4" y="2" width="8" height="2" rx="0.5" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'crown': <path d="M2 12L3 5L6 8L8 4L10 8L13 5L14 12H2Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'plane': <path d="M8 1L6 5L2 6L5 8L4 14L8 11L12 14L11 8L14 6L10 5L8 1Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'bike': <><circle cx="4" cy="10" r="3" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="12" cy="10" r="3" stroke={color} strokeWidth="1.5" fill="none"/><path d="M4 10L7 5H10L12 10M7 5V10H10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    'car': <><path d="M3 8L4 5C4 4 5 4 6 4H10C11 4 12 4 12 5L13 8" stroke={color} strokeWidth="1.5" fill="none"/><rect x="2" y="8" width="12" height="5" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="5" cy="13" r="1" fill={color}/><circle cx="11" cy="13" r="1" fill={color}/></>,
    'rocket': <><path d="M8 14L6 11L8 2L10 11L8 14Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><path d="M6 11L3 13L5 10" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><path d="M10 11L13 13L11 10" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><circle cx="8" cy="6" r="1.5" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'anchor': <><circle cx="8" cy="3" r="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 5V14M4 10C2 10 2 14 8 14C14 14 14 10 12 10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M5 8H11" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'globe': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><ellipse cx="8" cy="8" rx="3" ry="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M2 8H14" stroke={color} strokeWidth="1.5"/></>,
    'earth': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M3 5C4 6 5 6 6 5C7 4 8 5 8 6C8 7 7 8 8 9C9 10 10 9 11 10C12 11 11 13 10 13" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'browser': <><rect x="2" y="2" width="12" height="12" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M2 5H14" stroke={color} strokeWidth="1.5"/><circle cx="4" cy="3.5" r="0.5" fill={color}/><circle cx="6" cy="3.5" r="0.5" fill={color}/><circle cx="8" cy="3.5" r="0.5" fill={color}/></>,
    'code': <path d="M5 4L1 8L5 12M11 4L15 8L11 12M9 2L7 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
    'shield': <path d="M8 1L2 3V7C2 11 8 15 8 15C8 15 14 11 14 7V3L8 1Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'heart': <path d="M8 4C6 1 2 2 2 6C2 10 8 14 8 14C8 14 14 10 14 6C14 2 10 1 8 4Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'pin': <><circle cx="8" cy="6" r="3" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 9V15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'emoji-happy': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="6" cy="6" r="0.75" fill={color}/><circle cx="10" cy="6" r="0.75" fill={color}/><path d="M5 9C5.5 11 6.5 11.5 8 11.5C9.5 11.5 10.5 11 11 9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'emoji-sad': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="6" cy="6" r="0.75" fill={color}/><circle cx="10" cy="6" r="0.75" fill={color}/><path d="M5 11C5.5 10 6.5 9.5 8 9.5C9.5 9.5 10.5 10 11 11" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'emoji-cool': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M4 6H7M9 6H12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M5 10C6 11 7 11 8 11C9 11 10 11 11 10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'thumbs-up': <path d="M5 7V14H3C2.44772 14 2 13.5523 2 13V8C2 7.44772 2.44772 7 3 7H5ZM5 7L7 7C8 7 8 6 8 5V3C8 2 9 2 10 2C11 2 11 3 11 4V7H13C13.5523 7 14 7.44772 14 8V9L12 14H6C5.44772 14 5 13.5523 5 13V7Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'tv': <><rect x="2" y="2" width="12" height="9" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M5 14H11" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'skull': <><circle cx="8" cy="7" r="5" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="6" cy="6" r="1.5" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="10" cy="6" r="1.5" stroke={color} strokeWidth="1.5" fill="none"/><path d="M6 12V14M8 12V14M10 12V14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M7 10H9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'robot': <><rect x="3" y="5" width="10" height="8" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="6" cy="9" r="1.5" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="10" cy="9" r="1.5" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 2V5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="2" r="1" fill={color}/><path d="M1 8V10M15 8V10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'wave': <path d="M1 8C2 6 3 6 4 8C5 10 6 10 7 8C8 6 9 6 10 8C11 10 12 10 13 8C14 6 15 6 16 8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>,
    'question': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M6 6C6 5 7 4 8 4C9 4 10 5 10 6C10 7 9 7.5 8 8V9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill={color}/></>,
    'sun': <><circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 1V3M8 13V15M1 8H3M13 8H15M3 3L4.5 4.5M11.5 11.5L13 13M3 13L4.5 11.5M11.5 4.5L13 3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'smile': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M5 6H5.01M11 6H11.01" stroke={color} strokeWidth="2" strokeLinecap="round"/><path d="M5 10C6 11 7 11.5 8 11.5C9 11.5 10 11 11 10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'cloud': <path d="M4 12H12C14 12 15 11 15 9C15 7 14 6 12 6C12 4 11 2 8 2C5 2 4 4 4 6C2 6 1 7 1 9C1 11 2 12 4 12Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'tree': <><path d="M8 5L12 10H10L13 14H3L6 10H4L8 5Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><path d="M8 2V5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'warning': <><path d="M8 1L15 14H1L8 1Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><path d="M8 6V9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.75" fill={color}/></>,
    'cog': <><circle cx="8" cy="8" r="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 1V3M8 13V15M1 8H3M13 8H15M2.5 2.5L4 4M12 12L13.5 13.5M2.5 13.5L4 12M12 4L13.5 2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'heart-fill': <path d="M8 4C6 1 2 2 2 6C2 10 8 14 8 14C8 14 14 10 14 6C14 2 10 1 8 4Z" fill={color}/>,
    'fire': <path d="M8 1C8 1 4 4 4 8C4 12 6 14 8 14C10 14 12 12 12 8C12 4 8 1 8 1ZM8 11C7 11 6 10 6 9C6 8 7 7 8 7C9 7 10 8 10 9C10 10 9 11 8 11Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'horse-2': <path d="M3 14C3 11 4 9 6 8L6 7C4 6 3 4 4 2L7 3C8 4 10 4 12 3L12 6C14 7 14 10 14 12L11 14M8 8V11" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    'recycle': <path d="M8 2L11 7H5L8 2ZM5 7L2 12H8M11 7L14 12H8" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    'nerd': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="5.5" cy="7" r="2" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="10.5" cy="7" r="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M7.5 7H8.5" stroke={color} strokeWidth="1.5"/><path d="M6 11H10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'mask': <path d="M2 6C2 4 4 3 8 3C12 3 14 4 14 6V9C14 12 11 14 8 14C5 14 2 12 2 9V6ZM5 8V9M11 8V9" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"/>,
    'zap': <path d="M9 1L3 9H8L7 15L13 7H8L9 1Z" fill={color}/>,
    'sparkle': <path d="M8 1L9 5L13 6L9 7L8 11L7 7L3 6L7 5L8 1Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'at': <><circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.5" fill="none"/><path d="M11 8V9C11 10.1046 11.8954 11 13 11C14.1046 11 15 10.1046 15 9V8C15 4.13401 11.866 1 8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'target': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="8" cy="8" r="1" fill={color}/></>,
    'space': <path d="M2 10C2 8 4 8 8 8C12 8 14 8 14 10V12C14 13 13 14 12 14H4C3 14 2 13 2 12V10Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'broadcast': <><circle cx="8" cy="8" r="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M5 5C4 6 3.5 7 3.5 8C3.5 9 4 10 5 11M11 5C12 6 12.5 7 12.5 8C12.5 9 12 10 11 11M3 3C1.5 4.5 1 6 1 8C1 10 1.5 11.5 3 13M13 3C14.5 4.5 15 6 15 8C15 10 14.5 11.5 13 13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'tag': <path d="M2 2H8L14 8L8 14L2 8V2ZM5 5H5.01" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    'fingerprint': <path d="M8 2C5 2 3 4 3 7V9M8 2C11 2 13 4 13 7V11M5 7C5 5.5 6.5 4 8 4C9.5 4 11 5.5 11 7V10M7 7V12M9 7V14" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"/>,
    'accessibility': <><circle cx="8" cy="3" r="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M4 7H12M8 7V10M6 14L8 10L10 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    'boot': <path d="M5 2H9V7L12 8V14H4V8L5 7V2Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'moon-2': <path d="M10 2C6 2 3 5 3 9C3 13 6 15 10 15C13 15 15 13 15 10C12 11 9 9 9 6C9 4 10 2 10 2Z" stroke={color} strokeWidth="1.5" fill="none"/>,
    'cut': <><circle cx="5" cy="12" r="2" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="11" cy="12" r="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M5 10L11 2M11 10L5 2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'font': <path d="M3 14L8 2L13 14M5 10H11" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
    'add-circle': <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 5V11M5 8H11" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    'puzzle': <path d="M3 5H6V3C6 2 7 1 8 1C9 1 10 2 10 3V5H13V8H15C15 9 14 10 13 10C12 10 11 9 11 8H13V11H10V13C10 14 9 15 8 15C7 15 6 14 6 13V11H3V8H1C1 7 2 6 3 6C4 6 5 7 5 8H3V5Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    'figma': <><circle cx="8" cy="8" r="2" stroke={color} strokeWidth="1.5" fill="none"/><rect x="4" y="2" width="4" height="4" rx="2" stroke={color} strokeWidth="1.5" fill="none"/><rect x="8" y="2" width="4" height="4" rx="2" stroke={color} strokeWidth="1.5" fill="none"/><rect x="4" y="6" width="4" height="4" rx="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M4 12C4 10.8954 4.89543 10 6 10C7.10457 10 8 10.8954 8 12V14H6C4.89543 14 4 13.1046 4 12Z" stroke={color} strokeWidth="1.5" fill="none"/></>,
    'bike-2': <><circle cx="4" cy="11" r="2.5" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="12" cy="11" r="2.5" stroke={color} strokeWidth="1.5" fill="none"/><path d="M4 11L6 6H9M9 6L10 8L12 11M9 6L8 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    'rss': <><path d="M3 3C10 3 13 6 13 13" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M3 7C7 7 9 9 9 13" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="4" cy="12" r="1.5" fill={color}/></>,
  };

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {iconPaths[name] || iconPaths['cube']}
    </svg>
  );
};

export function IconPicker({ value, onChange, trigger }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'icons' | 'emojis'>('icons');
  const [selectedColor, setSelectedColor] = useState(value?.color || COLORS[2]);
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectIcon = (iconName: string) => {
    onChange({ type: 'icon', value: iconName, color: selectedColor });
    setIsOpen(false);
  };

  const handleSelectEmoji = (emoji: string) => {
    onChange({ type: 'emoji', value: emoji });
    setIsOpen(false);
  };

  const handleColorChange = (color: string) => {
    // Only update the preview color, don't save yet
    // The color will be applied when the user clicks on an icon
    setSelectedColor(color);
  };

  const filteredIcons = searchQuery
    ? ICONS.filter(icon => icon.toLowerCase().includes(searchQuery.toLowerCase()))
    : ICONS;

  const filteredEmojis: Record<string, string[]> = {};
  Object.entries(EMOJI_CATEGORIES).forEach(([category, emojis]) => {
    if (searchQuery) {
      // For emoji search, we can't really filter by name, so show all on search
      filteredEmojis[category] = emojis;
    } else {
      filteredEmojis[category] = emojis;
    }
  });

  // Default trigger if none provided
  const defaultTrigger = (
    <div
      className="w-8 h-8 rounded-md flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-offset-1"
      style={{ 
        backgroundColor: value?.type === 'icon' ? value.color || COLORS[2] : 'hsl(235 69% 97%)',
        color: value?.type === 'icon' ? 'white' : undefined,
        border: '1px solid hsl(0 0% 90%)',
      }}
    >
      {value?.type === 'emoji' ? (
        <span className="text-[16px]">{value.value}</span>
      ) : value?.type === 'icon' ? (
        <IconSVG name={value.value} color="white" />
      ) : (
        <span className="text-[14px] font-semibold" style={{ color: 'hsl(0 0% 60%)' }}>?</span>
      )}
    </div>
  );

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="focus:outline-none"
      >
        {trigger || defaultTrigger}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 mt-2 rounded-lg overflow-hidden z-50"
          style={{
            backgroundColor: 'white',
            boxShadow: '0 10px 40px -5px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            width: '320px',
          }}
        >
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
            <button
              onClick={() => setActiveTab('icons')}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium transition-colors"
              style={{
                color: activeTab === 'icons' ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                borderBottom: activeTab === 'icons' ? '2px solid hsl(235 69% 61%)' : '2px solid transparent',
              }}
            >
              Icons
            </button>
            <button
              onClick={() => setActiveTab('emojis')}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium transition-colors"
              style={{
                color: activeTab === 'emojis' ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                borderBottom: activeTab === 'emojis' ? '2px solid hsl(235 69% 61%)' : '2px solid transparent',
              }}
            >
              Emojis
            </button>
          </div>

          {/* Color Palette (only for icons) */}
          {activeTab === 'icons' && (
            <div className="px-4 py-3 flex gap-2 justify-center border-b" style={{ borderColor: 'hsl(0 0% 94%)' }}>
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className="w-7 h-7 rounded-full transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: color,
                    boxShadow: selectedColor === color ? '0 0 0 2px white, 0 0 0 4px ' + color : 'none',
                  }}
                >
                  {selectedColor === color && (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8L6.5 11.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="px-3 py-2">
            <input
              type="text"
              placeholder={activeTab === 'icons' ? 'Search icons...' : 'Search emoji...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-[13px] rounded-md outline-none"
              style={{
                backgroundColor: 'hsl(0 0% 96%)',
                border: '1px solid hsl(0 0% 90%)',
              }}
            />
          </div>

          {/* Content */}
          <div 
            className="overflow-y-auto px-3 pb-3"
            style={{ maxHeight: '280px' }}
          >
            {activeTab === 'icons' ? (
              <div className="grid grid-cols-9 gap-1">
                {filteredIcons.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => handleSelectIcon(icon)}
                    className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-slate-100"
                    title={icon}
                  >
                    {/* Preview icon in the selected color */}
                    <IconSVG name={icon} color={selectedColor} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(filteredEmojis).map(([category, emojis]) => (
                  <div key={category}>
                    <h4 
                      className="text-[11px] font-medium mb-2 px-1"
                      style={{ color: 'hsl(0 0% 46%)' }}
                    >
                      {category}
                    </h4>
                    <div className="grid grid-cols-9 gap-1">
                      {emojis.map((emoji, idx) => (
                        <button
                          key={`${emoji}-${idx}`}
                          onClick={() => handleSelectEmoji(emoji)}
                          className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-slate-100 text-[18px]"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export the IconSVG component for use in other components
export { IconSVG };

