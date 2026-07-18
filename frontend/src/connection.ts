import { HubConnectionBuilder, LogLevel, type HubConnection } from "@microsoft/signalr";

export function createConnection(): HubConnection {
  const apiUrl = import.meta.env.VITE_API_URL ?? window.location.origin;
  return new HubConnectionBuilder()
    .withUrl(`${apiUrl}/hubs/dj`)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}
