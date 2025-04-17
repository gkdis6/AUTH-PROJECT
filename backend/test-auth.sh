#!/bin/bash

# 로그인 및 토큰 발급
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

echo "Login Response:"
echo $LOGIN_RESPONSE | jq '.'

# Access Token 추출
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o 'accessToken=[^;]*' | cut -d'=' -f2)
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | grep -o 'refreshToken=[^;]*' | cut -d'=' -f2)

echo -e "\n2. Testing protected endpoint with Access Token..."
PROTECTED_RESPONSE=$(curl -s -X GET http://localhost:3000/auth/me \
  -H "Cookie: accessToken=$ACCESS_TOKEN")

echo "Protected Endpoint Response:"
echo $PROTECTED_RESPONSE | jq '.'

echo -e "\n3. Waiting for Access Token to expire (10 seconds)..."
sleep 10

echo -e "\n4. Testing protected endpoint with expired Access Token..."
EXPIRED_RESPONSE=$(curl -s -X GET http://localhost:3000/auth/me \
  -H "Cookie: accessToken=$ACCESS_TOKEN")

echo "Expired Token Response:"
echo $EXPIRED_RESPONSE | jq '.'

echo -e "\n5. Refreshing tokens..."
REFRESH_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Cookie: refreshToken=$REFRESH_TOKEN")

echo "Refresh Response:"
echo $REFRESH_RESPONSE | jq '.'

# 새로운 Access Token 추출
NEW_ACCESS_TOKEN=$(echo $REFRESH_RESPONSE | grep -o 'accessToken=[^;]*' | cut -d'=' -f2)

echo -e "\n6. Testing protected endpoint with new Access Token..."
NEW_PROTECTED_RESPONSE=$(curl -s -X GET http://localhost:3000/auth/me \
  -H "Cookie: accessToken=$NEW_ACCESS_TOKEN")

echo "New Protected Endpoint Response:"
echo $NEW_PROTECTED_RESPONSE | jq '.' 