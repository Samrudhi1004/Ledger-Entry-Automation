import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Sliders, 
  Cpu, 
  FileCode, 
  CheckSquare, 
  Layers, 
  Sparkles, 
  ArrowRight,
  Settings,
  FileSpreadsheet,
  FolderGit2,
  ShieldCheck
} from 'lucide-react';

export default function DevelopmentModulePage() {
  const cards = [
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
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #a855f7 100%)',
        borderRadius: '16px',
        padding: '32px',
        color: '#ffffff',
        marginBottom: '28px',
        boxShadow: '0 12px 28px -6px rgba(124, 58, 237, 0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.22)', padding: '12px', borderRadius: '14px', backdropFilter: 'blur(8px)' }}>
              <Cpu size={32} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Development & Engineering Module</h1>
              <span style={{ fontSize: '13px', opacity: 0.85, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Process Engineering Hub</span>
            </div>
          </div>
          <p style={{ margin: 0, opacity: 0.92, fontSize: '15px', maxWidth: '680px', lineHeight: '1.5' }}>
            Centralized hub for Process Engineering — Manage Master Parameter Sheets, APQP/PPAP New Part Trials, Drawing Revisions, and Inspection Control Plans.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <NavLink to="/parameters" style={{
            background: '#ffffff',
            color: '#6d28d9',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: '700',
            textDecoration: 'none',
            fontSize: '14px',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'transform 0.18s ease'
          }}>
            <Sliders size={18} />
            <span>Master Parameters Sheet</span>
          </NavLink>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #7c3aed', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '13px' }}>Master Parameters</span>
            <Sliders size={20} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>128</div>
          <span style={{ color: '#64748b', fontSize: '12px' }}>Across active part templates</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #2563eb', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '13px' }}>Development Parts</span>
            <Layers size={20} color="#2563eb" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>6</div>
          <span style={{ color: '#2563eb', fontSize: '12px', fontWeight: '600' }}>New Part Samples in Trial</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #10b981', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '13px' }}>PPAP Approvals</span>
            <CheckSquare size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>100%</div>
          <span style={{ color: '#10b981', fontSize: '12px', fontWeight: '600' }}>Level 3 Submissions</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #f59e0b', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '13px' }}>ECN Revisions</span>
            <Sparkles size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>2</div>
          <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '600' }}>Rev 03 Pending Review</span>
        </div>
      </div>

      {/* Main Card Grid */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Development Tools & Master Parameter Grid</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 20px 0' }}>
          Select a master module card below to configure engineering specs, master parameter sheets, or trial inspection plans.
        </p>
      </div>

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
                  border: card.primary ? '2px solid rgba(124, 58, 237, 0.3)' : '1px solid #e2e8f0',
                  boxShadow: card.primary ? '0 10px 25px -5px rgba(124, 58, 237, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.22s ease',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = '#7c3aed';
                  e.currentTarget.style.boxShadow = '0 14px 28px -6px rgba(124, 58, 237, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = card.primary ? 'rgba(124, 58, 237, 0.3)' : '#e2e8f0';
                  e.currentTarget.style.boxShadow = card.primary ? '0 10px 25px -5px rgba(124, 58, 237, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.04)';
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
                  justify: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: card.iconColor }}>
                    {card.primary ? 'Open Master Parameters Sheet' : 'Open Module Tools'}
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
  );
}
