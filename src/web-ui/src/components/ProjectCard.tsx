import { useState } from 'react';
import { Link } from 'react-router-dom';
import { logger } from '../utils/logger';
import { IconPicker, IconSVG } from './IconPicker';

interface ProjectIcon {
  type: 'icon' | 'emoji';
  value: string;
  color?: string;
}

interface Project {
  id: string;
  fullId: string;
  folderName: string;
  name: string | null;
  description: string;
  path: string;
  status?: string;
  progressData?: {
    completed: number;
    total: number;
    percent: number;
  };
  icon?: ProjectIcon;
}

interface ProjectCardProps {
  project: Project;
  onIconChange?: (projectId: string, newIcon: ProjectIcon | null) => void;
}

// Status configuration with Linear-inspired colors
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  'ready_to_spec': { 
    label: 'Backlog', 
    color: 'hsl(0 0% 46%)', 
    bgColor: 'hsl(0 0% 94%)',
  },
  'pm_complete': { 
    label: 'PM Complete', 
    color: 'hsl(210 100% 45%)', 
    bgColor: 'hsl(210 100% 95%)',
  },
  'ux_in_progress': { 
    label: 'UX in Progress', 
    color: 'hsl(270 60% 50%)', 
    bgColor: 'hsl(270 60% 95%)',
  },
  'engineer_in_progress': { 
    label: 'Engineering', 
    color: 'hsl(44 100% 42%)', 
    bgColor: 'hsl(44 100% 94%)',
  },
  'ready_to_break': { 
    label: 'Ready to Break', 
    color: 'hsl(25 95% 50%)', 
    bgColor: 'hsl(25 95% 94%)',
  },
  'ready_to_ship': { 
    label: 'Ready to Ship', 
    color: 'hsl(200 95% 45%)', 
    bgColor: 'hsl(200 95% 94%)',
  },
  'implementing': { 
    label: 'Implementing', 
    color: 'hsl(280 70% 50%)', 
    bgColor: 'hsl(280 70% 94%)',
  },
  'completed': { 
    label: 'Completed', 
    color: 'hsl(142 76% 36%)', 
    bgColor: 'hsl(142 76% 94%)',
  },
};

// Arrow icon for hover state
const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-0 group-hover:opacity-100 transition-opacity">
    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Project Icon trigger component for the IconPicker
const ProjectIconTrigger = ({ icon, projectId }: { icon?: ProjectIcon; projectId: string }) => {
  const defaultColor = 'hsl(235 69% 61%)';
  
  return (
    <div 
      className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-300"
      style={{ 
        backgroundColor: icon?.type === 'icon' 
          ? icon.color || defaultColor 
          : icon?.type === 'emoji' 
            ? 'hsl(0 0% 96%)' 
            : defaultColor, 
        color: 'white' 
      }}
    >
      {icon?.type === 'emoji' ? (
        <span className="text-[18px]">{icon.value}</span>
      ) : icon?.type === 'icon' ? (
        <IconSVG name={icon.value} color="white" />
      ) : (
        <span className="text-[14px] font-semibold">{projectId.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
};

export function ProjectCard({ project, onIconChange }: ProjectCardProps) {
  const [localIcon, setLocalIcon] = useState<ProjectIcon | undefined>(project.icon);
  const status = project.status || 'ready_to_spec';
  const config = statusConfig[status] || statusConfig['ready_to_spec'];
  
  // Handle icon change with optimistic update
  const handleIconChange = async (newIcon: ProjectIcon | null) => {
    // Optimistic update
    setLocalIcon(newIcon || undefined);
    
    try {
      const response = await fetch(`/api/projects/${project.fullId}/icon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon: newIcon })
      });
      
      if (response.ok && onIconChange) {
        onIconChange(project.fullId, newIcon);
      }
    } catch (err) {
      // Revert on error
      setLocalIcon(project.icon);
      logger.error('Failed to save project icon:', err);
    }
  };

  return (
    <Link 
      to={`/project/${project.fullId}`}
      className="block no-underline group"
    >
      <div 
        className="rounded-lg p-5 transition-all duration-150 flex flex-col"
        style={{
          backgroundColor: 'hsl(0 0% 100%)',
          border: '1px solid hsl(0 0% 92%)',
          minHeight: '200px',
          height: '200px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'hsl(0 0% 99%)';
          e.currentTarget.style.borderColor = 'hsl(0 0% 85%)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'hsl(0 0% 100%)';
          e.currentTarget.style.borderColor = 'hsl(0 0% 92%)';
        }}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Icon Picker - clicking stops propagation to prevent navigation */}
            <div 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} 
              onMouseDown={(e) => e.stopPropagation()}
            >
              <IconPicker
                value={localIcon || null}
                onChange={handleIconChange}
                trigger={<ProjectIconTrigger icon={localIcon} projectId={project.fullId} />}
              />
            </div>
            <h3 
              className="text-[15px] font-semibold truncate"
              style={{ color: 'hsl(0 0% 9%)' }}
            >
              {project.fullId}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span 
              className="text-[12px] font-medium px-2.5 py-1 rounded-full"
              style={{ 
                color: config.color,
                backgroundColor: config.bgColor,
              }}
            >
              {config.label}
            </span>
            <ArrowIcon />
          </div>
        </div>

        {/* Description */}
        <p 
          className="text-[13px] leading-relaxed mb-4 line-clamp-2 flex-1"
          style={{ color: 'hsl(0 0% 46%)' }}
        >
          {project.description}
        </p>

        {/* Progress Footer */}
        {project.progressData && project.progressData.total > 0 ? (
          <div 
            className="pt-4 mt-auto"
            style={{ borderTop: '1px solid hsl(0 0% 94%)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
                Progress
              </span>
              <span className="text-[12px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>
                {project.progressData.percent}%
              </span>
            </div>
            
            {/* Progress Bar */}
            <div 
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'hsl(0 0% 94%)' }}
            >
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${project.progressData.percent}%`,
                  backgroundColor: config.color,
                }}
              />
            </div>
            
            <p className="text-[11px] mt-2" style={{ color: 'hsl(0 0% 56%)' }}>
              {project.progressData.completed} / {project.progressData.total} issues
            </p>
          </div>
        ) : (
          <div 
            className="pt-4 mt-auto"
            style={{ borderTop: '1px solid hsl(0 0% 94%)' }}
          >
            <p className="text-[12px]" style={{ color: 'hsl(0 0% 56%)' }}>
              No issues yet
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
