import React from 'react';

interface RoleAvatarProps {
  role: 'student' | 'faculty' | 'admin';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const RoleAvatar: React.FC<RoleAvatarProps> = ({ role, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const imageSrc = `/avatars/${role}.png?v=3`;

  return (
    <div className={`rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${sizeClasses[size]} ${className}`}>
      <img src={imageSrc} alt={`${role} avatar`} className="w-full h-full object-cover" />
    </div>
  );
};
