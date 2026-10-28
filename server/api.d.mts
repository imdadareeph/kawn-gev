import type { IncomingMessage, ServerResponse } from 'node:http';

export function createApiMiddleware(): (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
export function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void>;
export function hostAllowed(hostHeader: string | undefined): boolean;
export function getFlights(q: { lat: number; lon: number; r: number }): Promise<Record<string, unknown>>;
