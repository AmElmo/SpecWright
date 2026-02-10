import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AI_TOOL_ORDER,
  AI_TOOL_NAMES,
  type AITool,
  useAIToolPreference
} from '@/lib/use-ai-tool';

type SplitButtonVariant = 'primary' | 'outline' | 'warning' | 'success';
type SplitButtonSize = 'sm' | 'md';

interface AIActionSplitButtonProps {
  label: string;
  onRun: (toolOverride?: AITool) => void | Promise<void>;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: SplitButtonVariant;
  size?: SplitButtonSize;
  className?: string;
}

const VARIANT_STYLES: Record<SplitButtonVariant, { main: string; arrow: string; menu: string; itemHover: string }> = {
  primary: {
    main: 'bg-[hsl(235,69%,61%)] text-white hover:bg-[hsl(235,69%,55%)]',
    arrow: 'bg-[hsl(235,69%,58%)] text-white hover:bg-[hsl(235,69%,52%)] border-l border-[hsl(235,69%,50%)]',
    menu: 'border-[hsl(235,30%,88%)]',
    itemHover: 'hover:bg-[hsl(235,69%,97%)]'
  },
  warning: {
    main: 'bg-[hsl(25,95%,53%)] text-white hover:bg-[hsl(25,95%,48%)]',
    arrow: 'bg-[hsl(25,95%,50%)] text-white hover:bg-[hsl(25,95%,45%)] border-l border-[hsl(25,95%,42%)]',
    menu: 'border-[hsl(25,30%,88%)]',
    itemHover: 'hover:bg-[hsl(25,95%,97%)]'
  },
  success: {
    main: 'bg-[hsl(142,76%,36%)] text-white hover:bg-[hsl(142,76%,32%)]',
    arrow: 'bg-[hsl(142,76%,33%)] text-white hover:bg-[hsl(142,76%,29%)] border-l border-[hsl(142,76%,27%)]',
    menu: 'border-[hsl(142,25%,86%)]',
    itemHover: 'hover:bg-[hsl(142,76%,97%)]'
  },
  outline: {
    main: 'bg-white text-[hsl(0,0%,32%)] border border-[hsl(0,0%,88%)] hover:bg-[hsl(0,0%,97%)]',
    arrow: 'bg-white text-[hsl(0,0%,32%)] border border-[hsl(0,0%,88%)] border-l-0 hover:bg-[hsl(0,0%,97%)]',
    menu: 'border-[hsl(0,0%,90%)]',
    itemHover: 'hover:bg-[hsl(0,0%,97%)]'
  }
};

const SIZE_STYLES: Record<SplitButtonSize, { main: string; arrow: string; menuText: string }> = {
  sm: {
    main: 'h-8 px-3 text-[12px]',
    arrow: 'h-8 w-8',
    menuText: 'text-[12px]'
  },
  md: {
    main: 'h-10 px-4 text-[13px]',
    arrow: 'h-10 w-9',
    menuText: 'text-[13px]'
  }
};

export function AIActionSplitButton({
  label,
  onRun,
  disabled = false,
  fullWidth = false,
  variant = 'primary',
  size = 'md',
  className
}: AIActionSplitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { tool: defaultTool, toolName: defaultToolName } = useAIToolPreference();

  const variantStyles = VARIANT_STYLES[variant];
  const sizeStyles = SIZE_STYLES[size];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }

    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const runWithDefault = () => {
    void onRun(undefined);
  };

  const runWithTool = (tool: AITool) => {
    setIsOpen(false);
    void onRun(tool);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-stretch', fullWidth && 'w-full', className)}
    >
      <button
        type="button"
        onClick={runWithDefault}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-l-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          fullWidth && 'flex-1',
          sizeStyles.main,
          variantStyles.main
        )}
      >
        {label}
      </button>
      <button
        type="button"
        aria-label="Choose AI tool"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-r-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          sizeStyles.arrow,
          variantStyles.arrow
        )}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-1 min-w-[220px] overflow-hidden rounded-md border bg-white shadow-lg',
            sizeStyles.menuText,
            variantStyles.menu,
            fullWidth ? 'left-0 right-0 top-full' : 'right-0 top-full'
          )}
        >
          <button
            type="button"
            className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-[hsl(0,0%,20%)]', variantStyles.itemHover)}
            onClick={() => {
              setIsOpen(false);
              runWithDefault();
            }}
          >
            <span>Default ({defaultToolName})</span>
            <span className="text-[10px] text-[hsl(0,0%,52%)]">Settings</span>
          </button>

          <div className="h-px bg-[hsl(0,0%,92%)]" />

          {AI_TOOL_ORDER.map((tool) => (
            <button
              key={tool}
              type="button"
              className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-[hsl(0,0%,20%)]', variantStyles.itemHover)}
              onClick={() => runWithTool(tool)}
            >
              <span>{AI_TOOL_NAMES[tool]}</span>
              {defaultTool === tool && <span className="text-[10px] text-[hsl(0,0%,52%)]">Default</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
