import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, Activity, BarChart3, ListFilter } from 'lucide-react';

export default function QAModulePage() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: '#ffffff',
        marginBottom: '28px',
        boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <ShieldCheck size={32} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>QA Module</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '15px', maxWidth: '600px' }}>
            Quality Assurance Hub — First Piece Setup Approvals, Form F02 Inspection Ledgers, Parameter Audits & Defect Analytics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <NavLink to="/reports/setup-approval" style={{
            background: '#ffffff',
            color: '#1e3a8a',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: '700',
            textDecoration: 'none',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            1st Piece Setup Reports
          </NavLink>
          <NavLink to="/reports" style={{
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: '700',
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            Reports Hub
          </NavLink>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>First Time Pass Rate</span>
            <CheckCircle2 size={22} color="#10b981" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>98.4%</div>
          <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>↑ +1.2% this week</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Total F02 Reports</span>
            <FileText size={22} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>1,248</div>
          <span style={{ color: '#64748b', fontSize: '13px' }}>Shift A & B recorded</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Pending Approvals</span>
            <Activity size={22} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>3</div>
          <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>Requires Supervisor Review</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>OOC Parameters Flagged</span>
            <AlertTriangle size={22} color="#ef4444" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>2</div>
          <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: '600' }}>Active alerts on VMC-02</span>
        </div>
      </div>

      {/* Quick Navigation Sections */}
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>QA Workflows & Reports</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <NavLink to="/reports/setup-approval" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '14px', transition: 'all 0.2s ease', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '10px' }}>
                <ShieldCheck size={24} color="#2563eb" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>1st Piece Setup Approval</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Form F02 Setup Parameter Verification</span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
              Review process parameters (RPM, Feed Rate, Tooling) and 3-piece trial measurements submitted by inspectors.
            </p>
          </div>
        </NavLink>

        <NavLink to="/reports/daily-production" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '14px', transition: 'all 0.2s ease', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '10px' }}>
                <FileText size={24} color="#10b981" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Daily Production QA Reports</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Completed Quality Ledgers</span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
              Access 100% completed Form F02 daily inspection sheets, supervisor approvals, and date-wise PDF downloads.
            </p>
          </div>
        </NavLink>

        <NavLink to="/inspections" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '14px', transition: 'all 0.2s ease', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '10px' }}>
                <ListFilter size={24} color="#d97706" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Live Inspection Monitor</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Active Machine Sessions</span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
              Track real-time hourly inspection entries, voice recordings, and live parameter inputs on active shopfloor machines.
            </p>
          </div>
        </NavLink>

        <NavLink to="/analytics" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '14px', transition: 'all 0.2s ease', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ background: '#f3e8ff', padding: '12px', borderRadius: '10px' }}>
                <BarChart3 size={24} color="#9333ea" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Quality Analytics & SPC</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Trend Analysis & Control Charts</span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
              Analyze parameter trends, Cp/Cpk process capability, defect Pareto charts, and machine-wise quality rankings.
            </p>
          </div>
        </NavLink>
      </div>
    </div>
  );
}
