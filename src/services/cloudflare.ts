import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image MIME types (kept for documentation/future use)
// @ts-expect-error - Keeping for documentation purposes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Image file signatures (magic numbers)
const IMAGE_SIGNATURES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46] // "RIFF"
};

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Validates if the buffer is a valid image based on file signatures
 */
function validateImageBuffer(buffer: Buffer): { valid: boolean; type?: string } {
  if (!buffer || buffer.length < 4) {
    return { valid: false };
  }

  // Check JPEG
  if (buffer[0] === IMAGE_SIGNATURES.jpeg[0] &&
      buffer[1] === IMAGE_SIGNATURES.jpeg[1] &&
      buffer[2] === IMAGE_SIGNATURES.jpeg[2]) {
    return { valid: true, type: 'image/jpeg' };
  }

  // Check PNG
  if (buffer[0] === IMAGE_SIGNATURES.png[0] &&
      buffer[1] === IMAGE_SIGNATURES.png[1] &&
      buffer[2] === IMAGE_SIGNATURES.png[2] &&
      buffer[3] === IMAGE_SIGNATURES.png[3]) {
    return { valid: true, type: 'image/png' };
  }

  // Check WebP (RIFF header at bytes 0-3, WEBP at bytes 8-11)
  if (buffer[0] === IMAGE_SIGNATURES.webp[0] &&
      buffer[1] === IMAGE_SIGNATURES.webp[1] &&
      buffer[2] === IMAGE_SIGNATURES.webp[2] &&
      buffer[3] === IMAGE_SIGNATURES.webp[3] &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 &&
      buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { valid: true, type: 'image/webp' };
  }

  return { valid: false };
}

/**
 * Gets the file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

/**
 * Uploads a meal photo to Cloudflare R2
 * @param fileBuffer - The image file buffer
 * @param userId - The user ID who is uploading the photo
 * @returns Promise with upload result containing success status and URL
 */
export async function uploadMealPhoto(
  fileBuffer: Buffer,
  userId: string
): Promise<UploadResult> {
  try {
    // Validate file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return {
        success: false,
        error: 'File size exceeds 5MB limit'
      };
    }

    // Validate file is an image
    const validation = validateImageBuffer(fileBuffer);
    if (!validation.valid || !validation.type) {
      return {
        success: false,
        error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed'
      };
    }

    // Check if running in mock mode (no R2 credentials configured)
    const useMock = !process.env['CLOUDFLARE_R2_ENDPOINT'] ||
                    !process.env['CLOUDFLARE_R2_ACCESS_KEY'] ||
                    !process.env['CLOUDFLARE_R2_SECRET_KEY'] ||
                    !process.env['CLOUDFLARE_R2_BUCKET_NAME'];

    if (useMock) {
      return uploadMealPhotoMock(fileBuffer, userId, validation.type);
    }

    // Generate filename: meals/{userId}/{timestamp}.{ext}
    const timestamp = Date.now();
    const extension = getFileExtension(validation.type);
    const fileName = `meals/${userId}/${timestamp}.${extension}`;

    // Configure S3 client for Cloudflare R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env['CLOUDFLARE_R2_ENDPOINT']!,
      credentials: {
        accessKeyId: process.env['CLOUDFLARE_R2_ACCESS_KEY']!,
        secretAccessKey: process.env['CLOUDFLARE_R2_SECRET_KEY']!
      }
    });

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env['CLOUDFLARE_R2_BUCKET_NAME'],
      Key: fileName,
      Body: fileBuffer,
      ContentType: validation.type,
      CacheControl: 'public, max-age=31536000' // Cache for 1 year
    });

    await s3Client.send(uploadCommand);

    // Construct public CDN URL
    // Use the configured public URL (R2.dev URL or custom domain)
    if (!process.env['CLOUDFLARE_R2_PUBLIC_URL']) {
      throw new Error('CLOUDFLARE_R2_PUBLIC_URL is not configured');
    }

    const publicUrl = `${process.env['CLOUDFLARE_R2_PUBLIC_URL']}/${fileName}`;

    console.log(`Uploaded meal photo to R2: ${publicUrl}`);

    return {
      success: true,
      url: publicUrl
    };

  } catch (error) {
    console.error('Error uploading to Cloudflare R2:', error);
    return {
      success: false,
      error: 'Upload failed. Please try again later.'
    };
  }
}

/**
 * Mock upload function for testing (returns fake CDN URL without actual upload)
 * @param fileBuffer - The image file buffer
 * @param userId - The user ID
 * @param mimeType - The detected MIME type
 * @returns Promise with mock upload result
 */
export async function uploadMealPhotoMock(
  _fileBuffer: Buffer,
  userId: string,
  mimeType: string
): Promise<UploadResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  const timestamp = Date.now();
  const extension = getFileExtension(mimeType);
  const fileName = `meals/${userId}/${timestamp}.${extension}`;

  // Return a fake CDN URL
  const mockUrl = `https://cdn.example.com/fitness-app-photos/${fileName}`;

  console.log(`[MOCK] Uploaded meal photo: ${mockUrl} (${_fileBuffer.length} bytes)`);

  return {
    success: true,
    url: mockUrl
  };
}
