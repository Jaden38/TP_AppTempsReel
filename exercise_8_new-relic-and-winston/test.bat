@echo off
echo Testing API endpoints...
echo.

echo 1. Testing /ping
curl -s http://localhost:3000/ping
echo.
echo.

echo 2. Testing /data with light payload
curl -X POST http://localhost:3000/data -H "Content-Type: application/json" -d "{\"type\":\"light\",\"payload\":{\"test\":\"light data\"}}"
echo.
echo.

echo 3. Testing /data with heavy payload
curl -X POST http://localhost:3000/data -H "Content-Type: application/json" -d "{\"type\":\"heavy\",\"payload\":{\"test\":\"heavy data\"}}"
echo.
echo.

echo 4. Testing /stats
curl -s http://localhost:3000/stats
echo.
echo.

echo Tests completed!
pause