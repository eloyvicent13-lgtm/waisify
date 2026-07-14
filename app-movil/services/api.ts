import axios from 'axios';

const API_BASE_URL = 'http://149.202.84.78:8150';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }
  return config;
});

export interface Track {
  id: string;
  source: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  youtubeId?: string;
}

export interface Playlist {
  id: number;
  user_id: number;
  name: string;
}
