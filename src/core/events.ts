type Handler = (payload: any) => void;
/** Tiny synchronous pub/sub used to decouple simulation from UI/audio/render. */
export class EventBus {
  private map = new Map<string, Set<Handler>>();
  on(type: string, h: Handler) { if (!this.map.has(type)) this.map.set(type, new Set()); this.map.get(type)!.add(h); return () => this.map.get(type)!.delete(h); }
  emit(type: string, payload?: any) { const s = this.map.get(type); if (s) for (const h of [...s]) { try { h(payload); } catch (e) { console.warn('event handler error', type, e); } } }
}
export const bus = new EventBus();
