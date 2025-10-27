import requests
import sys
import json
from datetime import datetime

class M3UManagerAPITester:
    def __init__(self, base_url="https://m3umaster.preview.emergentagent.com"):
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