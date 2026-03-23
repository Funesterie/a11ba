// Test QFlush integration
const qflushIntegration = require('./src/qflush-integration.cjs');

console.log('QFlush Available:', qflushIntegration.qflushAvailable);

if (qflushIntegration.qflushAvailable) {
  console.log('Setting up A11 supervisor...');
  const supervisor = qflushIntegration.setupA11Supervisor();
  
  if (supervisor) {
    console.log('Supervisor created successfully!');
    const status = qflushIntegration.getStatus(supervisor);
    console.log('Status:', JSON.stringify(status, null, 2));
  } else {
    console.log('Failed to create supervisor');
  }
} else {
  console.log('QFlush module not available - check if @funeste38/qflush is installed');
  console.log('Run: npm install @funeste38/qflush');
}
