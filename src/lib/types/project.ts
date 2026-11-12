export type BackgroundType = 'single-image' | 'multi-image' | 'single-video' | 'multi-video';
export type ScaleMode = 'cover' | 'contain' | 'stretch';
export type TransitionType = 'cut' | 'crossfade' | 'fade' | 'zoom' | 'slide-left' | 'slide-right';

export type BackgroundMotionEffect = 
  | 'none' 
  | 'random' 
  | 'ken-burns' 
  | 'zoom-in' 
  | 'zoom-out' 
  | 'pan-left' 
  | 'pan-right' 
  | 'pan-up' 
  | 'pan-down' 
  | 'wobble';

export interface CropRect {
  x: number;      // normalized 0.0 - 1.0 (relative to natural media width)
  y: number;      // normalized 0.0 - 1.0 (relative to natural media height)
  width: number;  // normalized 0.0 - 1.0
  height: number; // normalized 0.0 - 1.0
}

export interface BackgroundItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  file?: File;
  filePath?: string;
  fileModifiedAt?: number;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  crop?: CropRect;
  motionEffect?: BackgroundMotionEffect;
}

export interface BackgroundConfig {
  type: BackgroundType;
  items: BackgroundItem[];
  transition: TransitionType;
  transitionDuration: number;
  scaleMode: ScaleMode;
  brightness: number; // 0.0 to 2.0, default 1.0
  followBeat: boolean;
  beatSensitivity: number;
  motionEffect?: BackgroundMotionEffect;
  motionIntensity?: number;
}

export type ParticlePreset = 
  | 'floating-dust' 
  | 'confetti' 
  | 'bokeh' 
  | 'snow' 
  | 'sparks'
  | 'Bintik (Dust)'
  | 'Sparkles'
  | 'Stars'
  | 'Gentle Snow'
  | 'Salju'
  | 'Asap'
  | 'Percikan Api'
  | 'Kabut'
  | 'Hujan Neon'
  | 'Confetti'
  | 'NCS Particles'
  | 'Particles Rise'
  | 'Particle Burst'
  | 'Vortex Particles'
  | 'Meteor Shower'
  | 'Orbit Dust'
  | 'Galaxy Dust'
  | 'Beat Spark';

export interface ParticleConfig {
  enabled: boolean;
  preset: ParticlePreset;
  count: number;
  size: number;
  speed: number;
  color: string;
  opacity: number;
  gravity: 'up' | 'down' | 'float' | 'radial';
  followBeat: boolean;
  beatSensitivity: number;
}

