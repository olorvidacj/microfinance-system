import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Brand } from './Brand';

export interface AppNavItem {
  /** Route target. Omit when using `onSelect` (tab-style navigation). */
  to?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number;
  /** Active state for tab-style (non-route) navigation. */
  active?: boolean;
  /** Click handler for tab-style (non-route) navigation. */
  onSelect?: () => void;
}

export interface AppNavSection {
  title?: string;
  items: AppNavItem[];
}

export interface AppSidebarProps {
  sections: AppNavSection[];
  /** Brand configuration for the sidebar header. */
  brandName?: string;
  brandSubtitle?: string;
  brandTag?: string;
  brandMeta?: string;
  showStatusDot?: boolean;
  onBrandClick?: () => void;
  /** Optional strip rendered directly under the brand header (e.g. registry/branch status). */
  status?: React.ReactNode;
  /** Footer slot (profile card, logout, environment info). */
  footer?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode);
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  open: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}

const itemClassName = (isActive: boolean, collapsed: boolean) =>
  `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all sm:text-[13px] ${
    isActive
      ? 'border-l-4 border-gold-400 bg-gradient-to-r from-gold-500/20 via-gold-500/10 to-transparent pl-2 font-semibold text-white shadow-sm'
      : 'text-slate-400 hover:bg-navy-800 hover:text-slate-100'
  } ${collapsed ? 'justify-center px-2' : ''}`;

const SidebarLinkBody: React.FC<{ item: AppNavItem; collapsed: boolean; isActive: boolean }> = ({
  item,
  collapsed,
  isActive,
}) => (
  <>
    <item.icon
      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
        isActive ? 'text-gold-400' : 'text-slate-400 group-hover:text-gold-300'
      }`}
    />
    {!collapsed && (
      <>
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span className="shrink-0 rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-navy-950 shadow-sm">
            {item.badge}
          </span>
        )}
      </>
    )}
    {collapsed && item.badge !== undefined && item.badge > 0 && (
      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold-400" />
    )}
  </>
);

const SidebarLink: React.FC<{ item: AppNavItem; collapsed: boolean; onNavigate?: () => void }> = ({
  item,
  collapsed,
  onNavigate,
}) => {
  if (item.onSelect) {
    return (
      <button
        type="button"
        onClick={() => {
          item.onSelect?.();
          onNavigate?.();
        }}
        title={collapsed ? item.label : undefined}
        className={`w-full text-left ${itemClassName(!!item.active, collapsed)}`}
      >
        <SidebarLinkBody item={item} collapsed={collapsed} isActive={!!item.active} />
      </button>
    );
  }

  return (
    <NavLink
      to={item.to || '#'}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => itemClassName(isActive, collapsed)}
    >
      {({ isActive }) => <SidebarLinkBody item={item} collapsed={collapsed} isActive={isActive} />}
    </NavLink>
  );
};

const SidebarContent: React.FC<Omit<AppSidebarProps, 'open' | 'onClose'>> = ({
  sections,
  brandName,
  brandSubtitle,
  brandTag,
  brandMeta,
  showStatusDot,
  onBrandClick,
  status,
  footer,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}) => (
  <div className="flex h-full flex-col border-r border-navy-700 bg-navy-950 text-slate-300 select-none">
    {/* Brand header */}
    <div
      className={`flex h-16 shrink-0 items-center justify-between border-b border-navy-700 px-4 ${
        collapsed ? 'justify-center px-2' : ''
      }`}
    >
      <Brand
        name={brandName}
        subtitle={brandSubtitle}
        tag={brandTag}
        meta={brandMeta}
        collapsed={collapsed}
        showStatusDot={showStatusDot}
        onLogoClick={onBrandClick}
      />

      {/* Desktop collapse toggle */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="hidden rounded-lg p-1.5 text-slate-400 transition hover:bg-navy-800/80 hover:text-gold-400 lg:flex"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      )}
    </div>

    {/* Optional status strip */}
    {!collapsed && status && <div className="shrink-0 border-b border-navy-700">{status}</div>}

    {/* Navigation */}
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3 no-scrollbar">
      {sections.map((section, i) => (
        <div key={section.title || i}>
          {!collapsed && section.title && (
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {section.title}
            </p>
          )}
          <div className="space-y-1">
            {section.items.map((item) => (
              <SidebarLink key={item.to || item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>

    {/* Footer slot */}
    {footer && (
      <div className="shrink-0 border-t border-navy-700 bg-navy-950/80">
        {typeof footer === 'function' ? footer({ collapsed }) : footer}
      </div>
    )}
  </div>
);

export const AppSidebar: React.FC<AppSidebarProps> = ({ open, onClose, collapsed = false, ...rest }) => (
  <>
    {/* Desktop sidebar */}
    <aside
      className={`hidden shrink-0 transition-all duration-300 ease-in-out lg:block ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      <div className="sticky top-0 h-screen">
        <div className="h-full">
          <SidebarContent collapsed={collapsed} {...rest} />
        </div>
      </div>
    </aside>

    {/* Mobile drawer */}
    {open && (
      <div className="fixed inset-0 z-50 lg:hidden">
        <div
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
        <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">
          <button
            onClick={onClose}
            className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-navy-800 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
          <SidebarContent collapsed={false} onNavigate={onClose} {...rest} />
        </div>
      </div>
    )}
  </>
);

export default AppSidebar;
