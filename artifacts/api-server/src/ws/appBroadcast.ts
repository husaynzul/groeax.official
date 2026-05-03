import { WebSocket } from "ws";

const appClients = new Set<WebSocket>();

export function addAppClient(ws: WebSocket): void {
  appClients.add(ws);
}

export function removeAppClient(ws: WebSocket): void {
  appClients.delete(ws);
}

export function broadcastToApp(data: unknown): void {
  const msg = JSON.stringify(data);
  for (const client of appClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export function appClientCount(): number {
  return appClients.size;
}
