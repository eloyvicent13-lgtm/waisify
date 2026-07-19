import TrackPlayer, { Event } from 'react-native-track-player';

// The playback service runs registered against AppRegistry, separate from
// the React tree, so it can't reach PlaybackContext directly. _layout.tsx
// wires up real handlers here (via refs, so they're always the latest
// version of playNext/playPrev regardless of render timing).
type RemoteHandlers = {
  onNext: () => void;
  onPrevious: () => void;
};

let handlers: RemoteHandlers = { onNext: () => {}, onPrevious: () => {} };

export function setRemoteHandlers(h: RemoteHandlers) {
  handlers = h;
}

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => handlers.onNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => handlers.onPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    TrackPlayer.seekTo(event.position);
  });
}
