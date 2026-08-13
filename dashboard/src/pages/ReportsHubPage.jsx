import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import { Cpu, FileText, ArrowRight, ShieldCheck, Activity, CheckCircle2, BarChart3 } from 'lucide-react';

export default function ReportsHubPage() {
  const navigate = useNavigate();

  const reportCards = [
    {
      id: 'live-reports',
      title: 'Live Reports',
      badge: 'Live Station Monitoring',
      badgeBg: '#DEF7EC',
      badgeColor: '#03543F',
      icon: Cpu,
      iconBg: '#EBF5FF',
      iconColor: '#1A56DB',
      description:
        'Real-time active station tracking, machine status, operator assignments, and live digital inspection sheets per machine.',
      details: ['Live Machine Station Status', 'Active Operator Tracking', 'Real-Time WebSocket Sync'],
      actionText: 'Open Live Reports',
      link: '/machines',
    },
    {
      id: 'f02-reports',
      title: 'First PC Inspection & In process Reports',
      badge: 'Form F02 Quality Records',
      badgeBg: '#E1EFFE',
      badgeColor: '#1E40AF',
      icon: FileText,
      iconBg: '#F3E8FF',
      iconColor: '#7E22CE',
      description:
        '100% completed daily quality inspection reports, official 19-column Form F02 sheets, supervisor reviews & PDF exports with date-wise naming.',
      details: ['Official Form F02 PDF Downloads', '19-Column Inspection Records', 'Date-Wise Filterable Archive'],
      actionText: 'Open Inspection Reports',
      link: '/analytics',
    },
    {
      id: 'setup-approval-reports',
      title: 'Set Up Approval Report',
      badge: '● Setup Approval Quality Records',
      badgeBg: '#EEF2FF',
      badgeColor: '#4338CA',
      icon: ShieldCheck,
      iconBg: '#EEF2FF',
      iconColor: '#4F46E5',
      description:
        'View and download 100% completed First Piece Setup Approval Reports (Form F02), including Product Quality Parameters & Process Parameters (RPM, Feed Rate, Tooling, Coolant).',
      details: ['Official Setup Approval PDF Exports', 'Product & Process Parameter Logs', 'Date, Machine & Part Archive'],
      actionText: 'Open Setup Approval Reports',
      link: '/reports/setup-approval',
      disabled: false,
    },
  ];

  return (
    <>
      <Header
        title="Reports"
        subtitle="Select a report option below to access live station monitoring or historical quality inspection records"
      />

      <div className="page-content bg-gradient-animated" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '24px',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          {reportCards.map((card) => {
            const CardIcon = card.icon;
            const isDisabled = card.disabled || !card.link;

            return (
              <div
                key={card.id}
                className="card"
                onClick={() => {
                  if (!isDisabled) navigate(card.link);
                }}
                style={{
                  background: isDisabled ? '#FAFBFD' : '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: isDisabled ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                  cursor: isDisabled ? 'default' : 'pointer',
                  opacity: isDisabled ? 0.75 : 1,
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.borderColor = '#CBD5E1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }
                }}
              >
                <div>
                  {/* Top Badge & Icon */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        background: card.iconBg,
                        color: card.iconColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CardIcon size={24} />
                    </div>

                    <span
                      style={{
                        background: card.badgeBg,
                        color: card.badgeColor,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: card.badgeColor,
                        }}
                      />
                      {card.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E293B', marginBottom: '24px' }}>
                    {card.title}
                  </h3>
                </div>

                {/* Bottom Action Button */}
                <div
                  style={{
                    paddingTop: '16px',
                    borderTop: '1px solid #F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: card.iconColor }}>
                    {card.actionText}
                  </span>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: card.iconBg,
                      color: card.iconColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ArrowRight size={16} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
