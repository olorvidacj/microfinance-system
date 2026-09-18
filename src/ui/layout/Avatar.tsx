import React, { useState } from 'react';

const getInitials = (name?: string) =>
  (name || 'U')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 36, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!src || failed) {
    return (
      <div
        style={style}
        title={name}
        className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 font-bold text-navy-950 shadow-sm ${className}`}
      >
        <span className="text-xs">{getInitials(name)}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || 'Avatar'}
      style={style}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ring-1 ring-navy-700 ${className}`}
    />
  );
};

export default Avatar;
