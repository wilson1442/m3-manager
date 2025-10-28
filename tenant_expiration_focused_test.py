#!/usr/bin/env python3
"""
Focused test for Tenant Expiration Login Fix
This test specifically validates the security fix mentioned in the review request.
"""

import requests
import json
from datetime import datetime, timedelta

class TenantExpirationTester:
    def __init__(self, base_url="https://mediaflow-panel.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.super_admin_token = None
        self.test_results = []

    def log_result(self, test_name, success, message):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message
        })

    def make_request(self, method, endpoint, data=None, token=None, expected_status=None):
        """Make API request and return response"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            if expected_status and response.status_code != expected_status:
                return False, f"Expected {expected_status}, got {response.status_code}"
            
            try:
                return True, response.json() if response.content else {}
            except:
                return True, {"status_code": response.status_code, "text": response.text}
        except Exception as e:
            return False, str(e)

    def test_super_admin_login(self):
        """Step 1: Login as super admin"""
        print("\n🔐 Step 1: Super Admin Authentication")
        
        success, response = self.make_request(
            'POST', 'auth/login',
            data={"username": "admin", "password": "admin123"},
            expected_status=200
        )
        
        if success and 'access_token' in response:
            self.super_admin_token = response['access_token']
            self.log_result("Super Admin Login", True, f"Logged in as {response['user']['role']}")
            return True
        else:
            self.log_result("Super Admin Login", False, f"Login failed: {response}")
            return False

    def test_create_expired_tenant_scenario(self):
        """Step 2: Create tenant with past expiration date and user"""
        print("\n🏢 Step 2: Create Expired Tenant Scenario")
        
        if not self.super_admin_token:
            self.log_result("Create Expired Tenant", False, "No super admin token")
            return False

        # Create tenant with past expiration date
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        tenant_data = {
            "name": f"Expired Test Tenant {datetime.now().strftime('%H%M%S')}",
            "owner_username": f"expired_owner_{datetime.now().strftime('%H%M%S')}",
            "owner_password": "ExpiredPass123!",
            "expiration_date": yesterday
        }

        success, response = self.make_request(
            'POST', 'tenants',
            data=tenant_data,
            token=self.super_admin_token,
            expected_status=200
        )

        if success:
            self.expired_tenant = response
            self.expired_owner_creds = {
                "username": tenant_data["owner_username"],
                "password": tenant_data["owner_password"]
            }
            self.log_result("Create Expired Tenant", True, 
                          f"Created tenant '{response['name']}' with expiration {yesterday}")
            
            # Create a regular user in the expired tenant
            user_data = {
                "username": f"expired_user_{datetime.now().strftime('%H%M%S')}",
                "password": "ExpiredUserPass123!",
                "tenant_id": response['id']
            }
            
            user_success, user_response = self.make_request(
                'POST', 'users',
                data=user_data,
                token=self.super_admin_token,
                expected_status=200
            )
            
            if user_success:
                self.expired_user_creds = {
                    "username": user_data["username"],
                    "password": user_data["password"]
                }
                self.log_result("Create Expired Tenant User", True, 
                              f"Created user '{user_response['username']}' in expired tenant")
                return True
            else:
                self.log_result("Create Expired Tenant User", False, f"Failed: {user_response}")
                return False
        else:
            self.log_result("Create Expired Tenant", False, f"Failed: {response}")
            return False

    def test_expired_tenant_login_blocking(self):
        """Step 3: Test that login is blocked for expired tenant users"""
        print("\n🚫 Step 3: Test Expired Tenant Login Blocking")
        
        if not hasattr(self, 'expired_owner_creds') or not hasattr(self, 'expired_user_creds'):
            self.log_result("Expired Tenant Login Test", False, "No expired tenant credentials")
            return False

        # Test 1: Try to login as tenant owner (should fail with 403)
        success, response = self.make_request(
            'POST', 'auth/login',
            data=self.expired_owner_creds,
            expected_status=403
        )

        if success:
            self.log_result("Expired Tenant Owner Login Block", True, 
                          "Login correctly blocked with 403 Forbidden")
            
            # Verify error message mentions tenant expiration
            if 'detail' in response and 'expired' in response['detail'].lower():
                self.log_result("Expired Tenant Error Message", True, 
                              f"Proper error message: {response['detail']}")
            else:
                self.log_result("Expired Tenant Error Message", False, 
                              f"Error message unclear: {response.get('detail', 'No detail')}")
        else:
            self.log_result("Expired Tenant Owner Login Block", False, 
                          f"Login not blocked properly: {response}")
            return False

        # Test 2: Try to login as regular user in expired tenant (should fail with 403)
        success, response = self.make_request(
            'POST', 'auth/login',
            data=self.expired_user_creds,
            expected_status=403
        )

        if success:
            self.log_result("Expired Tenant User Login Block", True, 
                          "User login correctly blocked with 403 Forbidden")
            return True
        else:
            self.log_result("Expired Tenant User Login Block", False, 
                          f"User login not blocked properly: {response}")
            return False

    def test_non_expired_tenant_still_works(self):
        """Step 4: Verify non-expired tenants still work"""
        print("\n✅ Step 4: Test Non-Expired Tenant Still Works")
        
        if not self.super_admin_token:
            self.log_result("Non-Expired Tenant Test", False, "No super admin token")
            return False

        # Create tenant with future expiration date
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        tenant_data = {
            "name": f"Valid Test Tenant {datetime.now().strftime('%H%M%S')}",
            "owner_username": f"valid_owner_{datetime.now().strftime('%H%M%S')}",
            "owner_password": "ValidPass123!",
            "expiration_date": future_date
        }

        success, response = self.make_request(
            'POST', 'tenants',
            data=tenant_data,
            token=self.super_admin_token,
            expected_status=200
        )

        if success:
            valid_owner_creds = {
                "username": tenant_data["owner_username"],
                "password": tenant_data["owner_password"]
            }
            
            # Try to login (should succeed)
            login_success, login_response = self.make_request(
                'POST', 'auth/login',
                data=valid_owner_creds,
                expected_status=200
            )
            
            if login_success and 'access_token' in login_response:
                self.log_result("Non-Expired Tenant Login", True, 
                              f"Login successful for tenant expiring {future_date}")
                return True
            else:
                self.log_result("Non-Expired Tenant Login", False, 
                              f"Login failed: {login_response}")
                return False
        else:
            self.log_result("Create Non-Expired Tenant", False, f"Failed: {response}")
            return False

    def test_get_current_user_blocking(self):
        """Step 5: Test that get_current_user also blocks expired tenant tokens"""
        print("\n🔒 Step 5: Test get_current_user Blocking")
        
        if not self.super_admin_token:
            self.log_result("get_current_user Test", False, "No super admin token")
            return False

        # First, create a tenant and get a valid token
        future_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tenant_data = {
            "name": f"Token Test Tenant {datetime.now().strftime('%H%M%S')}",
            "owner_username": f"token_owner_{datetime.now().strftime('%H%M%S')}",
            "owner_password": "TokenPass123!",
            "expiration_date": future_date
        }

        success, response = self.make_request(
            'POST', 'tenants',
            data=tenant_data,
            token=self.super_admin_token,
            expected_status=200
        )

        if not success:
            self.log_result("Token Test Setup", False, f"Failed to create tenant: {response}")
            return False

        tenant_id = response['id']
        owner_creds = {
            "username": tenant_data["owner_username"],
            "password": tenant_data["owner_password"]
        }

        # Login to get token
        login_success, login_response = self.make_request(
            'POST', 'auth/login',
            data=owner_creds,
            expected_status=200
        )

        if not login_success or 'access_token' not in login_response:
            self.log_result("Token Test Login", False, f"Failed to login: {login_response}")
            return False

        valid_token = login_response['access_token']

        # Verify token works initially
        me_success, me_response = self.make_request(
            'GET', 'auth/me',
            token=valid_token,
            expected_status=200
        )

        if not me_success:
            self.log_result("Token Initial Validation", False, f"Token doesn't work: {me_response}")
            return False

        self.log_result("Token Initial Validation", True, "Token works before expiration")

        # Now expire the tenant
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        update_success, update_response = self.make_request(
            'PUT', f'tenants/{tenant_id}',
            data={"expiration_date": yesterday},
            token=self.super_admin_token,
            expected_status=200
        )

        if not update_success:
            self.log_result("Expire Tenant", False, f"Failed to expire tenant: {update_response}")
            return False

        self.log_result("Expire Tenant", True, f"Tenant expired to {yesterday}")

        # Now try to use the token (should fail with 403)
        expired_me_success, expired_me_response = self.make_request(
            'GET', 'auth/me',
            token=valid_token,
            expected_status=403
        )

        if expired_me_success:
            self.log_result("Expired Token Blocking", True, 
                          "get_current_user correctly blocks expired tenant token")
            return True
        else:
            self.log_result("Expired Token Blocking", False, 
                          f"Token still works after expiration: {expired_me_response}")
            return False

    def run_all_tests(self):
        """Run all tenant expiration tests"""
        print("🔍 TENANT EXPIRATION LOGIN FIX - FOCUSED TESTING")
        print("=" * 60)
        print("Testing the critical security fix for tenant expiration logic")
        print("Review Request: RE-TEST Tenant Expiration Login Fix")
        print("=" * 60)

        tests = [
            self.test_super_admin_login,
            self.test_create_expired_tenant_scenario,
            self.test_expired_tenant_login_blocking,
            self.test_non_expired_tenant_still_works,
            self.test_get_current_user_blocking
        ]

        all_passed = True
        for test in tests:
            try:
                result = test()
                if not result:
                    all_passed = False
            except Exception as e:
                print(f"❌ Test failed with exception: {str(e)}")
                all_passed = False

        # Summary
        print("\n" + "=" * 60)
        print("📊 TENANT EXPIRATION FIX TEST RESULTS")
        print("=" * 60)
        
        passed_count = sum(1 for r in self.test_results if r['success'])
        total_count = len(self.test_results)
        
        print(f"Tests passed: {passed_count}/{total_count}")
        print(f"Success rate: {(passed_count/total_count)*100:.1f}%")
        
        print("\nDetailed Results:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        if all_passed:
            print("\n🎉 SECURITY FIX VERIFIED: Tenant expiration login blocking works correctly!")
            print("✅ Login attempts for expired tenants are blocked at /auth/login endpoint")
            print("✅ Appropriate 403 error with expiration message is returned")
            print("✅ Non-expired tenant logins continue to work normally")
            print("✅ Existing tokens from expired tenants are blocked by get_current_user")
        else:
            print("\n⚠️  SECURITY ISSUE: Some tenant expiration tests failed!")
            print("❌ The tenant expiration fix may not be working correctly")
        
        return all_passed

def main():
    tester = TenantExpirationTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    import sys
    sys.exit(main())