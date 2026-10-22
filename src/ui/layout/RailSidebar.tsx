import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Brand } from './Brand';
import type { AppNavItem, AppNavSection } from './AppSidebar';

export const RAIL_COLLAPSE_DELAY_MS = 200;

export interface RailSidebarProps {
  sections: AppNavSection[];
  brandName?: string;
  brandSubtitle?: string;
  brandTag?: string;
  brandMeta?: string;
  showStatusDot?: boolean;
  /** Mouse/keyboard click on the logo. Touch taps on the logo always toggle the rail. */
  onBrandClick?: () => void;
  status?: React.ReactNode;
  footer?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode);
  isExpanded: boolean;
  onExpand: () => void;
  /** Collapse the rail, optionally after `delay` ms (cancelled by a later `onExpand`). */
  onCollapse: (delay?: number) => void;
  onToggle: () => void;
}

/** Shared show/hide classes for every text label in the rail. */
export const railLabelClass = (isExpanded: boolean) =>
  `whitespace-nowrap overflow-hidden transition-all duration-300 ${
    isExpanded ? 'opacity-100 ml-3' : 'opacity-0 w-0'
  }`;

interface RailLinkProps {
  item: AppNavItem;
  isExpanded: boolean;
  onActivate: (e: React.MouseEvent) => void;
}

const RailLink: React.FC<RailLinkProps> = ({ item, isExpanded, onActivate }) => {
  const hasBadge = item.badge !== undefined && item.badge > 0;
  const ariaLabel = hasBadge ? `${item.label} (${item.badge} new)` : item.label;

  // Fixed left inset keeps the icon on the rail's centre line (12px nav padding + 15px + 9px half-icon = 36px).
  const className = (isActive: boolean) =>
    `group relative flex h-10 w-full items-center overflow-hidden rounded-xl pr-3 text-left text-xs font-medium transition-colors sm:text-[13px] ${
      isActive
        ? 'border-l-4 border-gold-400 bg-gradient-to-r from-gold-500/20 via-gold-500/10 to-transparent pl-[11px] font-semibold text-white shadow-sm'
        : 'pl-[15px] text-slate-400 hover:bg-navy-800 hover:text-slate-100'
    }`;

  const body = (isActive: boolean) => (
    <>
      <span className="relative shrink-0">
        <item.icon
          className={`h-[18px] w-[18px] transition-colors ${
            isActive ? 'text-gold-400' : 'text-slate-400 group-hover:text-gold-300'
          }`}
        />
        {hasBadge && (
          <span
            aria-hidden
            className={`absolute -right-1 -top-1 h-2 w-2 rounded-full bg-gold-400 ring-2 ring-navy-950 transition-opacity duration-300 ${
              isExpanded ? 'opacity-0' : 'opacity-100'
            }`}
          />
        )}
      </span>
      <span className={`flex items-center gap-2 ${railLabelClass(isExpanded)} ${isExpanded ? 'min-w-0 flex-1' : ''}`}>
        <span className="flex-1 overflow-hidden">{item.label}</span>
        {hasBadge && (
          <span className="shrink-0 rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-navy-950 shadow-sm">
            {item.badge}
          </span>
        )}
      </span>
    </>
  );

  if (item.onSelect) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        title={isExpanded ? undefined : item.label}
        onClick={(e) => {
          item.onSelect?.();
          onActivate(e);
        }}
        className={className(!!item.active)}
      >
        {body(!!item.active)}
      </button>
    );
  }

  return (
    <NavLink
      to={item.to || '#'}
      end={item.end}
      aria-label={ariaLabel}
      title={isExpanded ? undefined : item.label}
      onClick={onActivate}
      className={({ isActive }) => className(isActive)}
    >
      {({ isActive }) => body(isActive)}
    </NavLink>
  );
};

/**
 * Desktop sidebar that rests as a 72px icon rail and slides open over the page
 * while the mouse is over it, keyboard focus is inside it, or after a tap on the logo (touch).
 */