export type SpectrumStyle = 
  // Legacy styles
  | 'bars' 
  | 'waveform' 
  | 'circular' 
  | 'radial-bars' 
  | 'center-bars' 
  | 'neon-wave' 
  | 'double-circular' 
  | 'digital-eq' 
  | 'dots-ring' 
  | 'pulse-rings'
  // Extended Styles List (96 styles)
  | 'Bars Round'
  | 'Bars Dense'
  | 'Octave Bars'
  | 'LED Classic'
  | 'LED Prism'
  | 'LED Mirror'
  | 'Lumi Bars'
  | 'Outline'
  | 'Alpha Bars'
  | 'Radial'
  | 'Radial Spin'
  | 'Radial Invert'
  | 'Radial Still'
  | 'Graph'
  | 'Graph Thin'
  | 'Mirror Center'
  | 'Mirror Outer'
  | 'Dual Vertical'
  | 'Dual Horizontal'
  | 'Dual Overlay'
  | 'Bar Level Color'
  | 'Bar Index Color'
  | 'Mel Scale'
  | 'Bark Scale'
  | 'Discrete FFT'
  | 'Reflex Floor'
  | 'Fade Peaks'
  | 'A-Weight'
  | 'NCS Style'
  | 'NCS Radial'
  | 'NCS Pulse'
  | 'NCS Classic'
  | 'NCS Mirror'
  | 'Spiral'
  | 'Galaxy Spiral'
  | 'Spiral Tunnel'
  | 'DNA Helix'
  | 'Vortex'
  | 'Orbit Rings'
  | 'Jonten NFC'
  | 'Jonten Ring'
  | 'Jonten Spark'
  | 'Neon Pulse'
  | 'Api Bars'
  | 'Api Radial'
  | 'Asap Wave'
  | 'Plasma Ring'
  | 'Starburst'
  | 'Ripple Waves'
  | 'Aurora'
  | 'Radar Sweep'
  | 'Kaleidoscope'
  | 'Wave Mirror'
  | 'Deep Tunnel'
  | 'Hex Pulse'
  | 'Lissajous'
  | 'Spectrum Arc'
  | 'Neon Flower'
  | 'Warp Speed'
  | 'Diamond Lattice'
  | 'Cyber Grid'
  | 'Bars Rainbow'
  | 'Bars Prism'
  | 'Bars Neon'
  | 'Bars NCS'
  | 'Bars Galaxy'
  | 'Bars Thin'
  | 'Bars Fat'
  | 'Bars Peak Neon'
  | 'LED Rainbow'
  | 'LED Neon'
  | 'LED Fire'
  | 'LED NCS'
  | 'LED Galaxy'
  | 'Radial NCS'
  | 'Radial Prism'
  | 'Radial Galaxy'
  | 'Radial Fire'
  | 'Radial Magenta'
  | 'Radial Dual'
  | 'Radial LED'
  | 'Radial Outline'
  | 'Graph Neon'
  | 'Graph NCS'
  | 'Graph Fire'
  | 'Graph Mirror'
  | 'Dual Neon'
  | 'Dual NCS'
  | 'Mirror Neon'
  | 'Mirror Galaxy'
  | 'Lumi Neon'
  | 'Lumi Galaxy'
  | 'Outline Neon'
  | 'Outline NCS'
  | 'Alpha Neon'
  | 'Alpha Galaxy'
  | 'Reflex Neon'
  | 'Reflex Fire'
  | 'Octave Neon'
  | 'Octave NCS'
  // 19 New Unique Mathematical Spectrum Styles
  | 'Cardioid Heart'
  | 'Astroid Star'
  | 'Hyperbolic Wings'
  | 'Superformula'
  | 'Infinity Loop'
  | 'Harmonograph'
  | 'Phyllotaxis'
  | 'Matrix Rain'
  | 'Sine Sphere'
  | 'Hex Lattice'
  | 'Spirograph'
  | 'Pendulum Wave'
  | 'Chladni Plate'
  | 'Quantum Orbit'
  | 'Maurer Rose'
  | 'Tesseract 4D'
  | 'Butterfly Curve'
  | 'Epicycloid Gear'
  | 'Lorenz Chaos'
  // Final 9 Unique Mathematical Spectrum Styles (Exact 100 Styles)
  | 'Hypotrochoid'
  | 'Involute Spiral'
  | 'Torus Knot'
  | 'Clifford Attractor'
  | 'Superellipse'
  | 'Black Hole Accretion'
  | 'Catenary Arch'
  | 'Fourier Epicycles'
  | 'Plasma Orb'
  // Avant-Garde & Quantum Physics Styles
  | 'Wormhole Lensing'
  | 'Magnetic Pulsar'
  | 'Julia Morph'
  | 'Barnsley Fern'
  | 'Double Pendulum'
  | 'Klein Bottle 4D'
  | 'Hopf Fibration'
  | 'Mobius Ribbon'
  | 'Sonoluminescence'
  | 'Lichtenberg Tree'
  | 'Rubens Soundtube';

export interface SpectrumConfig {
  id?: string;
  name?: string;
  enabled: boolean;
  style: SpectrumStyle;
  barCount: number;
  color: string;
  secondaryColor: string;
  height: number;
  radius: number;
  opacity: number;
  mirror: boolean;
  followBeat: boolean;
  beatSensitivity: number;
  x: number;
  y: number;
  scale: number;
}

export type LyricStyle = 'karaoke' | 'fade-line' | 'typewriter' | 'bounce-word' | 'bottom-bar';

export interface LyricSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

export type OverlayAnimationType = 'none' | 'pulse-beat' | 'floating' | 'shimmer' | 'typewriter' | 'glow-pulse';
export type OverlayTransitionType = 'none' | 'fade' | 'zoom' | 'slide-up' | 'slide-down';

export interface CustomFontItem {
  name: string;
  url?: string;
  dataBase64?: string;
}

export interface LyricConfig {
  enabled: boolean;
  style: LyricStyle;
  fontFamily: string;
  fontSize: number;
  color: string;
  highlightColor: string;
  position: 'custom' | 'top' | 'center' | 'bottom';
  alignment?: 'left' | 'center' | 'right';
  x: number;
  y: number;
  animation?: OverlayAnimationType;
  followBeat: boolean;
  beatSensitivity: number;
  language?: string;
  glow?: boolean;
  glowColor?: string;
  stroke?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
}

export type OverlayFitMode = 'cover' | 'fill' | 'fit';

