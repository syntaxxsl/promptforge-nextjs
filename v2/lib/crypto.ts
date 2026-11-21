import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'

function getKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('API_KEY_ENCRYPTION_SECRET tanımlı değil veya çok kısa (en az 32 karakter).')
  }
  return scryptSync(secret, 'promptforge-api-keys', 32)
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptSecret(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(':')
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error('Şifreli veri biçimi tanınmadı.')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivPart, 'base64'))
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64')), decipher.final()]).toString('utf8')
}