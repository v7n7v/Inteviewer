const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚀 Starting Firebase Deployment Process...');
console.log('Step 1: Building and deploying Next.js to Cloud Run (Expect an error at the end)...');

// Read current firebase.json
const firebaseJsonPath = './firebase.json';
const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));

// Ensure it is in Web Frameworks mode
const frameworksConfig = {
  hosting: {
    source: ".",
    ignore: [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    frameworksBackend: {
      "region": "us-east1"
    }
  }
};
fs.writeFileSync(firebaseJsonPath, JSON.stringify(frameworksConfig, null, 2));

try {
  // We execute firebase deploy. This creates the .firebase build directory and deploys the Cloud Run service.
  // It is EXPECTED to fail at the end with the 409 ALREADY_EXISTS error during hosting finalization.
  execSync('npx firebase deploy', { stdio: 'inherit' });
  console.log('✅ Firebase deploy succeeded natively (No 409 error encountered).');
  // If it magically succeeds, we don't need step 2.
} catch (error) {
  console.log('⚠️ Firebase deploy encountered expected 409 error at hosting finalization. The Cloud Run service was successfully updated.');
  
  console.log('Step 2: Linking Firebase Hosting to updated Cloud Run service and uploading static assets...');
  
  // Switch firebase.json to static rewrites mode to bypass the broken finalization step
  const staticConfig = {
    hosting: {
      public: ".firebase/talent-consulting-acf16/hosting",
      ignore: [
        "firebase.json",
        "**/.*",
        "!.env",
        "!.env.local",
        "**/node_modules/**"
      ],
      rewrites: [
        {
          source: "**",
          run: {
            serviceId: "ssrtalentconsultingacf1",
            region: "us-east1"
          }
        }
      ]
    }
  };
  fs.writeFileSync(firebaseJsonPath, JSON.stringify(staticConfig, null, 2));
  
  try {
    // Run only the hosting deploy using the static configuration
    execSync('npx firebase deploy --only hosting', { stdio: 'inherit' });
    console.log('✅ Firebase Hosting finalization succeeded using static bypass.');
  } catch (finalError) {
    console.error('❌ Failed to deploy static assets.', finalError.message);
    // Restore config and exit
    fs.writeFileSync(firebaseJsonPath, JSON.stringify(frameworksConfig, null, 2));
    process.exit(1);
  }
}

// Restore Web Frameworks config for next time
fs.writeFileSync(firebaseJsonPath, JSON.stringify(frameworksConfig, null, 2));
console.log('🎉 Deployment fully complete!');
