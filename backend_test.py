import requests
import sys
import json
from datetime import datetime

class M3UManagerAPITester:
    def __init__(self, base_url="https://mediaflow-panel.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.test_data = {}
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, description=""):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        if description:
            print(f"   Description: {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_super_admin_login(self):
        """Test super admin login"""
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"},
            description="Login with super admin credentials"
        )
        if success and 'access_token' in response:
            self.tokens['super_admin'] = response['access_token']
            self.test_data['super_admin_user'] = response['user']
            print(f"   Super admin role: {response['user']['role']}")
            return True
        return False

    def test_create_tenant(self):
        """Test creating a tenant"""
        tenant_data = {
            "name": f"Test Tenant {datetime.now().strftime('%H%M%S')}",
            "owner_username": f"tenant_owner_{datetime.now().strftime('%H%M%S')}",
            "owner_password": "TenantPass123!"
        }
        
        success, response = self.run_test(
            "Create Tenant",
            "POST",
            "tenants",
            200,
            data=tenant_data,
            token=self.tokens.get('super_admin'),
            description="Super admin creates a new tenant with owner"
        )
        
        if success:
            self.test_data['tenant'] = response
            self.test_data['tenant_owner_creds'] = {
                "username": tenant_data["owner_username"],
                "password": tenant_data["owner_password"]
            }
            print(f"   Created tenant: {response['name']} (ID: {response['id']})")
            return True
        return False

    def test_get_tenants(self):
        """Test getting all tenants"""
        success, response = self.run_test(
            "Get All Tenants",
            "GET",
            "tenants",
            200,
            token=self.tokens.get('super_admin'),
            description="Super admin views all tenants"
        )
        
        if success:
            print(f"   Found {len(response)} tenants")
            return True
        return False

    def test_tenant_owner_login(self):
        """Test tenant owner login"""
        if 'tenant_owner_creds' not in self.test_data:
            print("❌ Skipping - No tenant owner credentials available")
            return False
            
        creds = self.test_data['tenant_owner_creds']
        success, response = self.run_test(
            "Tenant Owner Login",
            "POST",
            "auth/login",
            200,
            data={"username": creds["username"], "password": creds["password"]},
            description="Login as tenant owner"
        )
        
        if success and 'access_token' in response:
            self.tokens['tenant_owner'] = response['access_token']
            self.test_data['tenant_owner_user'] = response['user']
            print(f"   Tenant owner role: {response['user']['role']}")
            print(f"   Tenant ID: {response['user']['tenant_id']}")
            return True
        return False

    def test_create_user(self):
        """Test creating a regular user"""
        if 'tenant_owner' not in self.tokens:
            print("❌ Skipping - No tenant owner token available")
            return False
            
        user_data = {
            "username": f"regular_user_{datetime.now().strftime('%H%M%S')}",
            "password": "UserPass123!"
        }
        
        success, response = self.run_test(
            "Create Regular User",
            "POST",
            "users",
            200,
            data=user_data,
            token=self.tokens.get('tenant_owner'),
            description="Tenant owner creates a regular user"
        )
        
        if success:
            self.test_data['regular_user'] = response
            self.test_data['regular_user_creds'] = user_data
            print(f"   Created user: {response['username']} (Role: {response['role']})")
            return True
        return False

    def test_get_users(self):
        """Test getting users in tenant"""
        success, response = self.run_test(
            "Get Users in Tenant",
            "GET",
            "users",
            200,
            token=self.tokens.get('tenant_owner'),
            description="Tenant owner views users in their tenant"
        )
        
        if success:
            print(f"   Found {len(response)} users in tenant")
            return True
        return False

    def test_regular_user_login(self):
        """Test regular user login"""
        if 'regular_user_creds' not in self.test_data:
            print("❌ Skipping - No regular user credentials available")
            return False
            
        creds = self.test_data['regular_user_creds']
        success, response = self.run_test(
            "Regular User Login",
            "POST",
            "auth/login",
            200,
            data={"username": creds["username"], "password": creds["password"]},
            description="Login as regular user"
        )
        
        if success and 'access_token' in response:
            self.tokens['regular_user'] = response['access_token']
            self.test_data['regular_user_data'] = response['user']
            print(f"   Regular user role: {response['user']['role']}")
            return True
        return False

    def test_create_m3u_playlist(self):
        """Test creating M3U playlist"""
        if 'tenant_owner' not in self.tokens:
            print("❌ Skipping - No tenant owner token available")
            return False
            
        playlist_data = {
            "name": f"Test Playlist {datetime.now().strftime('%H%M%S')}",
            "url": "https://example.com/playlist.m3u",
            "content": "#EXTM3U\n#EXTINF:-1,Test Channel\nhttp://example.com/stream"
        }
        
        success, response = self.run_test(
            "Create M3U Playlist",
            "POST",
            "m3u",
            200,
            data=playlist_data,
            token=self.tokens.get('tenant_owner'),
            description="Tenant owner creates M3U playlist"
        )
        
        if success:
            self.test_data['playlist'] = response
            print(f"   Created playlist: {response['name']} (ID: {response['id']})")
            return True
        return False

    def test_get_m3u_playlists_as_owner(self):
        """Test getting M3U playlists as tenant owner"""
        success, response = self.run_test(
            "Get M3U Playlists (Owner)",
            "GET",
            "m3u",
            200,
            token=self.tokens.get('tenant_owner'),
            description="Tenant owner views playlists"
        )
        
        if success:
            print(f"   Found {len(response)} playlists")
            return True
        return False

    def test_get_m3u_playlists_as_user(self):
        """Test getting M3U playlists as regular user"""
        if 'regular_user' not in self.tokens:
            print("❌ Skipping - No regular user token available")
            return False
            
        success, response = self.run_test(
            "Get M3U Playlists (User)",
            "GET",
            "m3u",
            200,
            token=self.tokens.get('regular_user'),
            description="Regular user views playlists (read-only)"
        )
        
        if success:
            print(f"   Found {len(response)} playlists")
            return True
        return False

    def test_update_m3u_playlist(self):
        """Test updating M3U playlist"""
        if 'playlist' not in self.test_data or 'tenant_owner' not in self.tokens:
            print("❌ Skipping - No playlist or tenant owner token available")
            return False
            
        playlist_id = self.test_data['playlist']['id']
        update_data = {
            "name": f"Updated Playlist {datetime.now().strftime('%H%M%S')}",
            "url": "https://example.com/updated_playlist.m3u"
        }
        
        success, response = self.run_test(
            "Update M3U Playlist",
            "PUT",
            f"m3u/{playlist_id}",
            200,
            data=update_data,
            token=self.tokens.get('tenant_owner'),
            description="Tenant owner updates playlist"
        )
        
        if success:
            print(f"   Updated playlist name: {response['name']}")
            return True
        return False

    def test_theme_update(self):
        """Test theme update"""
        if 'tenant_owner' not in self.tokens:
            print("❌ Skipping - No tenant owner token available")
            return False
            
        success, response = self.run_test(
            "Update Theme",
            "PUT",
            "profile/theme",
            200,
            data={"theme": "dark"},
            token=self.tokens.get('tenant_owner'),
            description="Update user theme to dark mode"
        )
        
        return success

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        print("\n🔒 Testing Authorization Controls...")
        
        # Test regular user trying to create playlist (should fail)
        if 'regular_user' in self.tokens:
            success, _ = self.run_test(
                "Unauthorized Playlist Creation",
                "POST",
                "m3u",
                403,  # Expecting forbidden
                data={"name": "Unauthorized", "url": "http://test.com"},
                token=self.tokens.get('regular_user'),
                description="Regular user tries to create playlist (should fail)"
            )
            
        # Test regular user trying to create user (should fail)
        if 'regular_user' in self.tokens:
            success, _ = self.run_test(
                "Unauthorized User Creation",
                "POST",
                "users",
                403,  # Expecting forbidden
                data={"username": "unauthorized", "password": "test123"},
                token=self.tokens.get('regular_user'),
                description="Regular user tries to create user (should fail)"
            )

    def test_ffmpeg_stream_probing(self):
        """Test FFmpeg stream probing functionality"""
        print("\n🎥 Testing FFmpeg Stream Probing...")
        
        if 'tenant_owner' not in self.tokens:
            print("❌ Skipping - No tenant owner token available")
            return False
        
        # First, search for channels to get a stream URL
        success, channels = self.run_test(
            "Search Channels",
            "GET",
            "channels/search?q=test",
            200,
            token=self.tokens.get('tenant_owner'),
            description="Search for channels to get stream URLs"
        )
        
        if not success or not channels:
            print("   No channels found, using test URL")
            test_url = "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8"
        else:
            test_url = channels[0].get('url', 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8')
            print(f"   Using stream URL: {test_url}")
        
        # Test FFmpeg probe with valid URL
        success, probe_result = self.run_test(
            "FFmpeg Probe Valid Stream",
            "POST",
            f"channels/probe-ffmpeg?url={test_url}",
            200,
            token=self.tokens.get('tenant_owner'),
            description="Probe stream with FFmpeg for detailed info"
        )
        
        if success:
            print(f"   Stream status: {probe_result.get('status', 'unknown')}")
            print(f"   Online: {probe_result.get('online', False)}")
            if probe_result.get('format'):
                print(f"   Format: {probe_result.get('format')}")
            if probe_result.get('video_codec'):
                print(f"   Video codec: {probe_result.get('video_codec')}")
            if probe_result.get('video_resolution'):
                print(f"   Resolution: {probe_result.get('video_resolution')}")
            if probe_result.get('bitrate'):
                print(f"   Bitrate: {probe_result.get('bitrate')}")
        
        # Test FFmpeg probe with invalid URL
        invalid_url = "http://invalid-stream-url.com/nonexistent.m3u8"
        success_invalid, probe_invalid = self.run_test(
            "FFmpeg Probe Invalid Stream",
            "POST",
            f"channels/probe-ffmpeg?url={invalid_url}",
            200,  # Should return 200 but with error in response
            token=self.tokens.get('tenant_owner'),
            description="Probe invalid stream URL (should handle gracefully)"
        )
        
        if success_invalid:
            print(f"   Invalid stream status: {probe_invalid.get('status', 'unknown')}")
            print(f"   Error handled: {probe_invalid.get('error', 'No error info')}")
        
        return success

    def test_profile_image_upload(self):
        """Test profile image upload functionality"""
        print("\n🖼️ Testing Profile Image Upload...")
        
        if 'super_admin' not in self.tokens:
            print("❌ Skipping - No super admin token available")
            return False
        
        # Test small base64 PNG data (1x1 pixel transparent PNG)
        test_image_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        # Upload profile image
        success, response = self.run_test(
            "Upload Profile Image",
            "PUT",
            "profile/update",
            200,
            data={"profile_image": test_image_data},
            token=self.tokens.get('super_admin'),
            description="Upload PNG profile image"
        )
        
        if success:
            print(f"   Profile image uploaded successfully")
            
            # Verify image is returned in user profile
            success_me, me_response = self.run_test(
                "Get Profile with Image",
                "GET",
                "auth/me",
                200,
                token=self.tokens.get('super_admin'),
                description="Verify profile image is returned"
            )
            
            if success_me and me_response.get('profile_image'):
                print(f"   Profile image verified in user data")
            else:
                print(f"   ⚠️ Profile image not found in user data")
            
            # Remove profile image
            success_remove, _ = self.run_test(
                "Remove Profile Image",
                "PUT",
                "profile/update",
                200,
                data={"profile_image": None},
                token=self.tokens.get('super_admin'),
                description="Remove profile image"
            )
            
            if success_remove:
                print(f"   Profile image removed successfully")
            
            return success and success_me and success_remove
        
        return False

    def test_backup_apis(self):
        """Test backup and restore APIs"""
        print("\n💾 Testing Backup & Restore APIs...")
        
        if 'super_admin' not in self.tokens:
            print("❌ Skipping - No super admin token available")
            return False
        
        # Test full database backup
        success_full, backup_data = self.run_test(
            "Full Database Backup",
            "GET",
            "backup/full",
            200,
            token=self.tokens.get('super_admin'),
            description="Create full database backup"
        )
        
        if success_full:
            print(f"   Backup created successfully")
            collections = backup_data.get('collections', {})
            print(f"   Collections in backup: {list(collections.keys())}")
            
            # Verify required collections exist
            required_collections = ['users', 'tenants', 'm3u_playlists']
            for collection in required_collections:
                if collection in collections:
                    count = len(collections[collection])
                    print(f"   - {collection}: {count} records")
                else:
                    print(f"   - {collection}: Missing!")
            
            # Test tenant-specific backup if we have a tenant
            if 'tenant' in self.test_data:
                tenant_id = self.test_data['tenant']['id']
                success_tenant, tenant_backup = self.run_test(
                    "Tenant Backup",
                    "GET",
                    f"backup/tenant/{tenant_id}",
                    200,
                    token=self.tokens.get('super_admin'),
                    description=f"Create backup for tenant {tenant_id}"
                )
                
                if success_tenant:
                    print(f"   Tenant backup created successfully")
                    tenant_data = tenant_backup.get('data', {})
                    print(f"   Tenant data sections: {list(tenant_data.keys())}")
                    return success_full and success_tenant
            
            return success_full
        
        return False

    def test_restore_api_endpoints(self):
        """Test restore API endpoints exist (without actually restoring)"""
        print("\n🔄 Testing Restore API Endpoints...")
        
        if 'super_admin' not in self.tokens:
            print("❌ Skipping - No super admin token available")
            return False
        
        # Test full restore endpoint with invalid data (should return 400)
        success_full, _ = self.run_test(
            "Full Restore Endpoint",
            "POST",
            "restore/full",
            400,  # Expecting 400 for invalid data
            data={"invalid": "data"},
            token=self.tokens.get('super_admin'),
            description="Test full restore endpoint exists (with invalid data)"
        )
        
        # Test tenant restore endpoint with invalid data (should return 400)
        success_tenant, _ = self.run_test(
            "Tenant Restore Endpoint",
            "POST",
            "restore/tenant",
            400,  # Expecting 400 for invalid data
            data={"invalid": "data"},
            token=self.tokens.get('super_admin'),
            description="Test tenant restore endpoint exists (with invalid data)"
        )
        
        if success_full and success_tenant:
            print(f"   Both restore endpoints exist and handle invalid data correctly")
            return True
        
        return False

    def test_delete_operations(self):
        """Test delete operations"""
        print("\n🗑️ Testing Delete Operations...")
        
        # Delete playlist
        if 'playlist' in self.test_data and 'tenant_owner' in self.tokens:
            playlist_id = self.test_data['playlist']['id']
            success, _ = self.run_test(
                "Delete M3U Playlist",
                "DELETE",
                f"m3u/{playlist_id}",
                200,
                token=self.tokens.get('tenant_owner'),
                description="Tenant owner deletes playlist"
            )
            
        # Delete user
        if 'regular_user' in self.test_data and 'tenant_owner' in self.tokens:
            user_id = self.test_data['regular_user']['id']
            success, _ = self.run_test(
                "Delete User",
                "DELETE",
                f"users/{user_id}",
                200,
                token=self.tokens.get('tenant_owner'),
                description="Tenant owner deletes user"
            )

def main():
    print("🚀 Starting M3U Manager API Tests")
    print("=" * 50)
    
    tester = M3UManagerAPITester()
    
    # Test sequence
    test_sequence = [
        ("Super Admin Authentication", tester.test_super_admin_login),
        ("Tenant Management", tester.test_create_tenant),
        ("Get All Tenants", tester.test_get_tenants),
        ("Tenant Owner Authentication", tester.test_tenant_owner_login),
        ("User Management", tester.test_create_user),
        ("Get Users", tester.test_get_users),
        ("Regular User Authentication", tester.test_regular_user_login),
        ("M3U Playlist Creation", tester.test_create_m3u_playlist),
        ("Get Playlists (Owner)", tester.test_get_m3u_playlists_as_owner),
        ("Get Playlists (User)", tester.test_get_m3u_playlists_as_user),
        ("Update Playlist", tester.test_update_m3u_playlist),
        ("Theme Update", tester.test_theme_update),
        ("FFmpeg Stream Probing", tester.test_ffmpeg_stream_probing),
        ("Profile Image Upload", tester.test_profile_image_upload),
        ("Backup APIs", tester.test_backup_apis),
        ("Restore API Endpoints", tester.test_restore_api_endpoints),
        ("Authorization Tests", tester.test_unauthorized_access),
        ("Delete Operations", tester.test_delete_operations),
    ]
    
    failed_tests = []
    
    for test_name, test_func in test_sequence:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            result = test_func()
            if not result:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print(f"\n{'='*50}")
    print(f"📊 FINAL RESULTS")
    print(f"{'='*50}")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed test categories:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print(f"\n✅ All test categories completed successfully!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())