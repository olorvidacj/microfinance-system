import React, { useState } from 'react';
import { AppSidebar, AppNavSection, AppNavItem } from './AppSidebar';

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
  topbar,
  bottomNav,
  children,
  contentMaxWidth = 'max-w-7xl',
  mainId,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      <AppSidebar
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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
