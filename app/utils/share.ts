import { Share } from 'react-native';

// One web link per share (chat apps make those tappable; custom schemes they
// don't). With the app installed Android opens it straight in the app — see
// the https intent filter in app.json and raralive.in/.well-known/assetlinks.json.
// Without the app, raralive.in sends the visitor on to Google Play.
const SITE = 'https://raralive.in';

function share(lines: string[]) {
  Share.share({ message: lines.join('\n') }).catch(() => {});
}

export function shareProfile(user: { id: string; name: string }) {
  share([`Check out ${user.name} on Rara Live`, `${SITE}/user/${user.id}`]);
}

/** Room code (RM-…) when known — the app resolves either a code or an id. */
export function shareRoom(room: { idOrCode: string; name: string }) {
  share([`Join me in "${room.name}" on Rara Live`, `${SITE}/room/${encodeURIComponent(room.idOrCode)}`]);
}

export function sharePost(post: { id: string; authorName: string; caption?: string | null }) {
  const caption = post.caption?.trim();
  const preview = caption ? `\n"${caption.length > 80 ? `${caption.slice(0, 80)}…` : caption}"` : '';
  share([`${post.authorName}'s post on Rara Live${preview}`, `${SITE}/post/${post.id}`]);
}
