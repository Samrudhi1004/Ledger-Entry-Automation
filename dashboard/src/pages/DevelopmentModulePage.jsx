import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FileCode, 
  ArrowRight,
  FileSpreadsheet,
  Sliders
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Header from '../components/layout/Header';
import Breadcrumbs from '../components/layout/Breadcrumbs';

export default function DevelopmentModulePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const adminCards = [
    {
      title: 'Drawing Management',
      subtitle: 'CAD / PDF Drawings & Revision History',
      description: 'Upload engineering drawings, link files to active part numbers or general files, and manage complete revision history logs.',
      icon: FileCode,
      iconBg: 'rgba(79, 70, 229, 0.12)',
      iconColor: '#4f46e5',
      to: '/development/drawings',
      badge: 'Admin Tool',
      badgeBg: '#e0e7ff',
      badgeColor: '#4f46e5',
      primary: true,
      actionText: 'Manage Drawings & Revision History'
    },
    {
      title: 'Control Plan Management',
      subtitle: 'Process Control Plans & Quality Specs',
      description: 'Upload process control plan documents, link to part numbers or general engineering files, and inspect version history logs.',
      icon: FileSpreadsheet,
      iconBg: 'rgba(16, 185, 129, 0.12)',
      iconColor: '#059669',
      to: '/development/control-plans',
      badge: 'Admin Tool',
      badgeBg: '#d1fae5',
      badgeColor: '#059669',
      primary: false,
      actionText: 'Manage Control Plans & Version History'
    },
  ];

  const supervisorCards = [
    {
      title: 'Master Parameters Management',
      subtitle: 'Nominals, Tolerances & Evaluation Gauges',
      description: 'Define product quality characteristics, nominal values, upper/lower tolerances, control methods, and process parameters for active part templates.',
      icon: Sliders,
      iconBg: 'rgba(124, 58, 237, 0.12)',
      iconColor: '#7c3aed',
      to: '/parameters',
      badge: 'Active Database',
      badgeBg: '#f3e8ff',
      badgeColor: '#7c3aed',
      primary: true,
      actionText: 'Open Master Parameters Sheet'
    },
  ];

  const cards = isAdmin ? adminCards : supervisorCards;

  return (
    <>
      <Header
        title="Development"
        subtitle={isAdmin 
          ? 'Engineering Repository, CAD Drawings & Process Control Plans' 
          : 'Development Tools & Master Parameter Grid'
        }
      />

      <div className="page-content bg-gradient-animated">
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Breadcrumbs items={[{ label: 'Development' }]} />
        {/* Main Card Grid Heading */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            {isAdmin ? 'Engineering Repository & Control Plan Grid' : 'Development Tools & Master Parameter Grid'}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 20px 0' }}>
            {isAdmin 
              ? 'Select an engineering module card below to manage drawings, process control plans, or inspect revision histories.'
              : 'Select a master module card below to configure engineering specs, master parameter sheets, or trial inspection plans.'
            }
          </p>
        </div>

      {/* Card Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
        gap: '24px' 
      }}>
        {cards.map((card, idx) => {
          const CardIcon = card.icon;
          return (
            <NavLink 
              key={idx} 
              to={card.to} 
              style={{ textDecoration: 'none' }}
            >
              <div 
                className="card"
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: '#ffffff',
                  border: card.primary ? '2px solid rgba(79, 70, 229, 0.3)' : '1px solid #e2e8f0',
                  boxShadow: card.primary ? '0 10px 25px -5px rgba(79, 70, 229, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.22s ease',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = card.iconColor;
                  e.currentTarget.style.boxShadow = `0 14px 28px -6px ${card.iconBg}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = card.primary ? 'rgba(79, 70, 229, 0.3)' : '#e2e8f0';
                  e.currentTarget.style.boxShadow = card.primary ? '0 10px 25px -5px rgba(79, 70, 229, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.04)';
                }}
              >
                <div>
                  {/* Top Bar inside Card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ 
                      background: card.iconBg, 
                      padding: '14px', 
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CardIcon size={26} color={card.iconColor} />
                    </div>

                    <span style={{ 
                      background: card.badgeBg, 
                      color: card.badgeColor, 
                      fontSize: '12px', 
                      fontWeight: '700', 
                      padding: '4px 10px', 
                      borderRadius: '20px',
                      letterSpacing: '0.3px'
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

                  <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
                    {card.description}
                  </p>
                </div>

                {/* Footer Action */}
                <div style={{ 
                  marginTop: '20px', 
                  paddingTop: '16px', 
                  borderTop: '1px solid #f1f5f9', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: card.iconColor }}>
                    {card.actionText}
                  </span>
                  <div style={{ 
                    background: card.iconBg, 
                    borderRadius: '50%', 
                    width: '32px', 
                    height: '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justify: 'center' 
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
      </div>
    </>
  );
}
