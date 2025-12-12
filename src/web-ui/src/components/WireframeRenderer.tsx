import React from 'react';

/**
 * WireframeRenderer - Renders a visual wireframe from JSON structure
 * 
 * This component takes a stack-based wireframe definition and renders it
 * as a visual wireframe with gray styling to match typical wireframe aesthetics.
 */

// Types for wireframe elements
export interface WireframeElement {
  type: string;
  // Layout props
  direction?: 'vertical' | 'horizontal';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  // Size props
  width?: 'auto' | 'full' | string;
  height?: string;
  flex?: number | string;
  // Content props
  text?: string;
  label?: string;
  placeholder?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success';
  icon?: string;
  src?: string;
  // Input props
  inputType?: 'text' | 'email' | 'password' | 'number' | 'search';
  // List/table props
  items?: string[] | WireframeElement[];
  columns?: number;
  rows?: number;
  headers?: string[];
  // Nested children
  children?: WireframeElement[];
  // Styling
  color?: 'default' | 'muted' | 'accent' | 'link' | 'error' | 'success';
  fullWidth?: boolean;
  // Tab-specific
  tabs?: string[];
  activeTab?: number;
}

// Gap size mapping
const gapSizes: Record<string, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6',
};

// Padding size mapping
const paddingSizes: Record<string, string> = {
  none: 'p-0',
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

// Text size mapping
const textSizes: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};

// Color mapping (wireframe grayscale palette)
const colorClasses: Record<string, string> = {
  default: 'text-gray-700',
  muted: 'text-gray-400',
  accent: 'text-gray-900 font-medium',
  link: 'text-blue-600 underline',
  error: 'text-red-500',
  success: 'text-green-600',
};

interface WireframeRendererProps {
  element: WireframeElement;
  className?: string;
}

