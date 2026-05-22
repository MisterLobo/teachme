import { OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server } from 'socket.io'
import { RedisService } from './redis/redis.service';
import { UserClaims } from './common';
import { jwtDecode } from 'jwt-decode';

@WebSocketGateway({ cors: true })
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() wss: Server | undefined;
  private userSockets = new Map<string, Set<any>>()

  constructor(private readonly redisService: RedisService) {
    this.redisService.onMessage((userId, event, data) => this.sendToUser(userId, event, data))
  }

  onModuleInit() {
    
  }

  afterInit(server: Server) {
    this.wss = server
    console.log('server ready to accept connections')
  }

  handleConnection(client: any, ...args: any[]) {
    console.log('new client:', client.handshake.auth, args)
    const token = client.handshake.auth.token
    console.log('token:', token)
    const { pid } = this.validateToken(token)
    if (!pid) {
      console.error('unauthorized connection')
      return
    }
    if (!this.userSockets.has(pid!)) {
      this.userSockets.set(pid, new Set())
    }
    this.userSockets.get(pid)?.add(client)
    console.log('Client connected:', client.id)
  }

  handleDisconnect(client: any) {
    console.log('Client disconnected:', client.id)
    for (const sockets of this.userSockets.values()) {
      sockets.delete(sockets)
    }
  }

  sendToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId) ?? []
    sockets.forEach((socket) => socket.emit(event, data))
  }

  broadcastToUser(userId: string, event: string, data: any) {
    this.sendToUser(userId, event, data)
    this.redisService.publish(userId, event, data)
  }

  validateToken(token: string): UserClaims {
    return jwtDecode(token)
  }
}