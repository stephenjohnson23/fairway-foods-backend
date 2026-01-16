#!/usr/bin/env python3
"""
Golf Meal Ordering App Backend API Tests
Tests all backend endpoints comprehensively
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BASE_URL = "https://fairway-foods.preview.emergentagent.com/api"

class GolfMealAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.user_token = None
        self.test_results = []
        self.created_menu_item_id = None
        self.created_order_id = None
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "response": response_data
        }
        self.test_results.append(result)
        print(f"{status} {test_name}: {message}")
        if response_data and not success:
            print(f"   Response: {response_data}")
    
    def test_health_check(self):
        """Test health check endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("Health Check", True, "Health endpoint working correctly", data)
                else:
                    self.log_result("Health Check", False, f"Unexpected health status: {data}", data)
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Health Check", False, f"Connection error: {str(e)}")
    
    def test_user_registration(self):
        """Test user registration"""
        try:
            user_data = {
                "email": "john.smith@golfclub.com",
                "password": "SecurePass123!",
                "name": "John Smith"
            }
            
            response = requests.post(f"{self.base_url}/auth/register", 
                                   json=user_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.user_token = data["token"]
                    self.log_result("User Registration", True, 
                                  f"User registered successfully: {data['user']['name']}", data)
                else:
                    self.log_result("User Registration", False, 
                                  "Missing token or user in response", data)
            else:
                self.log_result("User Registration", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("User Registration", False, f"Error: {str(e)}")
    
    def test_admin_login(self):
        """Test admin login with provided credentials"""
        try:
            admin_data = {
                "email": "admin@golf.com",
                "password": "admin123"
            }
            
            response = requests.post(f"{self.base_url}/auth/login", 
                                   json=admin_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and data.get("user", {}).get("role") == "admin":
                    self.admin_token = data["token"]
                    self.log_result("Admin Login", True, 
                                  f"Admin logged in successfully: {data['user']['email']}", data)
                else:
                    self.log_result("Admin Login", False, 
                                  "Admin login failed - not admin role or missing token", data)
            else:
                self.log_result("Admin Login", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Admin Login", False, f"Error: {str(e)}")
    
    def test_user_login(self):
        """Test regular user login"""
        try:
            user_data = {
                "email": "john.smith@golfclub.com",
                "password": "SecurePass123!"
            }
            
            response = requests.post(f"{self.base_url}/auth/login", 
                                   json=user_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data:
                    self.user_token = data["token"]
                    self.log_result("User Login", True, 
                                  f"User logged in successfully: {data['user']['email']}", data)
                else:
                    self.log_result("User Login", False, 
                                  "Missing token in response", data)
            else:
                self.log_result("User Login", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("User Login", False, f"Error: {str(e)}")
    
    def test_get_current_user(self):
        """Test get current user endpoint"""
        if not self.user_token:
            self.log_result("Get Current User", False, "No user token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = requests.get(f"{self.base_url}/auth/me", 
                                  headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "email" in data and "name" in data:
                    self.log_result("Get Current User", True, 
                                  f"User info retrieved: {data['email']}", data)
                else:
                    self.log_result("Get Current User", False, 
                                  "Missing user info in response", data)
            else:
                self.log_result("Get Current User", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Get Current User", False, f"Error: {str(e)}")
    
    def test_get_menu(self):
        """Test get menu items (no auth required)"""
        try:
            response = requests.get(f"{self.base_url}/menu", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Get Menu", True, 
                              f"Menu retrieved with {len(data)} items", 
                              f"Sample: {data[0] if data else 'No items'}")
            else:
                self.log_result("Get Menu", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Get Menu", False, f"Error: {str(e)}")
    
    def test_create_menu_item(self):
        """Test creating menu item (admin only)"""
        if not self.admin_token:
            self.log_result("Create Menu Item", False, "No admin token available")
            return
            
        try:
            menu_item = {
                "name": "Clubhouse Burger",
                "description": "Premium beef burger with aged cheddar, lettuce, tomato, and our signature sauce",
                "price": 18.95,
                "category": "Main Course",
                "image": "https://example.com/burger.jpg",
                "available": True
            }
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.post(f"{self.base_url}/menu", 
                                   json=menu_item, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data:
                    self.created_menu_item_id = data["id"]
                    self.log_result("Create Menu Item", True, 
                                  f"Menu item created: {data['name']}", data)
                else:
                    self.log_result("Create Menu Item", False, 
                                  "Missing ID in response", data)
            else:
                self.log_result("Create Menu Item", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Create Menu Item", False, f"Error: {str(e)}")
    
    def test_update_menu_item(self):
        """Test updating menu item (admin only)"""
        if not self.admin_token or not self.created_menu_item_id:
            self.log_result("Update Menu Item", False, 
                          "No admin token or menu item ID available")
            return
            
        try:
            update_data = {
                "price": 19.95,
                "description": "Premium beef burger with aged cheddar, lettuce, tomato, and our signature sauce - Updated!"
            }
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.put(f"{self.base_url}/menu/{self.created_menu_item_id}", 
                                  json=update_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("price") == 19.95:
                    self.log_result("Update Menu Item", True, 
                                  f"Menu item updated: {data['name']}", data)
                else:
                    self.log_result("Update Menu Item", False, 
                                  "Price not updated correctly", data)
            else:
                self.log_result("Update Menu Item", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Update Menu Item", False, f"Error: {str(e)}")
    
    def test_create_order(self):
        """Test creating order (no auth required for guest orders)"""
        try:
            order_data = {
                "items": [
                    {
                        "menuItemId": "sample_item_1",
                        "name": "Clubhouse Burger",
                        "price": 18.95,
                        "quantity": 2
                    },
                    {
                        "menuItemId": "sample_item_2", 
                        "name": "Caesar Salad",
                        "price": 12.50,
                        "quantity": 1
                    }
                ],
                "customerName": "Michael Johnson",
                "teeOffTime": "14:30",
                "totalAmount": 50.40
            }
            
            response = requests.post(f"{self.base_url}/orders", 
                                   json=order_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data.get("status") == "pending":
                    self.created_order_id = data["id"]
                    self.log_result("Create Order", True, 
                                  f"Order created for {data['customerName']}", data)
                else:
                    self.log_result("Create Order", False, 
                                  "Missing ID or incorrect status", data)
            else:
                self.log_result("Create Order", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Create Order", False, f"Error: {str(e)}")
    
    def test_get_orders(self):
        """Test getting all orders"""
        try:
            response = requests.get(f"{self.base_url}/orders", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Get Orders", True, 
                              f"Retrieved {len(data)} orders", 
                              f"Sample: {data[0] if data else 'No orders'}")
            else:
                self.log_result("Get Orders", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Get Orders", False, f"Error: {str(e)}")
    
    def test_update_order_status(self):
        """Test updating order status"""
        if not self.created_order_id:
            self.log_result("Update Order Status", False, "No order ID available")
            return
            
        try:
            status_data = {"status": "preparing"}
            
            response = requests.patch(f"{self.base_url}/orders/{self.created_order_id}/status", 
                                    json=status_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "preparing":
                    self.log_result("Update Order Status", True, 
                                  f"Order status updated to: {data['status']}", data)
                else:
                    self.log_result("Update Order Status", False, 
                                  "Status not updated correctly", data)
            else:
                self.log_result("Update Order Status", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Update Order Status", False, f"Error: {str(e)}")
    
    def test_delete_menu_item(self):
        """Test deleting menu item (admin only)"""
        if not self.admin_token or not self.created_menu_item_id:
            self.log_result("Delete Menu Item", False, 
                          "No admin token or menu item ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.delete(f"{self.base_url}/menu/{self.created_menu_item_id}", 
                                     headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_result("Delete Menu Item", True, 
                                  "Menu item deleted successfully", data)
                else:
                    self.log_result("Delete Menu Item", False, 
                                  "Unexpected response format", data)
            else:
                self.log_result("Delete Menu Item", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Delete Menu Item", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🚀 Starting Golf Meal Ordering App Backend Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Health check first
        self.test_health_check()
        
        # Authentication tests
        self.test_user_registration()
        self.test_admin_login()
        self.test_user_login()
        self.test_get_current_user()
        
        # Menu tests
        self.test_get_menu()
        self.test_create_menu_item()
        self.test_update_menu_item()
        
        # Order tests
        self.test_create_order()
        self.test_get_orders()
        self.test_update_order_status()
        
        # Cleanup
        self.test_delete_menu_item()
        
        # Summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if "✅" in result["status"])
        failed = sum(1 for result in self.test_results if "❌" in result["status"])
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌" in result["status"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        print(f"\n🎯 Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        
        return failed == 0

if __name__ == "__main__":
    tester = GolfMealAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)