export function WireframeRenderer({ element, className = '' }: WireframeRendererProps) {
  const renderElement = (el: WireframeElement, key?: string | number): React.ReactNode => {
    const commonProps = {
      key: key?.toString(),
    };

    switch (el.type) {
      // ============ LAYOUT COMPONENTS ============
      case 'stack':
      case 'column':
        return (
          <div
            {...commonProps}
            className={`flex flex-col ${gapSizes[el.gap || 'md']} ${paddingSizes[el.padding || 'none']} ${
              el.align === 'center' ? 'items-center' : 
              el.align === 'end' ? 'items-end' : 
              el.align === 'stretch' ? 'items-stretch' : 'items-start'
            } ${el.width === 'full' ? 'w-full' : ''}`}
          >
            {el.children?.map((child, i) => renderElement(child, i))}
          </div>
        );

      case 'row':
        return (
          <div
            {...commonProps}
            className={`flex flex-row ${gapSizes[el.gap || 'md']} ${paddingSizes[el.padding || 'none']} ${
              el.align === 'center' ? 'items-center' : 
              el.align === 'end' ? 'items-end' : 
              el.align === 'stretch' ? 'items-stretch' : 'items-start'
            } ${
              el.justify === 'center' ? 'justify-center' :
              el.justify === 'end' ? 'justify-end' :
              el.justify === 'between' ? 'justify-between' :
              el.justify === 'around' ? 'justify-around' : 'justify-start'
            } ${el.width === 'full' ? 'w-full' : ''}`}
          >
            {el.children?.map((child, i) => renderElement(child, i))}
          </div>
        );

      case 'grid':
        return (
          <div
            {...commonProps}
            className={`grid grid-cols-${el.columns || 2} ${gapSizes[el.gap || 'md']} ${paddingSizes[el.padding || 'none']} w-full`}
            style={{ gridTemplateColumns: `repeat(${el.columns || 2}, minmax(0, 1fr))` }}
          >
            {el.children?.map((child, i) => renderElement(child, i))}
          </div>
        );

      case 'card':
        return (
          <div
            {...commonProps}
            className={`border-2 border-gray-300 rounded-lg bg-white ${paddingSizes[el.padding || 'md']} ${el.width === 'full' ? 'w-full' : ''}`}
          >
            {el.children?.map((child, i) => renderElement(child, i))}
          </div>
        );

      case 'section':
        return (
          <div
            {...commonProps}
            className={`border-b border-gray-200 ${paddingSizes[el.padding || 'md']} ${el.width === 'full' ? 'w-full' : ''}`}
          >
            {el.text && <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">{el.text}</div>}
            {el.children?.map((child, i) => renderElement(child, i))}
          </div>
        );

      // ============ TYPOGRAPHY ============
      case 'heading':
        const headingSize = el.size || 'lg';
        return (
          <div
            {...commonProps}
            className={`font-bold text-gray-800 ${
              headingSize === '2xl' ? 'text-2xl' :
              headingSize === 'xl' ? 'text-xl' :
              headingSize === 'lg' ? 'text-lg' :
              headingSize === 'md' ? 'text-base font-semibold' :
              'text-sm font-semibold'
            }`}
          >
            {el.text || 'Heading'}
          </div>
        );

      case 'text':
        return (
          <div
            {...commonProps}
            className={`${textSizes[el.size || 'md']} ${colorClasses[el.color || 'default']}`}
          >
            {el.text || 'Text content'}
          </div>
        );

      case 'label':
        return (
          <label {...commonProps} className="text-sm font-medium text-gray-600">
            {el.text || 'Label'}
          </label>
        );

      // ============ INPUTS ============
      case 'input':
        return (
          <div {...commonProps} className={`${el.fullWidth || el.width === 'full' ? 'w-full' : 'w-64'}`}>
            {el.label && <div className="text-sm font-medium text-gray-600 mb-1">{el.label}</div>}
            <div className="border-2 border-gray-300 rounded-md h-10 px-3 flex items-center bg-gray-50">
              <span className="text-gray-400 text-sm">{el.placeholder || 'Enter text...'}</span>
            </div>
          </div>
        );

      case 'textarea':
        return (
          <div {...commonProps} className={`${el.fullWidth || el.width === 'full' ? 'w-full' : 'w-64'}`}>
            {el.label && <div className="text-sm font-medium text-gray-600 mb-1">{el.label}</div>}
            <div className="border-2 border-gray-300 rounded-md h-24 px-3 py-2 bg-gray-50">
              <span className="text-gray-400 text-sm">{el.placeholder || 'Enter text...'}</span>
            </div>
          </div>
        );

      case 'select':
        return (
          <div {...commonProps} className={`${el.fullWidth || el.width === 'full' ? 'w-full' : 'w-64'}`}>
            {el.label && <div className="text-sm font-medium text-gray-600 mb-1">{el.label}</div>}
            <div className="border-2 border-gray-300 rounded-md h-10 px-3 flex items-center justify-between bg-gray-50">
              <span className="text-gray-400 text-sm">{el.placeholder || 'Select...'}</span>
              <span className="text-gray-400">▼</span>
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div {...commonProps} className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-gray-400 rounded bg-white flex items-center justify-center">
              <span className="text-gray-400 text-xs">✓</span>
            </div>
            <span className="text-sm text-gray-700">{el.label || el.text || 'Checkbox'}</span>
          </div>
        );

      case 'toggle':
        return (
          <div {...commonProps} className="flex items-center gap-2">
            <div className="w-10 h-6 border-2 border-gray-400 rounded-full bg-gray-200 flex items-center px-0.5">
              <div className="w-4 h-4 rounded-full bg-gray-400"></div>
            </div>
            {el.label && <span className="text-sm text-gray-700">{el.label}</span>}
          </div>
        );

      case 'radio':
        return (
          <div {...commonProps} className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-gray-400 rounded-full bg-white flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            </div>
            <span className="text-sm text-gray-700">{el.label || el.text || 'Radio'}</span>
          </div>
        );

      // ============ ACTIONS ============
      case 'button':
        const buttonVariant = el.variant || 'primary';
        const buttonClasses = {
          primary: 'bg-gray-700 text-white border-gray-700',
          secondary: 'bg-gray-200 text-gray-700 border-gray-300',
          outline: 'bg-white text-gray-700 border-gray-400',
          ghost: 'bg-transparent text-gray-600 border-transparent',
          destructive: 'bg-gray-600 text-white border-gray-600',
          success: 'bg-gray-500 text-white border-gray-500',
        };
        return (
          <button
            {...commonProps}
            className={`${buttonClasses[buttonVariant]} border-2 rounded-md px-4 py-2 text-sm font-medium ${
              el.fullWidth || el.width === 'full' ? 'w-full' : ''
            } flex items-center justify-center gap-2`}
          >
            {el.icon && <span>{el.icon}</span>}
            {el.text || 'Button'}
          </button>
        );

      case 'link':
        return (
          <span {...commonProps} className="text-blue-600 underline text-sm cursor-pointer">
            {el.text || 'Link'}
          </span>
        );

      case 'icon-button':
        return (
          <button
            {...commonProps}
            className="w-10 h-10 border-2 border-gray-300 rounded-md flex items-center justify-center bg-white hover:bg-gray-50"
          >
            <span className="text-gray-500">{el.icon || '⋯'}</span>
          </button>
        );

      // ============ MEDIA ============
      case 'image':
        return (
          <div
            {...commonProps}
            className={`border-2 border-gray-300 border-dashed rounded-lg bg-gray-100 flex items-center justify-center ${
              el.width === 'full' ? 'w-full' : 'w-48'
            }`}
            style={{ height: el.height || '120px' }}
          >
            <div className="text-center text-gray-400">
              <div className="text-3xl mb-1">🖼️</div>
              <div className="text-xs">{el.text || 'Image'}</div>
            </div>
          </div>
        );

      case 'avatar':
        const avatarSize = el.size === 'lg' ? 'w-16 h-16' : el.size === 'sm' ? 'w-8 h-8' : 'w-12 h-12';
        return (
          <div
            {...commonProps}
            className={`${avatarSize} rounded-full bg-gray-300 flex items-center justify-center text-gray-500 border-2 border-gray-400`}
          >
            <span>{el.text || '👤'}</span>
          </div>
        );

      case 'icon':
        return (
          <div
            {...commonProps}
            className="w-6 h-6 flex items-center justify-center text-gray-500"
          >
            {el.icon || el.text || '●'}
          </div>
        );

      // ============ NAVIGATION ============
      case 'nav':
        return (
          <div
            {...commonProps}
            className="w-full border-b-2 border-gray-300 bg-gray-100 px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-400 rounded"></div>
              <span className="font-medium text-gray-700">{el.text || 'Navigation'}</span>
            </div>
            {el.children && (
              <div className="flex items-center gap-4">
                {el.children.map((child, i) => renderElement(child, i))}
              </div>
            )}
          </div>
        );

      case 'tabs':
        return (
          <div {...commonProps} className="w-full">
            <div className="flex border-b-2 border-gray-300">
              {(el.tabs || ['Tab 1', 'Tab 2', 'Tab 3']).map((tab, i) => (
                <div
                  key={i}
                  className={`px-4 py-2 text-sm ${
                    i === (el.activeTab || 0)
                      ? 'border-b-2 border-gray-700 text-gray-800 font-medium -mb-0.5'
                      : 'text-gray-500'
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>
            {el.children?.map((child, i) => renderElement(child, i))}
          </div>
        );

      case 'breadcrumb':
        return (
          <div {...commonProps} className="flex items-center gap-2 text-sm">
            {(el.items as string[] || ['Home', 'Page', 'Current']).map((item, i, arr) => (
              <React.Fragment key={i}>
                <span className={i === arr.length - 1 ? 'text-gray-800' : 'text-gray-500'}>
                  {item}
                </span>
                {i < arr.length - 1 && <span className="text-gray-400">/</span>}
              </React.Fragment>
            ))}
          </div>
        );

      case 'sidebar':
        return (
          <div
            {...commonProps}
            className="w-56 border-r-2 border-gray-300 bg-gray-50 p-4 flex flex-col gap-2"
          >
            {el.children?.map((child, i) => renderElement(child, i))}
          </div>
        );

      // ============ FEEDBACK ============
      case 'alert':
        const alertVariant = el.variant || 'default';
        const alertColors = {
          default: 'bg-gray-100 border-gray-300 text-gray-700',
          destructive: 'bg-red-50 border-red-200 text-red-700',
          success: 'bg-green-50 border-green-200 text-green-700',
        };
        return (
          <div
            {...commonProps}
            className={`${alertColors[alertVariant as keyof typeof alertColors] || alertColors.default} border-2 rounded-md p-3 text-sm w-full`}
          >
            {el.text || 'Alert message'}
          </div>
        );

      case 'badge':
        return (
          <span
            {...commonProps}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 border border-gray-300"
          >
            {el.text || 'Badge'}
          </span>
        );

      case 'progress':
        return (
          <div {...commonProps} className="w-full">
            {el.label && <div className="text-sm text-gray-600 mb-1">{el.label}</div>}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gray-500 rounded-full" style={{ width: '60%' }}></div>
            </div>
          </div>
        );

      case 'skeleton':
        return (
          <div
            {...commonProps}
            className="bg-gray-200 rounded animate-pulse"
            style={{ 
              width: el.width || '100%', 
              height: el.height || '20px' 
            }}
          ></div>
        );

      // ============ STRUCTURE ============
      case 'divider':
        return (
          <div {...commonProps} className="w-full flex items-center gap-3 py-2">
            <div className="flex-1 border-t-2 border-gray-300"></div>
            {el.text && <span className="text-xs text-gray-400">{el.text}</span>}
            <div className="flex-1 border-t-2 border-gray-300"></div>
          </div>
        );

      case 'spacer':
        const spacerSizes: Record<string, string> = {
          xs: 'h-1',
          sm: 'h-2',
          md: 'h-4',
          lg: 'h-8',
          xl: 'h-12',
        };
        return (
          <div
            {...commonProps}
            className={el.flex ? 'flex-1' : spacerSizes[el.size || 'md']}
          ></div>
        );

      case 'list':
        return (
          <div {...commonProps} className={`flex flex-col ${gapSizes[el.gap || 'sm']} w-full`}>
            {el.items && Array.isArray(el.items) && el.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border border-gray-200 rounded bg-white">
                {typeof item === 'string' ? (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-700">{item}</span>
                  </>
                ) : (
                  renderElement(item as WireframeElement, i)
                )}
              </div>
            ))}
            {el.children?.map((child, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border border-gray-200 rounded bg-white">
                {renderElement(child, i)}
              </div>
            ))}
          </div>
        );

      case 'table':
        const tableRows = el.rows || 3;
        const tableCols = el.columns || 3;
        const tableHeaders = el.headers || Array(tableCols).fill(null).map((_, i) => `Column ${i + 1}`);
        return (
          <div {...commonProps} className="w-full border-2 border-gray-300 rounded-lg overflow-hidden">
            <div className="grid bg-gray-100 border-b-2 border-gray-300" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)` }}>
              {tableHeaders.map((header, i) => (
                <div key={i} className="px-3 py-2 text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
                  {header}
                </div>
              ))}
            </div>
            {Array(tableRows).fill(null).map((_, rowIndex) => (
              <div key={rowIndex} className="grid border-b border-gray-200 last:border-b-0" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)` }}>
                {Array(tableCols).fill(null).map((_, colIndex) => (
                  <div key={colIndex} className="px-3 py-2 text-sm text-gray-600 border-r border-gray-200 last:border-r-0">
                    Cell {rowIndex + 1}-{colIndex + 1}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );

      default:
        // Unknown element type - render as a placeholder box
        return (
          <div
            {...commonProps}
            className="border-2 border-dashed border-gray-300 rounded p-2 text-xs text-gray-400"
          >
            [{el.type}] {el.text || ''}
          </div>
        );
    }
  };

  return (
    <div className={`wireframe-renderer ${className}`}>
      {renderElement(element)}
    </div>
  );
}

// Frame wrapper component for device preview
interface WireframeFrameProps {
  children: React.ReactNode;
  title?: string;
}

export function WireframeFrame({ children, title }: WireframeFrameProps) {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Device frame header */}
      <div className="bg-gray-800 rounded-t-xl px-4 py-2 flex items-center gap-2 w-full">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        {title && <span className="text-gray-400 text-sm ml-4">{title}</span>}
      </div>
      
      {/* Device frame content - fixed height for consistency */}
      <div 
        className="bg-white border-2 border-gray-800 border-t-0 rounded-b-xl overflow-auto w-full"
        style={{ height: '600px' }}
      >
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

