import { Profile } from "../types";

/**
 * Returns the correct cropped avatar URL based on the user's role or custom avatar URL.
 */
export const getAvatarUrl = (
  user?: Profile | null | { avatar_url?: string; role?: string },
): string => {
  if (!user) return "/avatars/student.png?v=2";

  // Exclude placeholder Unsplash images that were seeded initially
  const hasCustomAvatar =
    user.avatar_url &&
    !user.avatar_url.includes("unsplash.com") &&
    (user.avatar_url.startsWith("/") || user.avatar_url.startsWith("http"));

  if (hasCustomAvatar) {
    return user.avatar_url!;
  }

  // Dynamic role fallback
  if (user.role === "admin") return "/avatars/admin.png?v=2";
  if (user.role === "faculty") return "/avatars/faculty.png?v=2";
  return "/avatars/student.png?v=2";
};
