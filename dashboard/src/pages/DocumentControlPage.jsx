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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDocuments, getCategories } from '../api/documentControl';

export default function DocumentControlPage() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const canManage    = isAdmin || isSupervisor;

  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, categories: 0 });

  useEffect(() => {
    Promise.all([
      getDocuments({ status: 'approved' }).catch(() => ({ data: [] })),
      getDocuments({ status: 'under_review' }).catch(() => ({ data: [] })),
      getCategories().catch(() => ({ data: [] })),
      getDocuments().catch(() => ({ data: [] })),
    ]).then(([approved, pending, cats, all]) => {
      setStats({
        total:      Array.isArray(all.data)     ? all.data.length     : (all.data?.length ?? 0),
        approved:   Array.isArray(approved.data) ? approved.data.length : (approved.data?.length ?? 0),
        pending:    Array.isArray(pending.data)  ? pending.data.length  : (pending.data?.length ?? 0),
        categories: Array.isArray(cats.data)     ? cats.data.length     : (cats.data?.length ?? 0),
      });
    });
  }, []);

  const moduleCards = [
    {
      title: 'All Documents',
      subtitle: 'Browse, search & download documents',
      description: 'Access the full document library. Search by title, category, or document number. Download approved documents directly from Cloudinary.',
      icon: FolderOpen,
      iconBg: 'rgba(99, 102, 241, 0.12)',
      iconColor: '#6366f1',
      to: '/document-control/documents',
      badge: 'Document Library',
      badgeBg: '#e0e7ff',
      badgeColor: '#6366f1',
      primary: true,
      actionText: 'Open Document Library',
      showAlways: true,
    },
    {
      title: 'Pending Approvals',
      subtitle: 'Review & approve submitted documents',
      description: 'Review documents submitted for approval. Approve or reject with comments. All actions are logged in the document activity trail.',
      icon: ClipboardCheck,
      iconBg: 'rgba(245, 158, 11, 0.12)',
      iconColor: '#d97706',
      to: '/document-control/approvals',
      badge: `${stats.pending} Pending`,
      badgeBg: '#fef3c7',
      badgeColor: '#d97706',
      primary: false,
      actionText: 'Review Pending Documents',
      showAlways: false,
    },
  ];

  const visibleCards = canManage
    ? moduleCards
    : moduleCards.filter(c => c.showAlways);

  const statItems = [
    { label: 'Total Documents', value: stats.total, icon: FileText, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { label: 'Approved',        value: stats.approved, icon: CheckCircle, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Pending Review',  value: stats.pending,  icon: Clock,       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Categories',      value: stats.categories, icon: Tag,       color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  ];

  return (
    <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            background: 'rgba(99,102,241,0.12)', borderRadius: '12px',
            padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FolderOpen size={24} color="#6366f1" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Document Control
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
              Manage, approve and distribute company documents
            </p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '28px',
      }}>
        {statItems.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{
              background: '#fff', borderRadius: '14px', padding: '18px 20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <div style={{
                background: s.bg, borderRadius: '10px', padding: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Icon size={20} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Module Cards */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
          {canManage ? 'Document Management Tools' : 'Document Library Access'}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 18px 0' }}>
          {canManage
            ? 'Upload documents, manage approvals, and control document categories.'
            : 'Browse and download approved company documents.'}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px'
      }}>
        {visibleCards.map((card, idx) => {
          const CardIcon = card.icon;
          return (
            <NavLink key={idx} to={card.to} style={{ textDecoration: 'none' }}>
              <div
                className="card"
                style={{
                  padding: '24px', borderRadius: '16px', height: '100%',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  background: '#ffffff',
                  border: card.primary ? '2px solid rgba(99,102,241,0.3)' : '1px solid #e2e8f0',
                  boxShadow: card.primary ? '0 10px 25px -5px rgba(99,102,241,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'all 0.22s ease', cursor: 'pointer', position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = card.iconColor;
                  e.currentTarget.style.boxShadow = `0 14px 28px -6px ${card.iconBg}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = card.primary ? 'rgba(99,102,241,0.3)' : '#e2e8f0';
                  e.currentTarget.style.boxShadow = card.primary ? '0 10px 25px -5px rgba(99,102,241,0.12)' : '0 2px 8px rgba(0,0,0,0.04)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{
                      background: card.iconBg, padding: '14px', borderRadius: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <CardIcon size={26} color={card.iconColor} />
                    </div>
                    <span style={{
                      background: card.badgeBg, color: card.badgeColor,
                      fontSize: '12px', fontWeight: '700', padding: '4px 10px',
                      borderRadius: '20px', letterSpacing: '0.3px'
                    }}>
                      {card.badge}
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                    {card.title}
                  </h3>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '12px' }}>
                    {card.subtitle}
                  </span>
                  <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.55', margin: 0 }}>
                    {card.description}
                  </p>
                </div>
                <div style={{
                  marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: card.iconColor }}>
                    {card.actionText}
                  </span>
                  <div style={{
                    background: card.iconBg, borderRadius: '50%', width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <ArrowRight size={16} color={card.iconColor} />
                  </div>
                </div>
              </div>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