export interface ImageOverlayItem {
  id: string;
  name: string;
  url: string;
  file?: File;
  filePath?: string;
  fileModifiedAt?: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
  isFullScreen?: boolean;
  fitMode?: OverlayFitMode;
  blendMode?: VideoBlendMode;
  animation?: OverlayAnimationType;
  followBeat: boolean;
  beatSensitivity: number;
  startTime?: number;
  endTime?: number;
  transition?: OverlayTransitionType;
  transitionDuration?: number; // default 0.5s
}

export type VideoBlendMode = 'source-over' | 'screen' | 'lighten' | 'multiply' | 'overlay' | 'color-dodge';

export interface VideoOverlayItem {
  id: string;
  name: string;
  url: string;
  file?: File;
  filePath?: string;
  fileModifiedAt?: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  isFullScreen?: boolean;
  fitMode?: OverlayFitMode;
  blendMode: VideoBlendMode;
  chromaKey: {
    enabled: boolean;
    color: string;
    similarity: number;
    smoothness: number;
  };
  animation?: OverlayAnimationType;
  followBeat: boolean;
  beatSensitivity: number;
  startTime?: number;
  endTime?: number;
  transition?: OverlayTransitionType;
  transitionDuration?: number;
}

export type TextAnimationType = 'none' | 'pulse-beat' | 'floating' | 'shimmer' | 'typewriter' | 'glow-pulse' | 'marquee-left';

export interface TextOverlayItem {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  accentColor: string;
  x: number;
  y: number;
  alignment: 'left' | 'center' | 'right';
  opacity: number;
  rotation: number;
  shadow: boolean;
  shadowColor: string;
  animation: TextAnimationType;
  crawlSpeed?: number;   // Speed in px/s at 1080p scale, default 160
  crawlSpacing?: number; // Gap between repetitions in px, default 100
  followBeat: boolean;
  beatSensitivity: number;
  startTime?: number;
  endTime?: number;
  stroke?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  transition?: OverlayTransitionType;
  transitionDuration?: number;
}

export type NowPlayingAnimationType = 'glow-badge' | 'bounce-pulse' | 'karaoke-gradient' | 'equalizer-indicator' | 'sliding-accent';

export interface TracklistOverlayConfig {
  enabled: boolean;
  title: string;
  showTitle: boolean;
  fontFamily: string;
  fontSize: number;
  titleFontSize: number;
  color: string;
  activeColor: string;
  accentColor: string;
  x: number;
  y: number;
  alignment: 'left' | 'center' | 'right';
  lineSpacing: number;
  opacity: number;
  shadow: boolean;
  shadowColor: string;
  stroke?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  nowPlayingAnimation: NowPlayingAnimationType;
  followBeat: boolean;
  beatSensitivity: number;
  showNumbers: boolean;
  showDuration: boolean;
}

export interface AudioTrackItem {
  id: string;
  name: string;
  fileSize: number;
  duration: number;
  url?: string;
  file?: File;
  filePath?: string;
  fileModifiedAt?: number;
  audioBuffer?: AudioBuffer;
}

export interface BeatMap {
  duration: number;
  sampleRate: number;
  bpm?: number;
  beats: number[];
  spectralFlux: Float32Array | number[];
}

export interface ExportRange {
  enabled: boolean;
  startTime: number;
  endTime: number;
}

export interface ExportSettings {
  resolution: '1080x1920' | '1920x1080' | '1080x1080' | '720x1280' | '1280x720';
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  format: 'mp4' | 'webm';
  videoBitrate: number;
  audioBitrate: number;
  customExportDir?: string;
  exportRange?: ExportRange;
}

export interface ProjectConfig {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  audio: {
    fileName: string;
    fileSize: number;
    duration: number;
    url?: string;
    beatSensitivity: number;
    tracks: AudioTrackItem[];
  };
  background: BackgroundConfig;
  overlays: {
    particle: ParticleConfig;
    spectrum: SpectrumConfig;
    spectrums?: SpectrumConfig[];
    images: ImageOverlayItem[];
    videos: VideoOverlayItem[];
    texts: TextOverlayItem[];
    tracklist?: TracklistOverlayConfig;
    layerOrder: Array<'background' | 'videos' | 'images' | 'texts' | 'spectrum' | 'particle' | 'lyrics'>;
  };
  lyrics: {
    segments: LyricSegment[];
    config: LyricConfig;
  };
  customFonts?: CustomFontItem[];
  exportSettings: ExportSettings;
}
