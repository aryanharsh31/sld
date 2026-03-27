import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PiGatewayConfig {
  baseUrl: string;
  tabletId?: string;
  apiKey?: string;
}

export interface PenSensorPacket {
  penId: string;
  timestamp: string;
  strokes?: any[];
  pressure?: number[];
  imu?: Record<string, number>;
  batteryLevel?: number;
}

const CONFIG_KEY = 'pi_gateway_config';
const QUEUE_KEY = 'pi_gateway_queue';

interface QueueItem {
  path: string;
  payload: any;
  queuedAt: string;
}

class PiIntegrationService {
  async getConfig(): Promise<PiGatewayConfig | null> {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  async saveConfig(config: PiGatewayConfig): Promise<void> {
    const normalizedConfig: PiGatewayConfig = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
    };
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(normalizedConfig));
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return Boolean(config?.baseUrl);
  }

  async submitPenSensorPacket(packet: PenSensorPacket): Promise<void> {
    await this.sendOrQueue('/pen/sensor-packets', packet);
  }

  async submitRecognizedNote(payload: any): Promise<void> {
    await this.sendOrQueue('/notes/import', payload);
  }

  async getQueuedItemCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  async flushQueue(): Promise<void> {
    const config = await this.getConfig();
    if (!config?.baseUrl) return;

    const queue = await this.getQueue();
    const remaining: QueueItem[] = [];

    for (const item of queue) {
      try {
        await this.post(item.path, item.payload, config);
      } catch {
        remaining.push(item);
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  }

  private async sendOrQueue(path: string, payload: any): Promise<void> {
    const config = await this.getConfig();

    if (!config?.baseUrl) {
      await this.enqueue(path, payload);
      return;
    }

    try {
      await this.post(path, payload, config);
    } catch {
      await this.enqueue(path, payload);
    }
  }

  private async post(path: string, payload: any, config: PiGatewayConfig): Promise<void> {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
      },
      body: JSON.stringify({
        tabletId: config.tabletId,
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Pi gateway request failed with status ${response.status}`);
    }
  }

  private async enqueue(path: string, payload: any): Promise<void> {
    const queue = await this.getQueue();
    queue.push({
      path,
      payload,
      queuedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  private async getQueue(): Promise<QueueItem[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  }
}

export const piIntegrationService = new PiIntegrationService();
