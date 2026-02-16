interface SidebarResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

export function SidebarResizeHandle({ onMouseDown }: SidebarResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute top-0 right-0 h-full group"
      style={{ width: '6px', cursor: 'col-resize', zIndex: 20 }}
    >
      <div
        className="h-full transition-colors duration-150 group-hover:bg-[hsl(235,69%,61%)]"
        style={{ width: '2px', marginLeft: 'auto' }}
      />
    </div>
  );
}
