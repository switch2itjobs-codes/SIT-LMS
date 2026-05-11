import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'sit-lms-files'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL // e.g. https://files.switch2itjobs.com or R2 dev URL

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
})

/**
 * Upload a file buffer to R2 and return its public URL.
 * @param {string} folder  e.g. 'avatars', 'resumes', 'assignments', 'chat'
 * @param {string} key     e.g. '42/avatar-1715000000.jpg'
 * @param {Buffer} buffer
 * @param {string} contentType
 * @returns {Promise<string>} public URL
 */
export async function uploadToR2(folder, key, buffer, contentType) {
  const objectKey = `${folder}/${key}`

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    }),
  )

  // Return the public URL
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${objectKey}`
  }
  // Fallback: R2 dev domain
  return `https://pub-${R2_ACCOUNT_ID}.r2.dev/${objectKey}`
}

/**
 * Delete a file from R2.
 * @param {string} objectKey  full key e.g. 'avatars/42/avatar-123.jpg'
 */
export async function deleteFromR2(objectKey) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
    }),
  )
}
