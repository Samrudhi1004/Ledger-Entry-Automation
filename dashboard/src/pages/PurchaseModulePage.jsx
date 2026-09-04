import React from 'react';
import { ShoppingCart, Package, Truck, Clock, AlertCircle, FileCheck } from 'lucide-react';

export default function PurchaseModulePage() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: '#ffffff',
        marginBottom: '28px',
        boxShadow: '0 10px 25px -5px rgba(20, 184, 166, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <ShoppingCart size={32} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Purchase Module</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '15px', maxWidth: '600px' }}>
            Procurement & Purchasing — Raw Material Requisitions, Tooling Orders, Vendor Quality Tracking & Inventory Management.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #0d9488' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Active Purchase Orders</span>
            <ShoppingCart size={22} color="#0d9488" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>14</div>
          <span style={{ color: '#64748b', fontSize: '13px' }}>Raw Material & Tooling POs</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Pending Approvals</span>
            <Clock size={22} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>3</div>
          <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>Requisitions awaiting sign-off</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Supplier Quality Index</span>
            <FileCheck size={22} color="#10b981" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>99.2%</div>
          <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>Inward Material Pass Rate</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '5px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Expected Deliveries</span>
            <Truck size={22} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>5</div>
          <span style={{ color: '#64748b', fontSize: '13px' }}>Arriving within 48 Hours</span>
        </div>
      </div>

      {/* Quick Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{ background: '#ccfbf1', padding: '12px', borderRadius: '10px' }}>
              <Package size={24} color="#0d9488" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Tooling & Gauge Requisitions</h3>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Vernier Calipers, Micrometers & Inserts</span>
            </div>
          </div>
          <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
            Manage purchase requisitions for inspection gauges, CNC cutting inserts, and critical tooling spare parts.
          </p>
        </div>

        <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '10px' }}>
              <Truck size={24} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Vendor Quality & Ratings</h3>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Raw Material Supplier Audit</span>
            </div>
          </div>
          <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
            Track vendor rejection PPM rates, raw material certificate compliance, and delivery performance scores.
          </p>
        </div>
      </div>
    </div>
  );
}
