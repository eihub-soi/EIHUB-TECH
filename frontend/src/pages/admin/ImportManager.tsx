import React from 'react';
import { ComponentImport } from '../../components/import/ComponentImport';

export const ImportManager: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-auto">
      <ComponentImport />
    </div>
  );
};
