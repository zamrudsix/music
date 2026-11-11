import { GroqService } from './groq';
import { SubtitleService } from './subtitle';
import type { LyricSegment } from '../../lib/types/project';

export interface BatchTask {
  id: string;
  name: string;
  file: File;
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result?: LyricSegment[];
  error?: string;
}

export class TaskQueuePool {
  public tasks = $state<BatchTask[]>([]);
  public concurrencyLimit = $state<number>(3);
  public apiKey = $state<string>(localStorage.getItem('groq_api_key') || '');
  public isRunning = $state<boolean>(false);
  private activeWorkers = 0;

  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('groq_api_key', key);
  }

  addFiles(files: FileList | File[]) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.tasks.push({
        id: 'task-' + Math.random().toString(36).substring(2, 9),
        name: file.name,
        file,
        status: 'queued',
        progress: 0,
      });
    }
  }

  removeTask(id: string) {
    const task = this.tasks.find((t) => t.id === id);
    if (task && task.status === 'processing') {
      task.status = 'cancelled';
    }
    this.tasks = this.tasks.filter((t) => t.id !== id);
  }

  cancelTask(id: string) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      task.status = 'cancelled';
    }
  }

  clearCompleted() {
    this.tasks = this.tasks.filter((t) => t.status !== 'completed');
  }

  async startQueue(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Masukkan Groq API Key terlebih dahulu.');
    }

    this.isRunning = true;

    while (this.isRunning) {
      const queuedTasks = this.tasks.filter((t) => t.status === 'queued');

      if (queuedTasks.length === 0 && this.activeWorkers === 0) {
        this.isRunning = false;
        break;
      }

      while (this.activeWorkers < this.concurrencyLimit && queuedTasks.length > 0) {
        const nextTask = queuedTasks.shift();
        if (!nextTask) break;

        this.processTask(nextTask);
      }

      await new Promise((r) => setTimeout(r, 200));
    }
  }

  private async processTask(task: BatchTask) {
    if ((task.status as string) === 'cancelled') return;

    this.activeWorkers++;
    task.status = 'processing';
    task.progress = 0.2;

    try {
      const progressTimer = setInterval(() => {
        if (task.status === 'processing' && task.progress < 0.85) {
          task.progress += 0.1;
        }
      }, 500);

      const segments = await GroqService.transcribeAudio(task.file, this.apiKey);

      clearInterval(progressTimer);

      if ((task.status as string) !== 'cancelled') {
        task.status = 'completed';
        task.progress = 1.0;
        task.result = segments;

        // Auto download SRT subtitle for each batch item named after its audio file
        try {
          SubtitleService.downloadSRT(segments, task.name);
        } catch (e) {
          console.warn('Could not auto-download batch subtitle:', e);
        }
      }
    } catch (err: any) {
      if ((task.status as string) !== 'cancelled') {
        task.status = 'failed';
        task.error = err.message || 'Terjadi kesalahan transkripsi.';
      }
    } finally {
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
    }
  }
}

export const taskQueuePool = new TaskQueuePool();
