import type { ImageSourcePropType } from 'react-native';

const MALE_AVATAR = require('@/assets/images/default-avatar-male.png');
const FEMALE_AVATAR = require('@/assets/images/default-avatar-female.png');

/**
 * Placeholder shown for a user with no profile photo. Female users get the
 * female artwork; everyone else (male, other, or gender not known) gets the
 * male one.
 */
export function defaultAvatar(gender?: string | null): ImageSourcePropType {
  return gender?.toLowerCase() === 'female' ? FEMALE_AVATAR : MALE_AVATAR;
}

/** The user's photo when they have one, otherwise the default avatar. */
export function avatarSource(uri: string | null | undefined, gender?: string | null): ImageSourcePropType {
  return uri ? { uri } : defaultAvatar(gender);
}
