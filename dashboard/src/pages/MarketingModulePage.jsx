import React from 'react';
import Header from '../components/layout/Header';
import { TrendingUp } from 'lucide-react';

export default function MarketingModulePage() {
  return (
    <>
      <Header
        title="Marketing"
        subtitle="Sales & Customer Quality Management"
      />

      <div className="page-content" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div 
          className="card" 
          style={{ 
            padding: '48px', 
            borderRadius: '16px', 
            textAlign: 'center', 
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            minHeight: '350px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ background: '#fae8ff', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
            <TrendingUp size={36} color="#c026d3" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
            Marketing Module
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '450px', margin: 0 }}>
            This module is ready for future sub-modules, Pre-Dispatch Inspection (PDI) releases, customer satisfaction audits, and sales quality compliance.
          </p>
        </div>
      </div>
    </>
  );
}
