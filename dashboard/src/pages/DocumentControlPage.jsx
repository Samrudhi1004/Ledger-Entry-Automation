import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FolderOpen,
  FileText,
  ClipboardCheck,
  Tag,
  ArrowRight,
  Upload,
  FileCheck,
  Clock,
  CheckCircle,
  Edit3,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDocuments, getDCRs } from '../api/documentControl';
import Header from '../components/layout/Header';
import Breadcrumbs from '../components/layout/Breadcrumbs';

export default function DocumentControlPage() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const isCalibrator = user?.role === 'calibrator';
  const canManage    = isAdmin || isSupervisor || isCalibrator;

  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, pendingDcr: 0 });

  useEffect(() => {
    Promise.all([
      getDocuments({ status: 'approved' }).catch(() => ({ data: [] })),
      getDocuments({ status: 'under_review' }).catch(() => ({ data: [] })),
      getDocuments().catch(() => ({ data: [] })),
      getDCRs({ tab: 'action_required' }).catch(() => ({ data: [] })),
    ]).then(([approved, pending, all, dcrRes]) => {
      const getLen = (res) => (Array.isArray(res.data) ? res.data.length : (res.data?.results?.length ?? 0));
      setStats({
        total:      getLen(all),
        approved:   getLen(approved),
        pending:    getLen(pending),
        pendingDcr: getLen(dcrRes),
      });
    });
  }, []);

  const moduleCards = [
    {
      title: 'Document Register (L1–L4)',
      icon: FolderOpen,
      iconBg: 'rgba(99, 102, 241, 0.12)',
      iconColor: '#4f46e5',
      to: '/document-control/documents',
      badge: 'L1–L4 Hierarchy',
      badgeBg: '#e0e7ff',
      badgeColor: '#4338ca',
      primary: true,
      actionText: 'Open Document Library',
      showAlways: true,
    },
    {
      title: 'Change Requests (DCR)',
      icon: Edit3,
      iconBg: 'rgba(16, 185, 129, 0.12)',
      iconColor: '#059669',
      to: '/document-control/dcr',
      badge: stats.pendingDcr > 0 ? `${stats.pendingDcr} Action Required` : 'DKI/MR/F/05',
      badgeBg: stats.pendingDcr > 0 ? '#fef3c7' : '#ecfdf5',
      badgeColor: stats.pendingDcr > 0 ? '#b45309' : '#059669',
      primary: false,
      actionText: 'Manage Change Requests',
      showAlways: true,
    },
    {
      title: 'Direct Approvals Queue',
      icon: ClipboardCheck,
      iconBg: 'rgba(245, 158, 11, 0.12)',
      iconColor: '#d97706',
      to: '/document-control/approvals',
      badge: `${stats.pending} Pending`,
      badgeBg: '#fef3c7',
      badgeColor: '#d97706',
      primary: false,
      actionText: 'Review Pending Approvals',
      showAlways: false,
      adminOnly: true,
    },
  ];

  const visibleCards = moduleCards.filter((c) => {
    if (c.adminOnly && !isAdmin) return false;
    if (!canManage && !c.showAlways) return false;
    return true;
  });

  const statItems = [
    { label: 'Total Documents', value: stats.total, icon: FileText, color: '#4f46e5', bg: 'rgba(99,102,241,0.1)' },
    { label: 'Approved & Active', value: stats.approved, icon: CheckCircle, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Pending DCR Actions', value: stats.pendingDcr, icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Document Categories', value: stats.categories, icon: Tag, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  ];

  return (
    <>
      <Header
        title="Document Control Management"
        subtitle="ISO 9001 / IATF 16949 compliant document hierarchy, direct viewer, and Form DKI/MR/F/05 workflow"
      />

      <div className="page-content bg-gradient-animated">
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Breadcrumbs items={[{ label: 'Document Control' }]} />

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px', marginBottom: '32px'
      }}>
        {statItems.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} style={{
              background: '#fff', borderRadius: '14px', padding: '18px 20px',
              border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: '16px'
            }}>
              <div style={{
                background: s.bg, borderRadius: '12px', width: '46px', height: '46px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Icon size={22} color={s.color} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{s.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Module Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '24px', marginBottom: '40px'
      }}>
        {visibleCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <NavLink
              key={i}
              to={c.to}
              style={{
                textDecoration: 'none', background: '#fff', borderRadius: '16px',
                border: c.primary ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                padding: '24px', display: 'flex', flexDirection: 'column',
                boxShadow: c.primary ? '0 8px 24px rgba(79,70,229,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  background: c.iconBg, borderRadius: '12px', width: '48px', height: '48px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={24} color={c.iconColor} />
                </div>
                <span style={{
                  background: c.badgeBg, color: c.badgeColor, fontSize: '11px',
                  fontWeight: '700', padding: '4px 10px', borderRadius: '20px'
                }}>
                  {c.badge}
                </span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px' }}>
                {c.title}
              </h2>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                fontWeight: '700', color: '#4f46e5', borderTop: '1px solid #f1f5f9', paddingTop: '16px'
              }}>
                <span>{c.actionText}</span>
                <ArrowRight size={15} />
              </div>
            </NavLink>
          );
        })}
      </div>
      </div>
      </div>
    </>
  );
}
