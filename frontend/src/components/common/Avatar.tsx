import React, { useState, useEffect } from "react";
import { getAvatarUrl } from "../../utils/avatar";

interface AvatarProps {
  user?: any; // accepts user profile/object
  size?: "sm" | "md" | "lg" | "xl" | string; // size preset or custom class name
  className?: string; // extra custom classes
  alt?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  user,
  size = "md",
  className = "",
  alt = "User Avatar",
}) => {
  const getFallback = () => getAvatarUrl({ role: user?.role });
  const [src, setSrc] = useState<string>(() => getAvatarUrl(user));

  // Keep src in sync with user changes
  useEffect(() => {
    setSrc(getAvatarUrl(user));
  }, [user]);

  const handleError = () => {
    const fallback = getFallback();
    if (src !== fallback) {
      setSrc(fallback);
    }
  };

  // Determine size classes
  let sizeClass = "";
  if (size === "sm") sizeClass = "w-8 h-8";
  else if (size === "md") sizeClass = "w-10 h-10";
  else if (size === "lg")
    sizeClass = "w-14 h-14"; // 56px
  else if (size === "xl")
    sizeClass = "w-20 h-20"; // 80px
  else sizeClass = size; // custom size class

  return (
    <img
      src={src || getFallback()}
      alt={alt}
      onError={handleError}
      className={`rounded-full object-cover flex-shrink-0 border border-[#E5E7EB] ${sizeClass} ${className}`}
    />
  );
};
