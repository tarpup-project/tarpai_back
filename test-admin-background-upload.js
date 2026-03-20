const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testAdminBackgroundUpload() {
  try {
    // First, login as admin to get token
    console.log('🔐 Logging in as admin...');
    const loginResponse = await fetch('http://localhost:3001/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'travorproject@gmail.com',
        password: 'winco23456'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const { token } = await loginResponse.json();
    console.log('✅ Admin login successful');

    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8A, 0x8D, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    // Create form data
    const formData = new FormData();
    formData.append('background', testImageBuffer, {
      filename: 'test-background.png',
      contentType: 'image/png'
    });
    formData.append('name', 'Test Admin Background');

    console.log('📤 Testing admin background upload...');
    const uploadResponse = await fetch('http://localhost:3001/admin/backgrounds/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadResult = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      console.error('❌ Upload failed:', uploadResult);
      return;
    }

    console.log('✅ Upload successful!');
    console.log('📋 Response:', JSON.stringify(uploadResult, null, 2));

    // Test getting all backgrounds
    console.log('📋 Testing get all backgrounds...');
    const backgroundsResponse = await fetch('http://localhost:3001/admin/backgrounds', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const backgrounds = await backgroundsResponse.json();
    console.log('✅ Backgrounds retrieved:', backgrounds.length);
    
    // Find our uploaded background
    const uploadedBg = backgrounds.find(bg => bg.name === 'Test Admin Background');
    if (uploadedBg) {
      console.log('✅ Found uploaded background:', uploadedBg.name);
      console.log('🔗 URL:', uploadedBg.url);
      
      // Clean up - delete the test background
      console.log('🧹 Cleaning up test background...');
      const deleteResponse = await fetch(`http://localhost:3001/admin/backgrounds/${uploadedBg.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (deleteResponse.ok) {
        console.log('✅ Test background cleaned up successfully');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAdminBackgroundUpload();