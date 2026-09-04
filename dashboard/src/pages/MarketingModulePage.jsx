import React from 'react';
import { TrendingUp, PackageCheck, Award, MessageSquare, AlertCircle, ShoppingBag } from 'lucide-react';

export default function MarketingModulePage() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #c026d3 0%, #e879f9 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: '#ffffff',
        marginBottom: '28px',
        boxShadow: '0 10px 25px -5px rgba(232, 121, 249, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <TrendingUp size={32} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Marketing Module</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '15px', maxWidth: '600px' }}>
            Sales & Customer Quality — Dispatch Quality Releases (PDI), Customer Quality Ratings, RMA Resolution & Order Compliance.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #c026d3' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Customer Quality Rating</span>
            <Award size={22} color="#c026d3" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>100%</div>
          <span style={{ color: '#c026d3', fontSize: '13px', fontWeight: '600' }}>Zero Field Complaints</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Dispatched Batches Released</span>
            <PackageCheck size={22} color="#10b981" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>84</div>
          <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>Full Quality Certificate (PDI)</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>On-Time Delivery (OTD)</span>
            <ShoppingBag size={22} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>98.6%</div>
          <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '600' }}>Monthly Shipping Target</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Customer Feedback Score</span>
            <MessageSquare size={22} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>4.9 / 5.0</div>
          <span style={{ color: '#f59e0b', fontSize: '13px' }}>Client Satisfaction Audit</span>
        </div>
      </div>

      {/* Quick Navigation Sections */}
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Marketing & Customer Features</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{ background: '#fae8ff', padding: '12px', borderRadius: '10px' }}>
              <PackageCheck size={24} color="#c026d3" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Pre-Dispatch Inspection (PDI)</h3>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Quality Certificates for Customer Orders</span>
            </div>
          </div>
          <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
            Generate final inspection release certificates and Form F02 quality dossiers for customer shipments.
          </p>
        </div>

        <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '10px' }}>
              <MessageSquare size={24} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Customer Feedback & Audits</h3>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Client Quality Compliance</span>
            </div>
          </div>
          <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
            Monitor client quality portal submissions, audit reports, and customer satisfaction metrics.
          </p>
        </div>
      </div>
    </div>
  );
}
