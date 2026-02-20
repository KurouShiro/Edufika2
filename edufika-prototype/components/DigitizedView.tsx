
import React from 'react';

export const DigitizedView: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="min-h-screen w-full animate-reconstruct">{children}</div>;
};
