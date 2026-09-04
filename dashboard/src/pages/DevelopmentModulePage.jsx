import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sliders, Cpu, FileCode, CheckSquare, Layers, Sparkles } from 'lucide-react';

export default function DevelopmentModulePage() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: '#ffffff',
        marginBottom: '28px',
        boxShadow: '0 10px 25px -5px rgba(168, 85, 247, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <Cpu size={32} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Development Module</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '15px', maxWidth: '600px' }}>
            Process Engineering & Development — Master Parameter Sheets, APQP/PPAP New Part Trials & Drawing Revisions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <NavLink to="/parameters" style={{
            background: '#ffffff',
            color: '#7c3aed',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: '700',
            textDecoration: 'none',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            Master Parameters Database
          </NavLink>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Defined Master Parameters</span>
            <Sliders size={22} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>128</div>
          <span style={{ color: '#64748b', fontSize: '13px' }}>Across all active part templates</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Active Development Parts</span>
            <Layers size={22} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>6</div>
          <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '600' }}>New Part Samples in Trial</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>PPAP Approved Sign-offs</span>
            <CheckSquare size={22} color="#10b981" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>100%</div>
          <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>Level 3 Submissions</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Engineering Changes (ECN)</span>
            <Sparkles size={22} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>2</div>
          <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>Revision 03 in Review</span>
        </div>
      </div>

      {/* Quick Navigation Sections */}
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Development Tools & Master Data</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <NavLink to="/parameters" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '14px', transition: 'all 0.2s ease', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ background: '#f3e8ff', padding: '12px', borderRadius: '10px' }}>
                <Sliders size={24} color="#7c3aed" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Master Parameters Management</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Nominals, Tolerances & Evaluation Gauges</span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
              Define product quality characteristics, nominal values, upper/lower tolerances, and process parameters for part templates.
            </p>
          </div>
        </NavLink>

        <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '10px' }}>
              <FileCode size={24} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Engineering Change Notices (ECN)</h3>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Drawing Revisions & Re-evaluations</span>
            </div>
          </div>
          <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
            Track engineering drawing revisions, tolerance updates, and update active inspection templates seamlessly.
          </p>
        </div>
      </div>
    </div>
  );
}