export const RailSidebar: React.FC<RailSidebarProps> = ({
  sections,
  brandName,
  brandSubtitle,
  brandTag,
  brandMeta,
  showStatusDot,
  onBrandClick,
  status,
  footer,
  isExpanded,
  onExpand,
  onCollapse,
  onToggle,
}) => {
  const asideRef = useRef<HTMLElement>(null);
  const lastPointerType = useRef<string>('mouse');
  const mouseInside = useRef(false);

  // Tap outside closes the rail on touch screens.
  useEffect(() => {
    if (!isExpanded) return;
    const onPointerDown = (e: PointerEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) onCollapse();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isExpanded, onCollapse]);

  // Touch browsers fire emulated mouseenter on tap; the logo tap handles touch instead.
  const isTouch = () => lastPointerType.current !== 'mouse';
  const isTouchOrKeyboard = (e: React.MouseEvent) => e.detail === 0 || isTouch();

  const handleMouseEnter = () => {
    if (isTouch()) return;
    mouseInside.current = true;
    onExpand();
  };

  const handleMouseLeave = () => {
    if (isTouch()) return;
    mouseInside.current = false;
    onCollapse(RAIL_COLLAPSE_DELAY_MS);
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (isTouch()) onToggle();
    else if (onBrandClick) onBrandClick();
    else if (isTouchOrKeyboard(e)) onToggle();
  };

  const handleItemActivate = (e: React.MouseEvent) => {
    if (isTouchOrKeyboard(e)) onCollapse();
  };

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    let focusVisible = false;
    try {
      focusVisible = (e.target as HTMLElement).matches(':focus-visible');
    } catch {
      /* selector unsupported */
    }
    // Only keyboard focus expands; a mouse click on a link must not pin the rail open.
    if (focusVisible) onExpand();
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && asideRef.current?.contains(next)) return;
    if (!mouseInside.current) onCollapse();
  };

  return (
    <aside
      ref={asideRef}
      aria-label="Sidebar"
      aria-expanded={isExpanded}
      onPointerDownCapture={(e) => {
        lastPointerType.current = e.pointerType;
      }}
      onPointerEnter={(e) => {
        lastPointerType.current = e.pointerType;
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`fixed inset-y-0 left-0 z-50 hidden overflow-hidden transition-all duration-300 lg:block ${
        isExpanded ? 'w-80 shadow-[10px_0_30px_-10px_rgba(2,6,23,0.55)]' : 'w-[72px] shadow-none'
      }`}
    >
      <div className="flex h-full w-full flex-col border-r border-navy-700 bg-navy-950 text-slate-300 select-none">
        <div className="flex h-16 shrink-0 items-center border-b border-navy-700 px-4">
          <Brand
            name={brandName}
            subtitle={brandSubtitle}
            tag={brandTag}
            meta={brandMeta}
            collapsed={!isExpanded}
            fadeLabel
            showStatusDot={showStatusDot}
            onLogoClick={handleLogoClick}
          />
        </div>

        {status && (
          <div
            className={`shrink-0 overflow-hidden whitespace-nowrap transition-all duration-300 ${
              isExpanded ? 'border-b border-navy-700 opacity-100' : 'h-0 opacity-0'
            }`}
          >
            {status}
          </div>
        )}

        <nav className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 py-3 no-scrollbar">
          {sections.map((section, i) => (
            <div key={section.title || i}>
              {section.title && (
                <div className="relative mb-1.5 flex h-4 items-center">
                  <p
                    className={`text-[10px] font-bold uppercase leading-4 tracking-wider text-slate-400 ${railLabelClass(
                      isExpanded
                    )}`}
                  >
                    {section.title}
                  </p>
                  <span
                    aria-hidden
                    className={`absolute left-3 top-1/2 h-px w-6 -translate-y-1/2 bg-navy-700 transition-opacity duration-300 ${
                      isExpanded ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <RailLink
                    key={item.to || item.label}
                    item={item}
                    isExpanded={isExpanded}
                    onActivate={handleItemActivate}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {footer && (
          <div className="shrink-0 overflow-hidden border-t border-navy-700 bg-navy-950/80">
            {typeof footer === 'function' ? footer({ collapsed: !isExpanded }) : footer}
          </div>
        )}
      </div>
    </aside>
  );
};

export default RailSidebar;
