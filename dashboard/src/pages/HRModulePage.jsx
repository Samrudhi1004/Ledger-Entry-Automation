import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, UserCheck, Shield, Calendar, Award, UserPlus } from 'lucide-react';

export default function HRModulePage() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: '#ffffff',
        marginBottom: '28px',
        boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <Users size={32} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>HR Module</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '15px', maxWidth: '600px' }}>
            Human Resources Management — Operator & Inspector Roster, Role Permissions, Shift Allocation & Skill Matrix.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <NavLink to="/users" style={{
            background: '#ffffff',
            color: '#4f46e5',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: '700',
            textDecoration: 'none',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            Manage Users & Roster
          </NavLink>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Active Workforce</span>
            <Users size={22} color="#4f46e5" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>42</div>
          <span style={{ color: '#64748b', fontSize: '13px' }}>Operators, Inspectors & Admins</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>On-Duty Operators</span>
            <UserCheck size={22} color="#10b981" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>18</div>
          <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>Shift A Active</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Quality Inspectors</span>
            <Shield size={22} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>6</div>
          <span style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: '600' }}>Certified Inspectors</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Shift Compliance Rate</span>
            <Award size={22} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>99.1%</div>
          <span style={{ color: '#f59e0b', fontSize: '13px' }}>Attendance & Login Score</span>
        </div>
      </div>

      {/* Quick Navigation Sections */}
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>HR Features & Management</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <NavLink to="/users" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '14px', transition: 'all 0.2s ease', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ background: '#eef2ff', padding: '12px', borderRadius: '10px' }}>
                <Users size={24} color="#4f46e5" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Users & Operators Roster</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Employee Directory & Passwords</span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
              Add new shopfloor operators, quality inspectors, calibrate role permissions, and manage user access credentials.
            </p>
          </div>
        </NavLink>

        <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '10px' }}>
              <Calendar size={24} color="#10b981" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Shift Schedule & Allocation</h3>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Shift A / B Roster Planner</span>
            </div>
          </div>
          <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
            Assign machine operators and quality supervisors across 8-hour and 12-hour factory shifts.
          </p>
        </div>
      </div>
    </div>
  );
}
