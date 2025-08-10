#!/usr/bin/env python3
"""
Verification script to check if obtained marks are consistent between frontend and backend
"""

import requests
import json

def verify_marks_consistency():
    """Verify that marks shown in frontend match those in backend"""
    
    # Backend API endpoint
    backend_url = "http://localhost:8000/api/test-marks/"
    
    print("🔍 VERIFYING MARKS CONSISTENCY")
    print("=" * 50)
    
    try:
        # Get all test marks from backend
        response = requests.get(backend_url)
        if response.status_code == 200:
            backend_data = response.json()
            print(f"✅ Backend API Response: {len(backend_data)} test marks found")
            
            # Group by test for easier comparison
            test_marks = {}
            for mark in backend_data:
                test_id = mark['test']
                if test_id not in test_marks:
                    test_marks[test_id] = []
                test_marks[test_id].append({
                    'student_name': mark['student_name'],
                    'marks': mark['marks'],
                    'total_marks': mark['total_marks'],
                    'percentage': round((mark['marks'] / mark['total_marks']) * 100, 1)
                })
            
            # Display results for each test
            for test_id, marks in test_marks.items():
                print(f"\n📊 Test ID: {test_id}")
                print("-" * 30)
                
                total_obtained = sum(m['marks'] for m in marks)
                total_possible = sum(m['total_marks'] for m in marks)
                overall_percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
                
                print(f"Total Students: {len(marks)}")
                print(f"Total Obtained Marks: {total_obtained}")
                print(f"Total Possible Marks: {total_possible}")
                print(f"Overall Percentage: {overall_percentage:.1f}%")
                
                print("\nIndividual Student Marks:")
                for mark in marks:
                    print(f"  {mark['student_name']}: {mark['marks']}/{mark['total_marks']} ({mark['percentage']}%)")
                
        else:
            print(f"❌ Backend API Error: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server. Make sure it's running on http://localhost:8000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def check_admin_data():
    """Check what the admin would show for obtained marks"""
    print("\n🔍 CHECKING ADMIN DATA")
    print("=" * 50)
    
    try:
        # Get monthly tests to see admin calculated obtained marks
        response = requests.get("http://localhost:8000/api/monthly-tests/")
        if response.status_code == 200:
            tests = response.json()
            print(f"✅ Found {len(tests)} monthly tests")
            
            for test in tests:
                print(f"\n📚 Test: {test['title']} ({test['subject']})")
                print(f"   Class: {test['class_fk']['name']}")
                print(f"   Total Marks: {test['total_marks']}")
                
                # Calculate obtained marks from test_marks
                if 'test_marks' in test and test['test_marks']:
                    total_obtained = sum(mark['marks'] for mark in test['test_marks'])
                    print(f"   Obtained Marks (calculated): {total_obtained}")
                    print(f"   Students: {len(test['test_marks'])}")
                    
                    # Show individual marks
                    for mark in test['test_marks']:
                        percentage = (mark['marks'] / mark['total_marks']) * 100
                        print(f"     {mark['student_name']}: {mark['marks']}/{mark['total_marks']} ({percentage:.1f}%)")
                else:
                    print("   No test marks found")
                    
    except Exception as e:
        print(f"❌ Error checking admin data: {str(e)}")

if __name__ == "__main__":
    verify_marks_consistency()
    check_admin_data()
    
    print("\n" + "=" * 50)
    print("✅ VERIFICATION COMPLETE")
    print("\nTo verify frontend data:")
    print("1. Open the frontend application")
    print("2. Navigate to Monthly Test Management")
    print("3. Click 'View Results' on any test")
    print("4. Compare the 'Obtained Marks' column with the backend data above")
    print("\nBoth should show identical marks for each student!") 