import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppSidebar, AppNavSection, AppNavItem } from './AppSidebar';
import { RailSidebar } from './RailSidebar';

export interface AppShellProps {
  sections: AppNavSection[];
  brandName?: string;
  brandSubtitle?: string;
  brandTag?: string;
  brandMeta?: string;
  showStatusDot?: boolean;
  onBrandClick?: () => void;
  status?: React.ReactNode;
  sidebarFooter?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode);
  collapsible?: boolean;
  /**
   * `static` (default): fixed-width desktop sidebar.
   * `hover-rail`: 72px icon rail that overlays the page at full width while hovered or focused.
   */
  sidebarMode?: 'static' | 'hover-rail';
  topbar?: (api: { openSidebar: () => void }) => React.ReactNode;
  bottomNav?: React.ReactNode;
  children: React.ReactNode;
  /** Max width wrapper for the main content. Defaults to `max-w-7xl`. */
  contentMaxWidth?: string;
  mainId?: string;
}

export type { AppNavSection, AppNavItem };

export const AppShell: React.FC<AppShellProps> = ({
  sections,
  brandName,
  brandSubtitle,
  brandTag,
  brandMeta,
  showStatusDot,
  onBrandClick,
  status,
  sidebarFooter,
  collapsible = false,
  sidebarMode = 'static',
  topbar,
  bottomNav,
  children,
  contentMaxWidth = 'max-w-7xl',
  mainId,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isRail = sidebarMode === 'hover-rail';

  const [isExpanded, setIsExpanded] = useState(false);
  const collapseTimer = useRef<number | null>(null);

  const cancelCollapse = useCallback(() => {
    if (collapseTimer.current !== null) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const expandRail = useCallback(() => {
    cancelCollapse();
    setIsExpanded(true);
  }, [cancelCollapse]);

  const collapseRail = useCallback(
    (delay = 0) => {
      cancelCollapse();
      if (delay > 0) {
        collapseTimer.current = window.setTimeout(() => {
          collapseTimer.current = null;
          setIsExpanded(false);
        }, delay);
      } else {
        setIsExpanded(false);
      }
    },
    [cancelCollapse]
  );

  const toggleRail = useCallback(() => {
    cancelCollapse();
    setIsExpanded((v) => !v);
  }, [cancelCollapse]);

  useEffect(() => cancelCollapse, [cancelCollapse]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      {isRail && (
        <RailSidebar
          sections={sections}
          brandName={brandName}
          brandSubtitle={brandSubtitle}
          brandTag={brandTag}
          brandMeta={brandMeta}
          showStatusDot={showStatusDot}
          onBrandClick={onBrandClick}
          status={status}
          footer={sidebarFooter}
          isExpanded={isExpanded}
          onExpand={expandRail}
          onCollapse={collapseRail}
          onToggle={toggleRail}
        />
      )}

      <AppSidebar
        showDesktop={!isRail}
        sections={sections}
        brandName={brandName}
        brandSubtitle={brandSubtitle}
        brandTag={brandTag}
        brandMeta={brandMeta}
        showStatusDot={showStatusDot}
        onBrandClick={onBrandClick}
        status={status}
        footer={sidebarFooter}
        collapsed={collapsed}
        onToggleCollapse={collapsible ? () => setCollapsed((c) => !c) : undefined}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden ${isRail ? 'lg:ml-[72px]' : ''}`}>
        {topbar?.({ openSidebar: () => setDrawerOpen(true) })}

        <main id={mainId} className="flex-1 overflow-y-auto">
          <div className={`mx-auto ${contentMaxWidth} px-4 pb-24 pt-6 sm:px-6 lg:pb-10`}>
            {children}
          </div>
        </main>

        {bottomNav}
      </div>
    </div>
  );
};

export default AppShell;
