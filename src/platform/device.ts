import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NominaDevicePlugin {
  openDocument(options: { mimeTypes: string[] }): Promise<{ name?: string; mimeType?: string; data?: string; cancelled?: boolean }>;
  saveDocument(options: { name: string; mimeType: string; data: string }): Promise<{ cancelled?: boolean }>;
  setCalendarSecret(options: { url: string }): Promise<void>;
  getCalendarSecret(): Promise<{ url: string | null }>;
  clearCalendarSecret(): Promise<void>;
}

export const NominaDevice = registerPlugin<NominaDevicePlugin>('NominaDevice');
export const isNative = () => Capacitor.isNativePlatform();
export const storageNotice = 'Vista previa en navegador: los datos se guardan en este navegador y no se sincronizan con la app Android.';
