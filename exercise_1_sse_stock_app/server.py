from flask import Flask, Response, render_template
import json, time, random, itertools
import os

app = Flask(__name__)

stock_prices = {
    "AAPL": 170.00,
    "GOOG": 1500.00,
    "MSFT": 250.00,
    "AMZN": 130.00,
    "TSLA": 220.00,
    "META": 315.00,
    "NVDA": 450.00,
    "NFLX": 400.00
}

event_counter = itertools.count(1)

# Market sectors for categorization
stock_sectors = {
    "AAPL": "Technology",
    "GOOG": "Technology", 
    "MSFT": "Technology",
    "AMZN": "E-commerce",
    "TSLA": "Automotive",
    "META": "Social Media",
    "NVDA": "Semiconductors",
    "NFLX": "Streaming"
}

def generate_stock_update():
    symbol = random.choice(list(stock_prices.keys()))
    current_price = stock_prices[symbol]
    # Increased volatility range for more dynamic updates
    change_percent = random.uniform(-2.0, 2.0) / 100
    new_price = round(current_price * (1 + change_percent), 2)
    stock_prices[symbol] = new_price
    
    return {
        "symbol": symbol,
        "price": new_price,
        "change": round(new_price - current_price, 2),
        "change_percent": round(change_percent * 100, 2),
        "sector": stock_sectors[symbol],
        "volume": random.randint(10000, 500000),
        "timestamp": time.time()
    }

def generate_market_alert():
    alerts = [
        {"level": "info", "message": "Market volume increasing", "icon": "📈"},
        {"level": "warning", "message": "High volatility detected", "icon": "⚠️"},
        {"level": "success", "message": "NASDAQ up 1.5%", "icon": "🎯"},
        {"level": "info", "message": "Fed announcement at 2 PM", "icon": "🏛️"},
        {"level": "warning", "message": "Tech sector showing weakness", "icon": "💻"},
        {"level": "success", "message": "Energy sector rally continues", "icon": "⚡"}
    ]
    alert = random.choice(alerts)
    return {
        "type": "alert",
        "level": alert["level"],
        "message": alert["message"],
        "icon": alert["icon"],
        "timestamp": time.time()
    }

def generate_market_summary():
    symbols = list(stock_prices.keys())
    total_change = sum((stock_prices[s] - 200) for s in symbols)  # Rough baseline
    market_trend = "up" if total_change > 0 else "down"
    
    return {
        "type": "summary",
        "market_trend": market_trend,
        "active_stocks": len(symbols),
        "avg_change": round(total_change / len(symbols), 2),
        "timestamp": time.time()
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/stream')
def stream():
    def event_stream():
        summary_counter = 0
        
        while True:
            event_id = next(event_counter)

            # Send stock update
            stock_data = generate_stock_update()
            yield f"id: {event_id}\n"
            yield f"event: stock_update\n" 
            yield f"data: {json.dumps(stock_data)}\n\n"

            # Market alert (1 in 4 chance)
            if random.randint(1, 4) == 1:
                alert = generate_market_alert()
                alert_id = next(event_counter)
                yield f"id: {alert_id}\n"
                yield f"event: market_alert\n"
                yield f"data: {json.dumps(alert)}\n\n"

            # Market summary every 10 updates
            summary_counter += 1
            if summary_counter >= 10:
                summary = generate_market_summary()
                summary_id = next(event_counter)
                yield f"id: {summary_id}\n"
                yield f"event: market_summary\n"
                yield f"data: {json.dumps(summary)}\n\n"
                summary_counter = 0

            time.sleep(1.5)  # Slightly faster updates
            
    return Response(event_stream(), mimetype='text/event-stream', headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*"
    })

@app.route('/health')
def health():
    return {"status": "healthy", "active_stocks": len(stock_prices)}

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)