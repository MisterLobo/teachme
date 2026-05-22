'use server'

import { createClient } from 'redis'
import fs from 'fs'
import path from 'path'

export const getRedis = async () => {
  const redis = createClient({
    url: process.env.REDISS_URL,
    socket: {
      tls: true,
      ca: [fs.readFileSync(path.join('certs', 'new', 'ca.pem'))],
      cert: [fs.readFileSync(path.join('certs', 'new', 'localhost.san.pem'))],
      key: [fs.readFileSync(path.join('certs', 'new', 'san-key.pem'))],
    },
  })
  redis.connect()
  return redis
}