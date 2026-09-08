import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCompanyDetails } from '../api/company';

const CompanyContext = createContext();

export const useCompany = () => {
  return useContext(CompanyContext);
};

export const CompanyProvider = ({ children }) => {
  const [companyName, setCompanyName] = useState('MANTRI METALLICS PVT. LTD.');
  const [companyCode, setCompanyCode] = useState('MMPL');

  useEffect(() => {
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

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <CompanyContext.Provider value={{ companyName, companyCode }}>
      {children}
    </CompanyContext.Provider>
  );
};
