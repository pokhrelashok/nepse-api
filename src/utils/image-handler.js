const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

/**
 * Checks if a string is a base64 encoded image
 * @param {string} str - The string to check
 * @returns {boolean} - True if it's a base64 image
 */
function isBase64Image(str) {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('data:image/');
}

/**
 * Checks if a string is a URL
 * @param {string} str - The string to check
 * @returns {boolean} - True if it's a URL
 */
function isUrl(str) {
  if (!str || typeof str !== 'string') return false;
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts file extension from base64 data URL
 * @param {string} base64Data - The base64 data URL
 * @returns {string} - The file extension
 */
function getExtensionFromBase64(base64Data) {
  const match = base64Data.match(/data:image\/([a-zA-Z0-9]+);/);
  return match ? match[1] : 'jpg';
}

/**
 * Saves a base64 image to the public/images directory
 * @param {string} base64Data - The base64 image data
 * @param {string} symbol - The company symbol to use in filename
 * @returns {Promise<string>} - The URL path to the saved image
 */
async function saveBase64Image(base64Data, symbol) {
  if (!isBase64Image(base64Data)) {
    throw new Error('Invalid base64 image data');
  }

  // Get file extension
  const extension = getExtensionFromBase64(base64Data);

  // Create filename using just the symbol (will overwrite existing files)
  const filename = `${symbol}.png`; // Force PNG for consistency and optimization

  // Ensure public/storage/images/logos directory exists
  const imagesDir = path.join(process.cwd(), 'public', 'storage', 'images', 'logos');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const filePath = path.join(imagesDir, filename);

  // Check if file already exists - skip saving if it does
  if (fs.existsSync(filePath)) {
    console.log(`⏭️ ${symbol}: Image already exists, skipping save`);
    return `/storage/images/logos/${filename}`;
  }

  // Extract the actual base64 data (remove data:image/...;base64, part)
  const base64Content = base64Data.split(',')[1];
  if (!base64Content) {
    throw new Error('Invalid base64 format');
  }

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Content, 'base64');

  try {
    // Resize and optimize image using sharp (max width: 200px, quality: 80%)
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 200, height: 200, fit: 'inside', withoutEnlargement: true })
      .png({ quality: 80, progressive: true })
      .toBuffer();

    fs.writeFileSync(filePath, optimizedBuffer);
    console.log(`📐 ${symbol}: Image optimized and saved (${Math.round(optimizedBuffer.length / 1024)}KB)`);
  } catch (error) {
    // Fallback to original if sharp fails
    fs.writeFileSync(filePath, buffer);
    console.log(`💾 ${symbol}: Image saved without optimization (${Math.round(buffer.length / 1024)}KB)`);
  }

  return `/storage/images/logos/${filename}`;
}/**
 * Processes an image URL - saves base64 images to disk, leaves URLs as-is
 * @param {string} imageData - The image data (URL or base64)
 * @param {string} symbol - The company symbol
 * @returns {Promise<string|null>} - The processed image URL or null if invalid
 */
async function processImageData(imageData, symbol) {
  if (!imageData || typeof imageData !== 'string') {
    return null;
  }

  // Check for base64 image first (before URL check, since base64 data URIs are technically URLs)
  if (isBase64Image(imageData)) {
    try {
      const result = await saveBase64Image(imageData, symbol);
      console.log(`💾 ${symbol}: Saved image to ${result}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to save base64 image for ${symbol}:`, error.message);
      return null;
    }
  }

  // If it's a URL (but not base64), return null (as per requirement, don't save URLs)
  if (isUrl(imageData)) {
    return null;
  }

  // Neither URL nor base64 image
  return null;
}

module.exports = {
  isBase64Image,
  isUrl,
  saveBase64Image,
  processImageData
};