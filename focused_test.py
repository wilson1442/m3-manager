#!/usr/bin/env python3
"""
Focused test for the specific features mentioned in the review request:
1. Authentication Test
2. FFmpeg Stream Probing Test  
3. Profile Image Upload Test
4. Backup API Test
5. Restore API Test (Optional - risky)
"""

import requests
import json
from datetime import datetime

class FocusedAPITester:
    def __init__(self, base_url="https://mediaflow-panel.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, description=""):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 {name}")
        if description:
            print(f"   {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ FAILED - Exception: {str(e)}")
            return False, {}

    def test_authentication(self):
        """Test 1: Authentication Test - Login as super admin"""
        print("\n" + "="*60)
        print("TEST 1: AUTHENTICATION")
        print("="*60)
        
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"},
            description="Login with super admin credentials"
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   ✅ Token received and stored")
            print(f"   ✅ User role: {response['user']['role']}")
            return True
        else:
            print(f"   ❌ Failed to get access token")
            return False

    def test_ffmpeg_probing(self):
        """Test 2: FFmpeg Stream Probing Test"""
        print("\n" + "="*60)
        print("TEST 2: FFMPEG STREAM PROBING")
        print("="*60)
        
        if not self.token:
            print("❌ Skipping - No authentication token")
            return False
        
        # First search for channels to get a stream URL
        success, channels = self.run_test(
            "Search for channels",
            "GET",
            "channels/search?q=test",
            200,
            description="Get stream URLs from existing channels"
        )
        
        # Use a test stream URL (either from search or fallback)
        if success and channels:
            test_url = channels[0].get('url', 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8')
            print(f"   Using stream URL from search: {test_url}")
        else:
            test_url = 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8'
            print(f"   Using fallback test URL: {test_url}")
        
        # Test FFmpeg probe with valid stream URL
        success, probe_result = self.run_test(
            "FFmpeg probe valid stream",
            "POST",
            f"channels/probe-ffmpeg?url={test_url}",
            200,
            description="Call POST /api/channels/probe-ffmpeg with valid stream URL"
        )
        
        if success:
            print(f"   ✅ Response received")
            # Verify required fields are present
            required_fields = ['online', 'status', 'format', 'bitrate', 'video_codec', 
                             'video_resolution', 'video_fps', 'audio_codec', 
                             'audio_sample_rate', 'audio_channels']
            
            missing_fields = []
            for field in required_fields:
                if field not in probe_result:
                    missing_fields.append(field)
                else:
                    print(f"   ✅ {field}: {probe_result.get(field)}")
            
            if missing_fields:
                print(f"   ⚠️  Missing fields: {missing_fields}")
            
            # Test with invalid/offline URL
            invalid_url = "http://invalid-stream-url.com/nonexistent.m3u8"
            success_invalid, probe_invalid = self.run_test(
                "FFmpeg probe invalid stream",
                "POST",
                f"channels/probe-ffmpeg?url={invalid_url}",
                200,
                description="Test with invalid/offline URL and verify error handling"
            )
            
            if success_invalid:
                print(f"   ✅ Error handling verified")
                print(f"   ✅ Status: {probe_invalid.get('status')}")
                print(f"   ✅ Error: {probe_invalid.get('error', 'No error message')}")
            
            return success and success_invalid
        
        return False

    def test_profile_image_upload(self):
        """Test 3: Profile Image Upload Test"""
        print("\n" + "="*60)
        print("TEST 3: PROFILE IMAGE UPLOAD")
        print("="*60)
        
        if not self.token:
            print("❌ Skipping - No authentication token")
            return False
        
        # Test data: small base64 PNG (1x1 pixel transparent PNG)
        test_image_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        # Upload profile image
        success, response = self.run_test(
            "Upload profile image",
            "PUT",
            "profile/update",
            200,
            data={"profile_image": test_image_data},
            description="Call PUT /api/profile/update with base64 PNG data"
        )
        
        if success:
            print(f"   ✅ Profile image uploaded successfully")
            
            # Verify image is returned in user profile
            success_me, me_response = self.run_test(
                "Get profile with image",
                "GET",
                "auth/me",
                200,
                description="Call GET /api/auth/me and verify profile_image field"
            )
            
            if success_me:
                if me_response.get('profile_image'):
                    print(f"   ✅ Profile image field is returned in user data")
                else:
                    print(f"   ❌ Profile image field not found in user data")
                    return False
                
                # Remove profile image
                success_remove, _ = self.run_test(
                    "Remove profile image",
                    "PUT",
                    "profile/update",
                    200,
                    data={"profile_image": None},
                    description="Call PUT /api/profile/update with profile_image=null"
                )
                
                if success_remove:
                    print(f"   ✅ Profile image removal works")
                    return True
                else:
                    print(f"   ❌ Profile image removal failed")
                    return False
            else:
                return False
        
        return False

    def test_backup_apis(self):
        """Test 4: Backup API Test"""
        print("\n" + "="*60)
        print("TEST 4: BACKUP API")
        print("="*60)
        
        if not self.token:
            print("❌ Skipping - No authentication token")
            return False
        
        # Test full database backup
        success_full, backup_data = self.run_test(
            "Full database backup",
            "GET",
            "backup/full",
            200,
            description="Call GET /api/backup/full"
        )
        
        if success_full:
            print(f"   ✅ Full backup successful")
            
            # Verify JSON response contains "collections" key
            if 'collections' in backup_data:
                print(f"   ✅ Response contains 'collections' key")
                collections = backup_data['collections']
                
                # Verify required collections
                required_collections = ['users', 'tenants', 'm3u_playlists']
                for collection in required_collections:
                    if collection in collections:
                        count = len(collections[collection])
                        print(f"   ✅ {collection}: {count} records")
                    else:
                        print(f"   ❌ Missing collection: {collection}")
                        return False
                
                # Get first tenant ID for tenant backup test
                tenants = collections.get('tenants', [])
                if tenants:
                    tenant_id = tenants[0]['id']
                    print(f"   Using tenant ID for backup: {tenant_id}")
                    
                    # Test tenant-specific backup
                    success_tenant, tenant_backup = self.run_test(
                        "Tenant backup",
                        "GET",
                        f"backup/tenant/{tenant_id}",
                        200,
                        description=f"Call GET /api/backup/tenant/{tenant_id}"
                    )
                    
                    if success_tenant:
                        print(f"   ✅ Tenant backup successful")
                        if 'data' in tenant_backup:
                            print(f"   ✅ Response contains tenant-specific data")
                            tenant_data = tenant_backup['data']
                            print(f"   ✅ Tenant data sections: {list(tenant_data.keys())}")
                            return True
                        else:
                            print(f"   ❌ Tenant backup missing 'data' key")
                            return False
                    else:
                        return False
                else:
                    print(f"   ❌ No tenants found for backup test")
                    return False
            else:
                print(f"   ❌ Response missing 'collections' key")
                return False
        
        return False

    def test_restore_apis(self):
        """Test 5: Restore API Test (Optional - risky)"""
        print("\n" + "="*60)
        print("TEST 5: RESTORE API (ENDPOINT VERIFICATION ONLY)")
        print("="*60)
        
        if not self.token:
            print("❌ Skipping - No authentication token")
            return False
        
        print("   NOTE: Skipping actual restore as it modifies database")
        print("   Only verifying endpoints exist and return 400 for invalid data")
        
        # Test full restore endpoint exists
        success_full, _ = self.run_test(
            "Full restore endpoint",
            "POST",
            "restore/full",
            400,  # Expecting 400 for invalid data
            data={"invalid": "data"},
            description="Verify POST /api/restore/full exists and handles invalid data"
        )
        
        # Test tenant restore endpoint exists  
        success_tenant, _ = self.run_test(
            "Tenant restore endpoint",
            "POST",
            "restore/tenant",
            400,  # Expecting 400 for invalid data
            data={"invalid": "data"},
            description="Verify POST /api/restore/tenant exists and handles invalid data"
        )
        
        if success_full and success_tenant:
            print(f"   ✅ Both restore endpoints exist and handle invalid data correctly")
            return True
        else:
            print(f"   ❌ One or both restore endpoints failed")
            return False

    def run_all_tests(self):
        """Run all focused tests"""
        print("🚀 STARTING FOCUSED M3U MANAGEMENT PANEL BACKEND API TESTS")
        print("Testing new features as requested in review")
        
        test_results = []
        
        # Run tests in sequence
        tests = [
            ("Authentication", self.test_authentication),
            ("FFmpeg Stream Probing", self.test_ffmpeg_probing),
            ("Profile Image Upload", self.test_profile_image_upload),
            ("Backup APIs", self.test_backup_apis),
            ("Restore APIs", self.test_restore_apis),
        ]
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                test_results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {str(e)}")
                test_results.append((test_name, False))
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        
        passed_tests = []
        failed_tests = []
        
        for test_name, result in test_results:
            if result:
                passed_tests.append(test_name)
                print(f"✅ {test_name}")
            else:
                failed_tests.append(test_name)
                print(f"❌ {test_name}")
        
        print(f"\nSUMMARY:")
        print(f"Tests passed: {len(passed_tests)}/{len(test_results)}")
        print(f"Success rate: {(len(passed_tests)/len(test_results))*100:.1f}%")
        
        if failed_tests:
            print(f"\nFailed tests:")
            for test in failed_tests:
                print(f"   - {test}")
        else:
            print(f"\n🎉 All tests passed!")
        
        return len(failed_tests) == 0

if __name__ == "__main__":
    tester = FocusedAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)