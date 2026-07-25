export type SidebarUpgradeRouteOwner = 'upgrade' | 'explore-max' | null;

export function getSidebarUpgradeRouteOwner(tier: string, route: string): SidebarUpgradeRouteOwner {
  const pathname = route.split('?')[0];
  if (pathname !== '/suite/upgrade') return null;
  if (tier === 'free') return 'upgrade';
  if (tier === 'pro') return 'explore-max';
  return null;
}

export function getSidebarPresentation(
  isMobile: boolean,
  isCollapsed: boolean,
  adminCompact = false,
) {
  const compact = !isMobile && isCollapsed;
  return {
    compact,
    width: isMobile
      ? 'min(320px, calc(100vw - 20px))'
      : compact
        ? 62
        : adminCompact
          ? 208
          : 256,
    contentOffset: compact ? '86px' : adminCompact ? '228px' : '276px',
  } as const;
}
