import 'expo-router/entry';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './services/trackPlayerService';

TrackPlayer.registerPlaybackService(() => PlaybackService);
