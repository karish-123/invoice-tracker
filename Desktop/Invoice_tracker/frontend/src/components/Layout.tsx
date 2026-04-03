import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/infobells_logo.jpeg';

interface NavItem { to: string; label: string; section?: string }

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const allItems: NavItem[] = [
    // Operations — ADMIN or OFFICE_STAFF
    ...(user?.role !== 'EXECUTIVE' ? [
      { to: '/outstanding', label: 'Outstanding' },
      { to: '/master',      label: 'Master Invoices' },
      { to: '/old-invoices', label: 'Old Invoices' },
      { to: '/pending',     label: 'Invoices for Delivery' },
      { to: '/issue',       label: 'Issued Invoices' },
      { to: '/return',      label: 'Return Invoices' },
      { to: '/paid',        label: 'Paid Invoices' },
    ] : []),
    // Search — all roles
    { to: '/invoices', label: 'Invoice Search' },
    { to: '/export',   label: 'Export Data' },
    // Executive self-view
    ...(user?.role === 'EXECUTIVE' ? [
      { to: '/me/outstanding', label: 'My Outstanding' },
    ] : []),
    // Office staff: approval requests
    ...(user?.role === 'OFFICE_STAFF' ? [
      { to: '/my-approvals', label: 'My Requests' },
    ] : []),
    // Admin management
    ...(user?.role === 'ADMIN' ? [
      { to: '/approvals',         label: 'Approvals',  section: 'Admin' },
      { to: '/admin/users',       label: 'Users',      section: 'Admin' },
      { to: '/admin/executives',  label: 'Executives', section: 'Admin' },
      { to: '/admin/routes',      label: 'Routes',     section: 'Admin' },
    ] : []),
  ];

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-md text-sm transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col flex-shrink-0">
        {/* Branding */}
        <div className="px-4 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <img src={logo} alt="Infobells" className="h-8 w-8 rounded" />
            <p className="font-bold text-sm leading-tight">Infobells Invoice Tracker</p>
          </div>
          <p className="text-xs text-gray-300 mt-1 truncate">{user?.name}</p>
          <span className="inline-block mt-1 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
            {user?.role?.replace('_', ' ')}
          </span>
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
                <NavLink to={item.to} className={linkCls}>
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

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
