const mammoth = require('mammoth');
const fs = require('fs');
async function test() {
  const buffer = Buffer.from('Testing array buffer inside mammoth');
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); 
  try {
    const res = await mammoth.extractRawText({ arrayBuffer });
    console.log("Success arrayBuffer", res);
  } catch (e) {
    console.error("Error arrayBuffer:", e.message);
  }
  
  try {
    const res = await mammoth.extractRawText({ buffer });
    console.log("Success buffer", res);
  } catch (e) {
    console.error("Error buffer:", e.message);
  }
}
test();
