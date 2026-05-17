import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/infobells_logo.jpeg';

interface NavItem { to: string; label: string; section?: string }

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sideOpen, setSideOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const allItems: NavItem[] = [
    // Field Reports pinned to top for staff and admin
    ...(user?.role === 'OFFICE_STAFF' || user?.role === 'ADMIN' ? [
      { to: '/field-reports/approvals', label: 'Field Reports' },
    ] : []),
    // Operations — ADMIN or OFFICE_STAFF
    ...(user?.role !== 'EXECUTIVE' ? [
      { to: '/outstanding',  label: 'Outstanding' },
      { to: '/master',       label: 'Master Invoices' },
      { to: '/old-invoices', label: 'Old Invoices' },
      { to: '/pending',      label: 'Invoices for Delivery' },
      { to: '/issue',        label: 'Issued Invoices' },
      { to: '/return',       label: 'Return Invoices' },
      { to: '/paid',         label: 'Paid Invoices' },
    ] : []),
    // Search — all roles
    { to: '/invoices', label: 'Invoice Search' },
    { to: '/export',   label: 'Export Data' },
    // Executive self-view
    ...(user?.role === 'EXECUTIVE' ? [
      { to: '/me/field-report', label: 'Field Report' },
      { to: '/me/outstanding',  label: 'My Outstanding' },
    ] : []),
    // Office staff extras
    ...(user?.role === 'OFFICE_STAFF' ? [
      { to: '/my-approvals', label: 'My Requests' },
      { to: '/admin/shops',  label: 'Shops' },
      { to: '/reports',      label: 'Reports' },
    ] : []),
    // Admin management
    ...(user?.role === 'ADMIN' ? [
      { to: '/approvals',        label: 'Approvals',  section: 'Admin' },
      { to: '/admin/users',      label: 'Users',      section: 'Admin' },
      { to: '/admin/executives', label: 'Executives', section: 'Admin' },
      { to: '/admin/routes',     label: 'Routes',     section: 'Admin' },
      { to: '/admin/shops',      label: 'Shops',      section: 'Admin' },
      { to: '/reports',          label: 'Reports',    section: 'Admin' },
    ] : []),
  ];

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-md text-sm transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  const sidebarContent = (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-full">
      {/* Branding */}
      <div className="px-4 py-4 border-b border-gray-700 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <img src={logo} alt="Infobells" className="h-8 w-8 rounded flex-shrink-0" />
            <p className="font-bold text-sm leading-tight">Infobells Invoice Tracker</p>
          </div>
          <p className="text-xs text-gray-300 mt-1 truncate">{user?.name}</p>
          <span className="inline-block mt-1 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
            {user?.role?.replace('_', ' ')}
          </span>
        </div>
        {/* Close button — mobile only */}
        <button
          className="md:hidden text-gray-400 hover:text-white p-1 -mt-1 -mr-1 flex-shrink-0"
          onClick={() => setSideOpen(false)}
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {allItems.map((item, i) => {
          const showSection =
            item.section && (i === 0 || allItems[i - 1].section !== item.section);
          return (
            <div key={item.to}>
              {showSection && (
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider px-3 pt-4 pb-1">
                  {item.section}
                </p>
              )}
              <NavLink to={item.to} className={linkCls} onClick={() => setSideOpen(false)}>
                {item.label}
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm text-gray-400 hover:text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Desktop sidebar (always visible) ── */}
      <div className="hidden md:flex flex-shrink-0">
        {sidebarContent}
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {sideOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSideOpen(false)}
          />
          {/* Drawer */}
          <div className="relative z-10 flex-shrink-0">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 bg-gray-900 text-white px-4 py-3 flex-shrink-0">
          <button
            onClick={() => setSideOpen(true)}
            className="text-gray-300 hover:text-white"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src={logo} alt="Infobells" className="h-7 w-7 rounded" />
          <span className="font-semibold text-sm">Infobells Invoice Tracker</span>
        </header>

        <main className="flex-1 overflow-auto p-3 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
