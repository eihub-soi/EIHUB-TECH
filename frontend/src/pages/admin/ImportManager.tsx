import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ComponentImport } from '../../components/import/ComponentImport';
import { PurchaseBillImport } from '../../components/import/PurchaseBillImport';
import { FileText, FileSpreadsheet, Sparkles } from 'lucide-react';

export const ImportManager: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'csv' ? 'csv' : 'ocr';
  const [activeTab, setActiveTab] = useState<'ocr' | 'csv'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'csv' || tabParam === 'ocr') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'ocr' | 'csv') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50/50">
      {/* Top Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-8 pt-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => handleTabChange('ocr')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'ocr'
                ? 'border-sky-600 text-sky-700 bg-sky-50/40'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4 text-sky-600" />
            <span>Smart Purchase Bill (OCR)</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800">
              <Sparkles className="w-2.5 h-2.5" /> OCR
            </span>
          </button>

          <button
            onClick={() => handleTabChange('csv')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'csv'
                ? 'border-sky-600 text-sky-700 bg-sky-50/40'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Bulk Components (CSV / Excel)</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'ocr' ? (
          <PurchaseBillImport />
        ) : (
          <ComponentImport />
        )}
      </div>
    </div>
  );
};
