/** Console navigation. Add a feature here and in app.routes.ts. */
export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Shown greyed with a "Soon" tag until the feature ships. */
  comingSoon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'space_dashboard', route: '/dashboard' },
  { label: 'Stores', icon: 'storefront', route: '/stores' },
  { label: 'Receipts', icon: 'receipt_long', route: '/receipts' },
  { label: 'Users', icon: 'group', route: '/users' },
  { label: 'Categories', icon: 'category', route: '/categories' },
];
