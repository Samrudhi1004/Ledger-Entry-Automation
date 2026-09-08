import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCompanyDetails } from '../api/company';
import { useAuth } from './AuthContext';

const CompanyContext = createContext();

export const useCompany = () => {
  return useContext(CompanyContext);
};

export const CompanyProvider = ({ children }) => {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState('MANTRI METALLICS PVT. LTD.');
  const [companyCode, setCompanyCode] = useState('MMPL');

  const fetchCompany = useCallback(() => {
    let mounted = true;
    getCompanyDetails()
      .then((res) => {
        if (!mounted) return;
        const compData = res?.data?.results || res?.data;
        if (compData && compData.length > 0) {
          const primary = compData[0];
          setCompanyName(primary.name || 'MANTRI METALLICS PVT. LTD.');
          setCompanyCode(primary.code || 'MMPL');
        }
      })
      .catch((err) => {
        console.error("Failed to load company details:", err);
      });
    return () => { mounted = false; };
  }, []);

  // Only fetch after the user is authenticated
  useEffect(() => {
    if (!user) return;
    const cleanup = fetchCompany();
    return cleanup;
  }, [user, fetchCompany]);

  return (
    <CompanyContext.Provider value={{ companyName, companyCode, refreshCompany: fetchCompany }}>
      {children}
    </CompanyContext.Provider>
  );
};
