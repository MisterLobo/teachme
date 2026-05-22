
export const constants = {
  jwtSecret: process.env.JWT_SECRET ?? 'secret',
  natsUrl: process.env.NATS_URL ?? 'nats://nats:4222',
  dbalGrpcUrl: process.env.DBAL_GRPC_URL ?? 'localhost:7891',
}