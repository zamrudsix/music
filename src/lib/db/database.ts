import Dexie, { type Table } from 'dexie';
import type { ProjectConfig } from '../types/project';

export interface StoredAsset {
  id: string;
  projectId: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'font';
  blob: Blob;
  createdAt: number;
}

export interface StoredProject {
  id: string;
  title: string;
  config: ProjectConfig;
  updatedAt: number;
}

export class VisualizerDatabase extends Dexie {
  assets!: Table<StoredAsset, string>;
  projects!: Table<StoredProject, string>;

  constructor() {
    super('BeatCanvasDB');
    this.version(1).stores({
      assets: 'id, projectId, type, createdAt',
      projects: 'id, title, updatedAt',
    });
  }
}

export const db = new VisualizerDatabase();
