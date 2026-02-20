
import React from 'react';

interface Props {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'outline';
  className?: string;
}

const TerminalButton: React.FC<Props> = ({ onClick, children, variant = 'primary', className = '' }) => {
  const baseStyle = "px-6 py-3 rounded-none font-bold uppercase tracking-widest transition-all duration-200 border transform active:scale-95";
  
  const variants = {
    primary: "bg-[#39ff14] text-black border-[#39ff14] hover:bg-black hover:text-[#39ff14]",
    danger: "bg-red-600 text-white border-red-600 hover:bg-black hover:text-red-600",
    outline: "bg-transparent text-[#39ff14] border-[#39ff14] hover:bg-[#39ff14] hover:text-black",
  };

  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export default TerminalButton;
