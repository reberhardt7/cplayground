import * as path from 'path';

import { Socket } from 'socket.io';
import { Request } from 'express';

export function getSourceIpFromRequest(req: Request): string {
    const sourceIP = req.headers['cf-connecting-ip']
        || req.headers['x-real-ip']
        || req.connection.remoteAddress;
    return Array.isArray(sourceIP) ? sourceIP[0] : sourceIP;
}

export function getSourceIpFromSocket(socket: Socket): string {
    return socket.handshake.headers['cf-connecting-ip']
        || socket.handshake.headers['x-real-ip']
        || socket.conn.remoteAddress;
}

export function getUserAgentFromSocket(socket: Socket): string {
    return socket.handshake.headers['user-agent'] || '';
}

export function getPathFromRoot(relativePath: string): string {
    // After compile time, this code is in {root}/dist/server/util.js
    const projectRoot = path.resolve(`${__dirname}/../..`);
    return path.resolve(`${projectRoot}/${relativePath}`);
}
