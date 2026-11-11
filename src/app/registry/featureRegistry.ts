import type { Component } from 'svelte';
import {
  Layers,
  Music2,
  Sparkles,
  UploadCloud,
  Type,
  FileText,
  ListMusic,
  Download,
  Zap,
} from '@lucide/svelte';

import { BackdropPanel } from '../../features/backdrop';
import { SpectrumPanel } from '../../features/spectrum';
import { ParticlesPanel } from '../../features/particles';
import { OverlaysPanel } from '../../features/overlays';
import { TextsPanel } from '../../features/texts';
import { LyricsPanel } from '../../features/lyrics';
import { TracklistPanel } from '../../features/tracklist';
import { ExportPanel } from '../../features/export';

export interface FeatureMenuItem {
  id: string;
  label: string;
  headerTitle: string;
  icon: any;
  component: any;
}

export const featureRegistry: FeatureMenuItem[] = [
  {
    id: 'background',
    label: 'Backdrop',
    headerTitle: 'Background Layer',
    icon: Layers,
    component: BackdropPanel,
  },
  {
    id: 'spectrum',
    label: 'Spectrum',
    headerTitle: 'Audio Spectrum',
    icon: Music2,
    component: SpectrumPanel,
  },
  {
    id: 'particles',
    label: 'Particles',
    headerTitle: 'Particle Effects',
    icon: Sparkles,
    component: ParticlesPanel,
  },
  {
    id: 'images',
    label: 'Overlays',
    headerTitle: 'Image & Video Overlays',
    icon: UploadCloud,
    component: OverlaysPanel,
  },
  {
    id: 'texts',
    label: 'Texts',
    headerTitle: 'Text Overlays',
    icon: Type,
    component: TextsPanel,
  },
  {
    id: 'lyrics',
    label: 'Lyrics',
    headerTitle: 'Lyric Style & Typography',
    icon: FileText,
    component: LyricsPanel,
  },
  {
    id: 'tracklist-overlay',
    label: 'Tracklist',
    headerTitle: 'Tracklist Overlay & Now Playing',
    icon: ListMusic,
    component: TracklistPanel,
  },
  {
    id: 'export',
    label: 'Export',
    headerTitle: 'WebCodecs Video Export',
    icon: Zap,
    component: ExportPanel,
  },
];

export function getFeatureById(id: string): FeatureMenuItem | undefined {
  return featureRegistry.find((item) => item.id === id);
}
