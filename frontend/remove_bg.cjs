const Jimp = require('jimp');

async function processImage() {
  const imagePath = 'public/logo.png';
  const outputPath = 'public/logo.png';
  
  const image = await Jimp.read(imagePath);
  
  // Set white to transparent (with some tolerance)
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const red = this.bitmap.data[idx + 0];
    const green = this.bitmap.data[idx + 1];
    const blue = this.bitmap.data[idx + 2];
    const alpha = this.bitmap.data[idx + 3];

    // If pixel is very close to white, make it transparent
    if (red > 240 && green > 240 && blue > 240) {
      this.bitmap.data[idx + 3] = 0; // alpha = 0 (transparent)
    }
  });

  await image.writeAsync(outputPath);
  console.log('Logo processed successfully!');
}

processImage().catch(err => {
  console.error(err);
  process.exit(1);
});
