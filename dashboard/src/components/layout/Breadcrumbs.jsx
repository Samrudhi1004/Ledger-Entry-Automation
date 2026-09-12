import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Static route hierarchy map for automatic breadcrumb trail detection.
 */
const ROUTE_MAP = {
  '/document-control': [{ label: 'Document Control' }],
  '/document-control/documents': [
    { label: 'Document Control', to: '/document-control' },
    { label: 'Documents (L1–L4)' },
  ],
  '/document-control/dcr': [
    { label: 'Document Control', to: '/document-control' },
    { label: 'Change Requests (DCR)' },
  ],
  '/document-control/approvals': [
    { label: 'Document Control', to: '/document-control' },
    { label: 'Direct Approvals Queue' },
  ],
  '/development': [{ label: 'Development' }],
  '/development/drawings': [
    { label: 'Development', to: '/development' },
    { label: 'Drawing Management' },
  ],
  '/development/control-plans': [
    { label: 'Development', to: '/development' },
    { label: 'Control Plan Management' },
  ],
  '/machines': [{ label: 'Machines' }],
  '/inspections': [{ label: 'Inspections' }],
  '/production': [{ label: 'Production' }],
  '/production/jh-inspections': [
    { label: 'Production', to: '/production' },
    { label: 'JH Inspection Reports' },
  ],
  '/reports': [{ label: 'Reports' }],
  '/reports/downtime': [
    { label: 'Reports', to: '/reports' },
    { label: 'Downtime Analysis' },
  ],
  '/pending-reviews': [
    { label: 'Reports', to: '/reports' },
    { label: 'Pending Inspection Reviews' },
  ],
  '/calibration': [{ label: 'Calibration Equipment' }],
  '/calibration/equipment': [
    { label: 'Calibration', to: '/calibration' },
    { label: 'Equipment Register' },
  ],
  '/calibration/equipment/new': [
    { label: 'Calibration', to: '/calibration' },
    { label: 'Equipment Register', to: '/calibration/equipment' },
    { label: 'Register New Instrument' },
  ],
  '/calibration/plan': [
    { label: 'Calibration', to: '/calibration' },
    { label: 'Annual Calibration Plan' },
  ],
  '/parameters': [{ label: 'Master Parameters' }],
  '/quality-analyzer': [{ label: 'Quality Analyzer' }],
  '/qa': [{ label: 'Quality Analyzer' }],
  '/users': [{ label: 'User Management' }],
  '/company': [{ label: 'Company Details & Profile' }],
  '/tasks': [{ label: 'Tasks' }],
  '/messages': [{ label: 'Messages' }],
  '/profile': [{ label: 'My Profile' }],
  '/purchase': [{ label: 'Purchase' }],
  '/store': [{ label: 'Store Inventory' }],
  '/maintenance': [{ label: 'Maintenance' }],
  '/marketing': [{ label: 'Marketing' }],
  '/hr': [{ label: 'HR Management' }],
};

/**
 * Universal Breadcrumbs component.
 * Renders standard module-relative path: e.g. "Machines / VMC-01" or "Document Control / Change Requests (DCR)".
 *
 * @param {Array<{ label: string, to?: string }>} [items] - Explicit breadcrumbs trail
 * @param {string} [className] - Optional extra class
 */
export default function Breadcrumbs({ items, className = '' }) {
  const location = useLocation();

  const trail = items || ROUTE_MAP[location.pathname] || [];

  if (!trail || trail.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={`page-breadcrumb mb-16 ${className}`}>
      {trail.map((crumb, idx) => {
        const isLast = idx === trail.length - 1;
        return (
          <React.Fragment key={crumb.to || `${crumb.label}-${idx}`}>
            {idx > 0 && <span className="breadcrumb-separator">/</span>}
            {crumb.to && !isLast ? (
              <Link to={crumb.to}>{crumb.label}</Link>
            ) : (
              <span className="breadcrumb-current">{crumb.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
