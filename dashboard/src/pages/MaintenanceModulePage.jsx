import React from 'react';
import { NavLink } from 'react-router-dom';
import { Wrench, AlertTriangle, CheckCircle, Activity, Gauge, Clock, Factory } from 'lucide-react';

export default function MaintenanceModulePage() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: '#ffffff',
        marginBottom: '28px',
        boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <Wrench size={32} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Maintenance Module</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '15px', maxWidth: '600px' }}>
            Plant & Machine Maintenance — Downtime Analysis, Machine Health Monitoring, Preventive Maintenance (PM) & Breakdown Logs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <NavLink to="/machines" style={{
            background: '#ffffff',
            color: '#b91c1c',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: '700',
            textDecoration: 'none',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            Machines Fleet
          </NavLink>
          <NavLink to="/reports/downtime" style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: '700',
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            Downtime Reports
          </NavLink>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Machine Uptime Rate</span>
            <CheckCircle size={22} color="#10b981" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>96.8%</div>
          <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>Target: &gt; 95%</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Total Downtime Today</span>
            <Clock size={22} color="#ef4444" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>45 min</div>
          <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: '600' }}>VMC-03 Spindle Check</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Pending PM Due</span>
            <Wrench size={22} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>2</div>
          <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>Scheduled for Shift B</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>MTBF (Mean Time Between Failure)</span>
            <Activity size={22} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>148 hrs</div>
          <span style={{ color: '#64748b', fontSize: '13px' }}>Monthly Average</span>
        </div>
      </div>

      {/* Quick Navigation Sections */}
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Maintenance Tools & Reports</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <NavLink to="/machines" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '14px', transition: 'all 0.2s ease', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '10px' }}>
                <Factory size={24} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Machines Fleet & Status</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Shopfloor Machine Live Grid</span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
              View all shopfloor CNC/VMC machines, live operational status, active operator sessions, and machine specifications.
            </p>
          </div>
        </NavLink>

        <NavLink to="/reports/downtime" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '14px', transition: 'all 0.2s ease', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ background: '#fff7ed', padding: '12px', borderRadius: '10px' }}>
                <AlertTriangle size={24} color="#f97316" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Downtime Reports & Analysis</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Breakdown & Stop Reasons</span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
              Analyze machine downtime logs, root causes (Mechanical, Electrical, Tooling), and total lost production hours.
            </p>
          </div>
        </NavLink>
      </div>
    </div>
  );
}
