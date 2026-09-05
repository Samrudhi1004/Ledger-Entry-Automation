import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, Calendar, ArrowRight, UserCheck, Shield, Award } from 'lucide-react';

export default function HRModulePage() {
  const cards = [
    {
      title: 'Users & Operators Roster',
      subtitle: 'Employee Directory & Account Credentials',
      description: 'Manage accounts for Supervisors, Quality Inspectors, Gauge Calibrators, and Machine Operators. Add new users, edit employee IDs, reset passwords, and manage permissions.',
      icon: Users,
      iconBg: 'rgba(79, 70, 229, 0.12)',
      iconColor: '#4f46e5',
      to: '/users',
      badge: 'Active Directory',
      badgeBg: '#eef2ff',
      badgeColor: '#4f46e5',
      actionText: 'Manage Users & Operators',
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #4338ca 0%, #4f46e5 50%, #6366f1 100%)',
        borderRadius: '16px',
        padding: '32px',
        color: '#ffffff',
        marginBottom: '28px',
        boxShadow: '0 12px 28px -6px rgba(79, 70, 229, 0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.22)', padding: '12px', borderRadius: '14px', backdropFilter: 'blur(8px)' }}>
              <Users size={32} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>HR & Personnel Module</h1>
              <span style={{ fontSize: '13px', opacity: 0.85, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Human Resources Management</span>
            </div>
          </div>
          <p style={{ margin: 0, opacity: 0.92, fontSize: '15px', maxWidth: '680px', lineHeight: '1.5' }}>
            Central Human Resources Portal — Manage User Accounts, Operator Rosters, Employee Credentials, and Factory Shift Timings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <NavLink to="/users" style={{
            background: '#ffffff',
            color: '#4f46e5',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: '700',
            textDecoration: 'none',
            fontSize: '14px',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Users size={18} />
            <span>Users Registry</span>
          </NavLink>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #4f46e5', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '13px' }}>Active Workforce</span>
            <Users size={20} color="#4f46e5" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>42</div>
          <span style={{ color: '#64748b', fontSize: '12px' }}>Operators, Inspectors & Admins</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #10b981', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '13px' }}>On-Duty Operators</span>
            <UserCheck size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>18</div>
          <span style={{ color: '#10b981', fontSize: '12px', fontWeight: '600' }}>Shift A Active</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #8b5cf6', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '13px' }}>Quality Inspectors</span>
            <Shield size={20} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>6</div>
          <span style={{ color: '#8b5cf6', fontSize: '12px', fontWeight: '600' }}>Certified Inspectors</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #f59e0b', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '13px' }}>Shift Compliance Rate</span>
            <Award size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>99.1%</div>
          <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '600' }}>Attendance & Login Score</span>
        </div>
      </div>

      {/* Main 2-Card Grid Section */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>HR Management Modules</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 20px 0' }}>
          Select a management module below to access the user account directory or configure factory shift schedules.
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', 
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
                  padding: '28px',
                  borderRadius: '16px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.22s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = card.iconColor;
                  e.currentTarget.style.boxShadow = '0 14px 28px -6px rgba(79, 70, 229, 0.18)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.04)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                    <div style={{ 
                      background: card.iconBg, 
                      padding: '14px', 
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CardIcon size={28} color={card.iconColor} />
                    </div>

                    <span style={{ 
                      background: card.badgeBg, 
                      color: card.badgeColor, 
                      fontSize: '12px', 
                      fontWeight: '700', 
                      padding: '5px 12px', 
                      borderRadius: '20px',
                      letterSpacing: '0.3px'
                    }}>
                      {card.badge}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                    {card.title}
                  </h3>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '14px' }}>
                    {card.subtitle}
                  </span>

                  <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                    {card.description}
                  </p>
                </div>

                <div style={{ 
                  marginTop: '24px', 
                  paddingTop: '18px', 
                  borderTop: '1px solid #f1f5f9', 
                  display: 'flex', 
                  justify: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: card.iconColor }}>
                    {card.actionText}
                  </span>
                  <div style={{ 
                    background: card.iconBg, 
                    borderRadius: '50%', 
                    width: '36px', 
                    height: '36px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justify: 'center' 
                  }}>
                    <ArrowRight size={18} color={card.iconColor} />
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
